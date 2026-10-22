/**
 * Wear logs: one per day, holding the pieces worn plus the outfit, a mirror
 * selfie, the day's weather and a note. Every change refreshes the pieces'
 * cached wearCount / lastWornAt. Logging today also moves pieces: worn, or
 * straight to the basket when auto-laundry says so (logEffects.ts), always
 * through the status service's transition table.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, wearLogItems, wearLogs, type WeatherSnapshot } from '@/db/schema';
import type { ItemStatus } from '@/features/items/catalog';
import { applyItemStatus } from '@/features/items/mutations';
import { toDayKey, type DayKey } from '@/lib/dates';
import { deleteImage } from '@/lib/images';
import { newId } from '@/lib/ids';
import { usePreferences } from '@/store/preferences';

import { statusAfterUnwear, statusAfterWear } from './logEffects';
import { wearCacheFromDays } from './wearCache';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function wearDaysOf(tx: Tx, itemId: string): DayKey[] {
  return tx
    .select({ date: wearLogs.date })
    .from(wearLogItems)
    .innerJoin(wearLogs, and(eq(wearLogs.id, wearLogItems.wearLogId), isNull(wearLogs.deletedAt)))
    .where(and(eq(wearLogItems.itemId, itemId), isNull(wearLogItems.deletedAt)))
    .all()
    .map((d) => d.date);
}

/** Recomputes the cached wearCount / lastWornAt for one item from its live logs. Returns its wear days. */
export function refreshWearCache(tx: Tx, itemId: string): DayKey[] {
  const days = wearDaysOf(tx, itemId);
  tx.update(items).set(wearCacheFromDays(days)).where(eq(items.id, itemId)).run();
  return days;
}

function dayLog(tx: Tx, date: DayKey) {
  return tx
    .select({
      id: wearLogs.id,
      outfitId: wearLogs.outfitId,
      photoUri: wearLogs.photoUri,
      weather: wearLogs.weather,
      notes: wearLogs.notes,
    })
    .from(wearLogs)
    .where(and(eq(wearLogs.date, date), isNull(wearLogs.deletedAt)))
    .get();
}

export type LogDraft = {
  date: DayKey;
  itemIds: readonly string[];
  /** Fields left undefined keep what the day's log already has. */
  outfitId?: string | null;
  photoUri?: string | null;
  notes?: string | null;
  /** Only ever filled in: a log never loses its weather. */
  weather?: WeatherSnapshot | null;
};

/** How a piece was before a log moved it, so an undo can put it back exactly. */
type StatusUndo = {
  itemId: string;
  before: { status: ItemStatus; statusChangedAt: Date | null; washedAt: Date | null };
  after: ItemStatus;
};

export type LogReceipt = {
  logId: string;
  date: DayKey;
  createdLog: boolean;
  /** The log's fields before this write (for undo). */
  previous: {
    outfitId: string | null;
    photoUri: string | null;
    weather: WeatherSnapshot | null;
    notes: string | null;
  } | null;
  added: string[];
  removed: string[];
  /** Pieces marked worn, and pieces sent straight to the basket. */
  worn: string[];
  laundry: string[];
  statusUndo: StatusUndo[];
};

/**
 * Writes the day's log. `add` puts pieces on it, `remove` takes them off,
 * `replace` makes its pieces exactly `itemIds`. A log left with no pieces
 * goes.
 */
export function writeWearLog(draft: LogDraft, mode: 'add' | 'remove' | 'replace', now = new Date()): LogReceipt {
  const rules = usePreferences.getState().autoLaundry;
  const today = toDayKey(now);
  return db.transaction((tx) => {
    const existing = dayLog(tx, draft.date);
    const logId = existing?.id ?? newId();
    const nothing: LogReceipt = {
      logId,
      date: draft.date,
      createdLog: false,
      previous: null,
      added: [],
      removed: [],
      worn: [],
      laundry: [],
      statusUndo: [],
    };
    // Taking pieces off a day with no log, or logging nothing: nothing to write.
    if (!existing && (mode === 'remove' || draft.itemIds.length === 0)) return nothing;
    if (!existing) {
      tx.insert(wearLogs)
        .values({
          id: logId,
          date: draft.date,
          outfitId: draft.outfitId ?? null,
          photoUri: draft.photoUri ?? null,
          notes: draft.notes ?? null,
          weather: draft.weather ?? null,
        })
        .run();
    } else {
      const patch: Partial<typeof wearLogs.$inferInsert> = {};
      if (draft.outfitId !== undefined) patch.outfitId = draft.outfitId;
      if (draft.photoUri !== undefined) patch.photoUri = draft.photoUri;
      if (draft.notes !== undefined) patch.notes = draft.notes;
      if (draft.weather) patch.weather = draft.weather;
      if (Object.keys(patch).length > 0) tx.update(wearLogs).set(patch).where(eq(wearLogs.id, logId)).run();
    }

    const links = tx
      .select({ id: wearLogItems.id, itemId: wearLogItems.itemId, deletedAt: wearLogItems.deletedAt })
      .from(wearLogItems)
      .where(eq(wearLogItems.wearLogId, logId))
      .all();
    const live = new Set(links.filter((l) => !l.deletedAt).map((l) => l.itemId));
    const wanted = new Set(draft.itemIds);
    const added = mode === 'remove' ? [] : [...wanted].filter((id) => !live.has(id));
    const removed =
      mode === 'add'
        ? []
        : mode === 'remove'
          ? [...wanted].filter((id) => live.has(id))
          : [...live].filter((id) => !wanted.has(id));

    for (const itemId of added) {
      // (log, item) is unique, so a soft-deleted link is revived rather than re-inserted.
      const link = links.find((l) => l.itemId === itemId);
      if (link) tx.update(wearLogItems).set({ deletedAt: null }).where(eq(wearLogItems.id, link.id)).run();
      else tx.insert(wearLogItems).values({ id: newId(), wearLogId: logId, itemId }).run();
    }
    if (removed.length > 0)
      tx.update(wearLogItems)
        .set({ deletedAt: now })
        .where(and(eq(wearLogItems.wearLogId, logId), inArray(wearLogItems.itemId, removed)))
        .run();

    const receipt: LogReceipt = {
      ...nothing,
      createdLog: !existing,
      previous: existing
        ? { outfitId: existing.outfitId, photoUri: existing.photoUri, weather: existing.weather, notes: existing.notes }
        : null,
      added,
      removed,
    };

    const move = (itemId: string, next: ItemStatus | null) => {
      if (!next) return;
      const before = tx
        .select({ status: items.status, statusChangedAt: items.statusChangedAt, washedAt: items.washedAt })
        .from(items)
        .where(eq(items.id, itemId))
        .get();
      const plan = before ? applyItemStatus(tx, itemId, next, now) : null;
      if (!before || !plan?.ok) return;
      receipt.statusUndo.push({ itemId, before, after: next });
      if (next === 'worn') receipt.worn.push(itemId);
      if (next === 'laundry') receipt.laundry.push(itemId);
    };

    for (const itemId of added) {
      const wearDays = refreshWearCache(tx, itemId);
      const row = tx
        .select({ category: items.category, status: items.status, washedAt: items.washedAt })
        .from(items)
        .where(eq(items.id, itemId))
        .get();
      if (row) move(itemId, statusAfterWear({ ...row, wearDays }, draft.date, today, rules));
    }
    for (const itemId of removed) {
      refreshWearCache(tx, itemId);
      const row = tx.select({ status: items.status }).from(items).where(eq(items.id, itemId)).get();
      if (row) move(itemId, statusAfterUnwear(row.status, draft.date, today));
    }

    if (live.size + added.length - removed.length === 0)
      tx.update(wearLogs).set({ deletedAt: now }).where(eq(wearLogs.id, logId)).run();
    return receipt;
  });
}

/** Takes back a write made moments ago: links, fields, caches and the exact statuses before. */
export function undoWearLog(receipt: LogReceipt, now = new Date()) {
  db.transaction((tx) => {
    const { logId } = receipt;
    if (receipt.added.length > 0)
      tx.update(wearLogItems)
        .set({ deletedAt: now })
        .where(and(eq(wearLogItems.wearLogId, logId), inArray(wearLogItems.itemId, receipt.added)))
        .run();
    if (receipt.removed.length > 0)
      tx.update(wearLogItems)
        .set({ deletedAt: null })
        .where(and(eq(wearLogItems.wearLogId, logId), inArray(wearLogItems.itemId, receipt.removed)))
        .run();
    if (receipt.createdLog) tx.update(wearLogs).set({ deletedAt: now }).where(eq(wearLogs.id, logId)).run();
    else if (receipt.previous)
      tx.update(wearLogs)
        .set({ ...receipt.previous, deletedAt: null })
        .where(eq(wearLogs.id, logId))
        .run();
    for (const itemId of [...receipt.added, ...receipt.removed]) refreshWearCache(tx, itemId);
    // Only pieces still where the log put them go back; anything moved since stays put.
    for (const u of receipt.statusUndo) {
      const current = tx.select({ status: items.status }).from(items).where(eq(items.id, u.itemId)).get();
      if (current?.status !== u.after) continue;
      applyItemStatus(tx, u.itemId, u.before.status, now);
      tx.update(items)
        .set({ statusChangedAt: u.before.statusChangedAt, washedAt: u.before.washedAt })
        .where(eq(items.id, u.itemId))
        .run();
    }
  });
}

/** Deletes a day's log (the journal's "Delete"). Its selfie goes too. */
export function deleteWearLog(logId: string, now = new Date()) {
  const today = toDayKey(now);
  const photo = db.transaction((tx) => {
    const log = tx
      .select({ date: wearLogs.date, photoUri: wearLogs.photoUri })
      .from(wearLogs)
      .where(eq(wearLogs.id, logId))
      .get();
    if (!log) return null;
    const ids = tx
      .select({ itemId: wearLogItems.itemId })
      .from(wearLogItems)
      .where(and(eq(wearLogItems.wearLogId, logId), isNull(wearLogItems.deletedAt)))
      .all()
      .map((r) => r.itemId);
    tx.update(wearLogItems).set({ deletedAt: now }).where(eq(wearLogItems.wearLogId, logId)).run();
    tx.update(wearLogs).set({ deletedAt: now, photoUri: null }).where(eq(wearLogs.id, logId)).run();
    for (const itemId of ids) {
      refreshWearCache(tx, itemId);
      const row = tx.select({ status: items.status }).from(items).where(eq(items.id, itemId)).get();
      const next = row ? statusAfterUnwear(row.status, log.date, today) : null;
      if (next) applyItemStatus(tx, itemId, next, now);
    }
    return log.photoUri;
  });
  deleteImage(photo);
}

/** "Wear today" on item detail: adds the piece to today's log. */
export function logWearToday(
  itemId: string,
  weather: WeatherSnapshot | null = null,
  now = new Date(),
): 'logged' | 'laundry' | 'already' {
  const r = writeWearLog({ date: toDayKey(now), itemIds: [itemId], weather }, 'add', now);
  if (r.added.length === 0) return 'already';
  return r.laundry.length > 0 ? 'laundry' : 'logged';
}

/** Undo "Wear today": takes the piece off today's log (a log left empty goes). */
export function unlogWearToday(itemId: string, now = new Date()) {
  writeWearLog({ date: toDayKey(now), itemIds: [itemId] }, 'remove', now);
}

/** Whether the piece is in today's wear log. */
export function useWornToday(itemId: string | undefined, now = new Date()) {
  const day = toDayKey(now);
  const { data } = useLiveData(
    () =>
      db
        .select({ id: wearLogItems.id })
        .from(wearLogItems)
        .innerJoin(wearLogs, and(eq(wearLogs.id, wearLogItems.wearLogId), isNull(wearLogs.deletedAt)))
        .where(and(eq(wearLogItems.itemId, itemId ?? ''), eq(wearLogs.date, day), isNull(wearLogItems.deletedAt)))
        .limit(1),
    [wearLogItems, wearLogs],
    [itemId, day],
    [] as { id: string }[],
  );
  return data.length > 0;
}

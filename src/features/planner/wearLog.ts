import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, wearLogItems, wearLogs } from '@/db/schema';
import { applyItemStatus } from '@/features/items/mutations';
import { newId } from '@/lib/ids';
import { toDayKey } from '@/lib/dates';

import { wearCacheFromDays } from './wearCache';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Recomputes the cached wearCount / lastWornAt for one item from its live logs. */
export function refreshWearCache(tx: Tx, itemId: string) {
  const days = tx
    .select({ date: wearLogs.date })
    .from(wearLogItems)
    .innerJoin(wearLogs, and(eq(wearLogs.id, wearLogItems.wearLogId), isNull(wearLogs.deletedAt)))
    .where(and(eq(wearLogItems.itemId, itemId), isNull(wearLogItems.deletedAt)))
    .all();
  tx.update(items)
    .set(wearCacheFromDays(days.map((d) => d.date)))
    .where(eq(items.id, itemId))
    .run();
}

function todaysLogIds(tx: Tx, now: Date): string[] {
  return tx
    .select({ id: wearLogs.id })
    .from(wearLogs)
    .where(and(eq(wearLogs.date, toDayKey(now)), isNull(wearLogs.deletedAt)))
    .all()
    .map((r) => r.id);
}

/**
 * "Wear today": adds the piece to today's wear log (creating the log if
 * needed), refreshes its wear cache and marks it as worn.
 */
export function logWearToday(itemId: string, now = new Date()): 'logged' | 'already' {
  return db.transaction((tx) => {
    let logId = todaysLogIds(tx, now)[0];
    if (!logId) {
      logId = newId();
      tx.insert(wearLogs).values({ id: logId, date: toDayKey(now) }).run();
    }
    const link = tx
      .select({ id: wearLogItems.id, deletedAt: wearLogItems.deletedAt })
      .from(wearLogItems)
      .where(and(eq(wearLogItems.wearLogId, logId), eq(wearLogItems.itemId, itemId)))
      .get();
    if (link && !link.deletedAt) return 'already';
    // The (log, item) pair is unique, so a soft-deleted link is revived rather than re-inserted.
    if (link) tx.update(wearLogItems).set({ deletedAt: null }).where(eq(wearLogItems.id, link.id)).run();
    else tx.insert(wearLogItems).values({ id: newId(), wearLogId: logId, itemId }).run();

    refreshWearCache(tx, itemId);
    applyItemStatus(tx, itemId, 'worn', now);
    return 'logged';
  });
}

/** Undo "Wear today": removes the piece from today's logs and drops a log left empty. */
export function unlogWearToday(itemId: string, now = new Date()) {
  db.transaction((tx) => {
    const logIds = todaysLogIds(tx, now);
    if (logIds.length === 0) return;
    const deletedAt = new Date();
    tx.update(wearLogItems)
      .set({ deletedAt })
      .where(
        and(inArray(wearLogItems.wearLogId, logIds), eq(wearLogItems.itemId, itemId), isNull(wearLogItems.deletedAt)),
      )
      .run();
    for (const logId of logIds) {
      const remaining = tx
        .select({ id: wearLogItems.id })
        .from(wearLogItems)
        .where(and(eq(wearLogItems.wearLogId, logId), isNull(wearLogItems.deletedAt)))
        .get();
      if (!remaining) tx.update(wearLogs).set({ deletedAt }).where(eq(wearLogs.id, logId)).run();
    }
    refreshWearCache(tx, itemId);
    const status = tx.select({ status: items.status }).from(items).where(eq(items.id, itemId)).get()?.status;
    if (status === 'worn') applyItemStatus(tx, itemId, 'in_wardrobe', now);
  });
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

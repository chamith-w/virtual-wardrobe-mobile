/**
 * The status state machine. Every status write — the switcher, the basket,
 * wash done, "Wear today", moves between wardrobes, archiving — is planned
 * here first, so the rules and their side effects live in one place.
 * Pure — safe to import from tests.
 */
import type { ItemStatus } from './catalog';
import {
  applyStatus,
  firstStorageWardrobe,
  homeWardrobe,
  moveToWardrobe,
  statusInWardrobe,
  type PlacedItem,
  type PlacementPatch,
  type WardrobeLite,
  type ZoneLite,
  zoneFor,
} from './placement';
import type { StatusExtra } from './status';

/**
 * Why a move is refused:
 *  - unchanged: it already has that status (or is already in that wardrobe)
 *  - archived: archived pieces have left; nothing changes them
 *  - needs_reason: archiving needs donated / sold / discarded
 *  - no_storage: "In storage" with no storage wardrobe to put it in
 *  - in_wash / at_cleaner / with_borrower: it isn't here, so it can't be
 *    worn, stored or lent until it comes back
 */
export type Refusal =
  'unchanged' | 'archived' | 'needs_reason' | 'no_storage' | 'in_wash' | 'at_cleaner' | 'with_borrower';

/** Statuses that can't be reached while the piece is away, per where it is. */
const BLOCKED_WHILE_AWAY: Partial<Record<ItemStatus, { refusal: Refusal; blocks: readonly ItemStatus[] }>> = {
  laundry: { refusal: 'in_wash', blocks: ['worn', 'lent', 'storage'] },
  dry_cleaner: { refusal: 'at_cleaner', blocks: ['worn', 'lent', 'storage'] },
  lent: { refusal: 'with_borrower', blocks: ['worn', 'storage'] },
};

/** The transition table: null when `from → to` is allowed. */
export function transitionRefusal(from: ItemStatus, to: ItemStatus, extra: StatusExtra = {}): Refusal | null {
  if (from === 'archived') return 'archived';
  if (from === to) return 'unchanged';
  if (to === 'archived') return extra.archivedReason ? null : 'needs_reason';
  const away = BLOCKED_WHILE_AWAY[from];
  if (away?.blocks.includes(to)) return away.refusal;
  return null;
}

/** A one-line explanation for a refused move, for the warning toast. */
export function refusalMessage(
  refusal: Refusal,
  item: { name: string; lentTo: string | null },
  to: ItemStatus,
): string {
  switch (refusal) {
    case 'unchanged':
      return 'Nothing to change';
    case 'archived':
      return 'Archived pieces stay archived';
    case 'needs_reason':
      return 'Choose why it’s leaving';
    case 'no_storage':
      return 'Make a storage wardrobe first';
    case 'in_wash':
      if (to === 'worn') return `${item.name} is in the wash`;
      return to === 'storage' ? 'Wash it before it goes into storage' : 'Wash it before you lend it';
    case 'at_cleaner':
      return to === 'worn' ? `${item.name} is at the dry cleaner` : 'Collect it from the cleaner first';
    case 'with_borrower': {
      const who = item.lentTo?.trim() || 'your friend';
      return to === 'worn' ? `${item.lentTo?.trim() || 'Someone else'} has it` : `Get it back from ${who} first`;
    }
  }
}

export type PlacementContext = { wardrobes: readonly WardrobeLite[]; zones: readonly ZoneLite[] };

export type StatusPlan =
  | {
      ok: true;
      /** Only the columns that change. */
      patch: Partial<PlacementPatch>;
      /** The piece left "lent": its reminder notification must go. */
      cancelReminder: boolean;
    }
  | { ok: false; refusal: Refusal };

function changedFields(item: PlacedItem, patch: PlacementPatch): Partial<PlacementPatch> {
  const out: Partial<PlacementPatch> = {};
  const before = item as Partial<PlacementPatch>;
  for (const key of Object.keys(patch) as (keyof PlacementPatch)[]) {
    const a = before[key];
    const b = patch[key];
    const same = a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
    if (!same) (out as Record<string, unknown>)[key] = b;
  }
  return out;
}

function planned(item: PlacedItem, patch: PlacementPatch): StatusPlan {
  return {
    ok: true,
    patch: changedFields(item, patch),
    cancelReminder: item.status === 'lent' && patch.status !== 'lent',
  };
}

/** Plans a status change: refusal, or the columns to write and what to clean up. */
export function planStatus(
  item: PlacedItem,
  next: ItemStatus,
  ctx: PlacementContext,
  now: Date,
  extra: StatusExtra = {},
): StatusPlan {
  const refusal = transitionRefusal(item.status, next, extra);
  if (refusal) return { ok: false, refusal };
  if (next === 'storage' && !firstStorageWardrobe(ctx.wardrobes)) return { ok: false, refusal: 'no_storage' };
  return planned(item, applyStatus(item, next, ctx.wardrobes, ctx.zones, now, extra));
}

/** Plans a move to another wardrobe; entering or leaving storage changes status, so it obeys the table too. */
export function planMove(item: PlacedItem, wardrobeId: string, ctx: PlacementContext, now: Date): StatusPlan {
  if (item.status === 'archived') return { ok: false, refusal: 'archived' };
  if (item.wardrobeId === wardrobeId) return { ok: false, refusal: 'unchanged' };
  const target = ctx.wardrobes.find((w) => w.id === wardrobeId);
  const next = statusInWardrobe(item.status, target);
  if (next !== item.status) {
    const refusal = transitionRefusal(item.status, next);
    if (refusal) return { ok: false, refusal };
  }
  return planned(item, moveToWardrobe(item, wardrobeId, ctx.wardrobes, ctx.zones, now));
}

export type BatchPlan = {
  /** One entry per distinct patch, so identical changes share a single UPDATE. */
  updates: { ids: string[]; patch: Partial<PlacementPatch> }[];
  refused: { id: string; refusal: Refusal }[];
  /** Ids whose lend reminder must be cancelled. */
  cancelReminders: string[];
};

function patchKey(patch: Partial<PlacementPatch>): string {
  return JSON.stringify(
    Object.entries(patch)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v instanceof Date ? v.getTime() : v]),
  );
}

/**
 * Plans the same change for many pieces (wash done, a bulk move). Pieces with
 * identical patches are grouped: returning a basket of laundry is one UPDATE.
 */
export function planBatch(
  items: readonly (PlacedItem & { id: string })[],
  plan: (item: PlacedItem) => StatusPlan,
): BatchPlan {
  const groups = new Map<string, { ids: string[]; patch: Partial<PlacementPatch> }>();
  const refused: BatchPlan['refused'] = [];
  const cancelReminders: string[] = [];
  for (const item of items) {
    const result = plan(item);
    if (!result.ok) {
      refused.push({ id: item.id, refusal: result.refusal });
      continue;
    }
    if (result.cancelReminder) cancelReminders.push(item.id);
    const key = patchKey(result.patch);
    const group = groups.get(key);
    if (group) group.ids.push(item.id);
    else groups.set(key, { ids: [item.id], patch: result.patch });
  }
  return { updates: [...groups.values()], refused, cancelReminders };
}

/**
 * A wardrobe is being deleted: every piece in it moves to `targetId`. Pieces
 * the table won't let in there (a lent dress can't go into storage) go to the
 * first everyday wardrobe instead, so nothing is ever left behind. `ctx` must
 * no longer contain the deleted wardrobe.
 */
export function planRehome(
  items: readonly (PlacedItem & { id: string })[],
  targetId: string,
  ctx: PlacementContext,
  now: Date,
): BatchPlan {
  const home = homeWardrobe(ctx.wardrobes);
  return planBatch(items, (item) => {
    if (item.status === 'archived') {
      // Archived pieces keep their status but still need a wardrobe to belong to.
      const zoneId = zoneFor(ctx.zones, targetId, item.category);
      return { ok: true, patch: { wardrobeId: targetId, zoneId }, cancelReminder: false };
    }
    const direct = planMove(item, targetId, ctx, now);
    if (direct.ok || !home || home.id === targetId) return direct;
    return planMove(item, home.id, ctx, now);
  });
}

/**
 * A wardrobe's kind changes. Becoming storage stores what hangs in it, and
 * sends anything that's out (lent, in the wash) back to the first everyday
 * wardrobe; becoming a wardrobe puts its stored pieces back in use. `ctx`
 * describes the wardrobes after the change. Pieces with nothing to change
 * are left out of the plan.
 */
export function planKindChange(
  items: readonly (PlacedItem & { id: string })[],
  becomesStorage: boolean,
  ctx: PlacementContext,
  now: Date,
): BatchPlan {
  const home = homeWardrobe(ctx.wardrobes);
  const plan = planBatch(items, (item) => {
    if (!becomesStorage) {
      return item.status === 'storage'
        ? planStatus(item, 'in_wardrobe', ctx, now)
        : { ok: false, refusal: 'unchanged' };
    }
    const stored = planStatus(item, 'storage', ctx, now);
    if (stored.ok || stored.refusal === 'unchanged' || stored.refusal === 'archived' || !home) return stored;
    return planMove(item, home.id, ctx, now);
  });
  // Already in the right state (or archived): nothing to report.
  return {
    ...plan,
    refused: plan.refused.filter((r) => r.refusal !== 'unchanged' && r.refusal !== 'archived'),
  };
}

/**
 * User-facing item actions: the write (through the status service) plus its
 * confirmation toast, so the quick sheet, detail, laundry and grid all feel
 * identical. Refused moves explain themselves with a warning tick.
 */
import { backLine, washedLine } from '@/features/laundry/copy';
import { logWearToday, unlogWearToday } from '@/features/planner/wearLog';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';

import { STATUS_LABEL, type ItemStatus, type ZoneType } from './catalog';
import { moveItemToZone } from './mutations';
import type { StatusExtra } from './status';
import { moveItemsToWardrobe, setItemsStatus, setItemStatus } from './statusService';
import { refusalMessage, type BatchPlan, type StatusPlan } from './transitions';

type Named = { id: string; name: string; lentTo?: string | null };

function refused(plan: StatusPlan | null, item: Named, next: ItemStatus): boolean {
  if (!plan) return true;
  if (plan.ok) return false;
  if (plan.refusal !== 'unchanged') {
    haptics.warning();
    toast(refusalMessage(plan.refusal, { name: item.name, lentTo: item.lentTo ?? null }, next), 'info');
  }
  return true;
}

const STATUS_TOAST: Partial<Record<ItemStatus, string>> = {
  worn: 'marked as worn',
  laundry: 'is in the basket',
  dry_cleaner: 'is off to the dry cleaner',
  lent: 'is lent out',
  storage: 'is in storage',
};

/** From the status switcher. */
export function changeItemStatus(item: Named, next: ItemStatus, extra?: StatusExtra): boolean {
  const plan = setItemStatus(item.id, next, extra);
  if (refused(plan, item, next)) return false;
  const verb = STATUS_TOAST[next];
  toast(verb ? `${item.name} ${verb}` : `${item.name} · ${STATUS_LABEL[next].toLowerCase()}`);
  return true;
}

/** The one-tap return for a piece that's out: "Stone trench is back on the rail". */
export function backInWardrobe(item: Named, zoneType?: ZoneType | null): boolean {
  const plan = setItemStatus(item.id, 'in_wardrobe');
  if (refused(plan, item, 'in_wardrobe')) return false;
  toast(backLine(item.name, zoneType));
  return true;
}

/** Into the basket: by drag (with the drop haptic) or the accessible "Send to laundry". */
export function sendToLaundry(item: Named, how: 'drop' | 'tap' = 'tap'): boolean {
  const plan = setItemStatus(item.id, 'laundry', undefined, {
    haptic: how === 'drop' ? 'dropSuccess' : 'statusChanged',
  });
  if (refused(plan, item, 'laundry')) return false;
  toast(`${item.name} is in the basket`);
  return true;
}

function batchToast(plan: BatchPlan, done: (n: number) => string, items: readonly Named[], next: ItemStatus) {
  const moved = plan.updates.reduce((n, u) => n + u.ids.length, 0);
  const first = plan.refused[0];
  if (moved === 0 && first) {
    const item = items.find((i) => i.id === first.id);
    haptics.warning();
    toast(refusalMessage(first.refusal, { name: item?.name ?? 'It', lentTo: item?.lentTo ?? null }, next), 'info');
    return;
  }
  const skipped = plan.refused.filter((r) => r.refusal !== 'unchanged').length;
  toast(skipped > 0 ? `${done(moved)} · ${skipped} stayed put` : done(moved));
}

/** Wash done: the whole basket back in one transaction. */
export function washDone(items: readonly Named[]): BatchPlan {
  const plan = setItemsStatus(
    items.map((i) => i.id),
    'in_wardrobe',
  );
  batchToast(plan, washedLine, items, 'in_wardrobe');
  return plan;
}

/** Selected pieces in the grid into the basket. */
export function sendManyToLaundry(items: readonly Named[]): BatchPlan {
  const plan = setItemsStatus(
    items.map((i) => i.id),
    'laundry',
  );
  batchToast(plan, (n) => (n === 1 ? '1 piece in the basket' : `${n} pieces in the basket`), items, 'laundry');
  return plan;
}

/** "Move to…" for one or many pieces. */
export function moveToWardrobe(items: readonly Named[], wardrobe: { id: string; name: string }): BatchPlan {
  const plan = moveItemsToWardrobe(
    items.map((i) => i.id),
    wardrobe.id,
  );
  const next: ItemStatus = 'storage';
  batchToast(
    plan,
    (n) =>
      items.length === 1
        ? `Moved to ${wardrobe.name}`
        : `${n} ${n === 1 ? 'piece' : 'pieces'} moved to ${wardrobe.name}`,
    items,
    next,
  );
  return plan;
}

export function toggleWearToday(item: Named & { wearCount: number }, wornToday: boolean) {
  haptics.statusChanged();
  if (wornToday) {
    unlogWearToday(item.id);
    toast('Taken off today’s log', 'info');
    return;
  }
  const result = logWearToday(item.id);
  toast(result === 'already' ? 'Already logged for today' : `Logged for today · worn ${item.wearCount + 1}×`);
}

export function moveToZone(item: Named, zone: { id: string; name: string }) {
  moveItemToZone(item.id, zone.id);
  haptics.dropSuccess();
  toast(`${item.name} · moved to ${zone.name}`);
}

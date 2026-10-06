/**
 * User-facing item actions: the write plus its haptic and confirmation toast,
 * so the quick sheet and the detail screen feel identical.
 */
import { logWearToday, unlogWearToday } from '@/features/planner/wearLog';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';

import { STATUS_LABEL, type ItemStatus } from './catalog';
import { moveItemToWardrobe, moveItemToZone, setItemStatus } from './mutations';

type Named = { id: string; name: string };

export function changeItemStatus(item: Named, next: ItemStatus) {
  if (!setItemStatus(item.id, next)) return;
  haptics.statusChanged();
  toast(`${item.name} · ${STATUS_LABEL[next].toLowerCase()}`);
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

export function moveToWardrobe(item: Named, wardrobe: { id: string; name: string }) {
  if (!moveItemToWardrobe(item.id, wardrobe.id)) return;
  haptics.statusChanged();
  toast(`Moved to ${wardrobe.name}`);
}

export function moveToZone(item: Named, zone: { id: string; name: string }) {
  moveItemToZone(item.id, zone.id);
  haptics.dropSuccess();
  toast(`${item.name} · moved to ${zone.name}`);
}

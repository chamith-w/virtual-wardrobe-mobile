/**
 * The one way to change where a piece is: every status write in the app goes
 * through here (or, inside a larger transaction, through `applyItemStatus`).
 * It enforces the transition table (transitions.ts), writes the fields that
 * follow (lent name and date, drop-off date, storage moves), fires the
 * `statusChanged` haptic and cancels a lend reminder when the piece comes back.
 */
import { db } from '@/db/client';
import {
  cancelLocal,
  ensureNotificationPermission,
  scheduleLocal,
  type NotificationPermission,
} from '@/lib/notifications';
import { haptics, type HapticName } from '@/lib/haptics';

import type { ArchiveReason, ItemStatus } from './catalog';
import { applyItemsStatus, applyItemStatus, moveItemsInto, setLentTo, setRemindAt } from './mutations';
import { reminderContent, reminderId } from './reminders';
import type { StatusExtra } from './status';
import type { BatchPlan, StatusPlan } from './transitions';

type Options = {
  /** The basket uses `dropSuccess`; quiet callers pass 'none'. */
  haptic?: HapticName | 'none';
};

function cleanUp(cancel: readonly string[]) {
  for (const id of cancel) void cancelLocal(reminderId(id));
}

function feel(haptic: HapticName | 'none' = 'statusChanged') {
  if (haptic !== 'none') haptics[haptic]();
}

/** Sets one piece's status. Returns the plan (refused or applied), or null if the piece doesn't exist. */
export function setItemStatus(
  itemId: string,
  status: ItemStatus,
  extra?: StatusExtra,
  options: Options = {},
): StatusPlan | null {
  const plan = db.transaction((tx) => applyItemStatus(tx, itemId, status, new Date(), extra));
  if (plan?.ok) {
    feel(options.haptic);
    if (plan.cancelReminder) cleanUp([itemId]);
  }
  return plan;
}

/** The same status for many pieces in one transaction (wash done, bulk actions). One haptic. */
export function setItemsStatus(
  ids: readonly string[],
  status: ItemStatus,
  extra?: StatusExtra,
  options: Options = {},
): BatchPlan {
  const plan = db.transaction((tx) => applyItemsStatus(tx, ids, status, new Date(), extra));
  if (plan.updates.length > 0) feel(options.haptic);
  cleanUp(plan.cancelReminders);
  return plan;
}

/** Moves one or many pieces to another wardrobe (storage in, storage out). One haptic. */
export function moveItemsToWardrobe(ids: readonly string[], wardrobeId: string, options: Options = {}): BatchPlan {
  const plan = db.transaction((tx) => moveItemsInto(tx, ids, wardrobeId));
  if (plan.updates.length > 0) feel(options.haptic);
  cleanUp(plan.cancelReminders);
  return plan;
}

/** Archives as donated, sold or discarded; wear history stays for Insights. */
export function archiveItem(itemId: string, reason: ArchiveReason, note: string): StatusPlan | null {
  return setItemStatus(itemId, 'archived', { archivedReason: reason, archivedNote: note });
}

type LentPiece = { id: string; name: string; lentTo: string | null; lentAt: Date | null };

export type ReminderResult = 'on' | 'off' | Exclude<NotificationPermission, 'granted'>;

/**
 * Switches "Remind me to ask for it back" on (at `at`) or off. The first time
 * it's switched on, the system asks for notification permission.
 */
export async function setLendReminder(item: LentPiece, at: Date | null): Promise<ReminderResult> {
  if (!at) {
    setRemindAt(item.id, null);
    await cancelLocal(reminderId(item.id));
    return 'off';
  }
  const permission = await ensureNotificationPermission();
  if (permission !== 'granted') return permission;
  await scheduleLocal(reminderId(item.id), at, reminderContent(item, at));
  setRemindAt(item.id, at);
  return 'on';
}

/** Renames the borrower, rewording a pending reminder ("Ask Nadia…") to match. */
export function renameBorrower(item: LentPiece & { remindAt: Date | null }, name: string) {
  setLentTo(item.id, name);
  if (item.remindAt && item.remindAt > new Date()) {
    const renamed = { ...item, lentTo: name.trim() || null };
    void scheduleLocal(reminderId(item.id), item.remindAt, reminderContent(renamed, item.remindAt)).catch(() => {});
  }
}

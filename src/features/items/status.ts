/**
 * Item status rules: tag labels and tones for empty hangers, and the field
 * changes that go with a status switch. Pure — safe to import from tests.
 */
import type { ColorToken } from '@/theme/tokens';
import { cleanName } from '@/lib/text';

import { OUT_STATUSES, type ArchiveReason, type ItemStatus } from './catalog';

/** Dot / tag colour per status (docs/DESIGN.md → "Empty hangers"). */
export const STATUS_TONE: Record<ItemStatus, ColorToken> = {
  in_wardrobe: 'success',
  worn: 'warning',
  laundry: 'accentSecondary',
  dry_cleaner: 'faint',
  lent: 'accent',
  storage: 'muted',
  archived: 'danger',
};

/** The statuses offered by the status switcher, in display order. */
export const SWITCHABLE_STATUSES: readonly ItemStatus[] = [
  'in_wardrobe',
  'worn',
  'laundry',
  'dry_cleaner',
  'lent',
  'storage',
];

const TAG_LABEL: Record<ItemStatus, string> = {
  in_wardrobe: 'In wardrobe',
  worn: 'Worn',
  laundry: 'Laundry',
  dry_cleaner: 'Dry cleaner',
  lent: 'Lent',
  storage: 'Storage',
  archived: 'Archived',
};

/** Short label for the pill on an empty hanger, e.g. "Laundry" or "Lent · Nadia". */
export function statusTagLabel(status: ItemStatus, lentTo?: string | null): string {
  const name = lentTo?.trim();
  if (status === 'lent' && name) return `Lent · ${name}`;
  return TAG_LABEL[status];
}

/** True when the garment has physically left its spot (empty hanger + tag). */
export function isOut(status: ItemStatus): boolean {
  return OUT_STATUSES.includes(status);
}

/** The status-related columns of an item. */
export type StatusState = {
  status: ItemStatus;
  statusChangedAt: Date | null;
  lentTo: string | null;
  lentAt: Date | null;
  remindAt: Date | null;
  readyAt: Date | null;
};

/** What a caller can pass along with a status: who borrowed it, when it's ready, why it left. */
export type StatusExtra = {
  lentTo?: string | null;
  readyAt?: Date | null;
  archivedReason?: ArchiveReason;
  archivedNote?: string | null;
};

export type StatusFields = StatusState & {
  archivedReason?: ArchiveReason | null;
  archivedNote?: string | null;
};

export const LENT_TO_MAX = 40;

function lendFields(
  current: StatusState,
  next: ItemStatus,
  now: Date,
  extra: StatusExtra,
): Pick<StatusState, 'lentTo' | 'lentAt' | 'remindAt'> {
  if (next !== 'lent') return { lentTo: null, lentAt: null, remindAt: null };
  const name = extra.lentTo === undefined ? current.lentTo : cleanName(extra.lentTo ?? '', LENT_TO_MAX);
  if (current.status !== 'lent') return { lentTo: name, lentAt: now, remindAt: null };
  return { lentTo: name, lentAt: current.lentAt ?? now, remindAt: current.remindAt };
}

function readyFor(current: StatusState, next: ItemStatus, extra: StatusExtra): Date | null {
  if (next !== 'dry_cleaner') return null;
  if (extra.readyAt !== undefined) return extra.readyAt;
  return current.status === 'dry_cleaner' ? current.readyAt : null;
}

/**
 * Every column that follows a status change:
 *  - any change stamps `statusChangedAt` (for the dry cleaner, the drop-off);
 *  - becoming lent stamps `lentAt` and takes the borrower's name (keeping one
 *    already entered); leaving lent clears the name, date and reminder;
 *  - the dry cleaner's ready date lives only while it's there;
 *  - archiving records the reason.
 * Staying in the same status keeps everything (a move between wardrobes).
 */
export function statusFields(current: StatusState, next: ItemStatus, now: Date, extra: StatusExtra = {}): StatusFields {
  const fields: StatusFields = {
    status: next,
    statusChangedAt: next === current.status ? current.statusChangedAt : now,
    ...lendFields(current, next, now, extra),
    readyAt: readyFor(current, next, extra),
  };
  if (next === 'archived') {
    fields.archivedReason = extra.archivedReason ?? null;
    fields.archivedNote = extra.archivedNote?.trim() || null;
  }
  return fields;
}

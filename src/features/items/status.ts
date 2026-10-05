/**
 * Item status rules: tag labels and tones for empty hangers, and the field
 * changes that go with a status switch. Pure — safe to import from tests.
 */
import type { ColorToken } from '@/theme/tokens';

import { OUT_STATUSES, type ItemStatus } from './catalog';

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

export type LendState = { status: ItemStatus; lentTo: string | null; lentAt: Date | null };

/**
 * Lending fields that follow a status change: becoming "lent" stamps the date
 * (keeping any name already entered); leaving "lent" clears both.
 */
export function lendingFor(current: LendState, next: ItemStatus, now: Date): Pick<LendState, 'lentTo' | 'lentAt'> {
  if (next === 'lent') {
    if (current.status === 'lent') return { lentTo: current.lentTo, lentAt: current.lentAt ?? now };
    return { lentTo: current.lentTo, lentAt: now };
  }
  return { lentTo: null, lentAt: null };
}

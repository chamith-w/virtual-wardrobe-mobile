/**
 * What logging (or un-logging) a wear does to a piece's status. Only today's
 * log moves pieces: logging last Tuesday counts the wear and updates the
 * cache, but whatever the piece is doing now stays as it is. The transition
 * table (items/transitions.ts) still has the final word: a piece in the wash
 * keeps the wear and stays in the wash. Pure — safe to import from tests.
 */
import type { Category, ItemStatus } from '@/features/items/catalog';
import type { DayKey } from '@/lib/dates';
import type { AutoLaundryOverrides } from '@/store/preferences';

import { laundryDue, wearsSinceWash } from './autoLaundry';

export type WornPiece = {
  category: Category;
  status: ItemStatus;
  washedAt: Date | null;
  /** Every day it's logged as worn, the new one included. */
  wearDays: readonly DayKey[];
};

/** Worn, or straight to the basket when the auto-laundry rule says so; null leaves it be. */
export function statusAfterWear(
  piece: WornPiece,
  day: DayKey,
  today: DayKey,
  rules: AutoLaundryOverrides = {},
): 'worn' | 'laundry' | null {
  if (day !== today) return null;
  return laundryDue(piece.category, wearsSinceWash(piece.wearDays, piece.washedAt), rules) ? 'laundry' : 'worn';
}

/** Taken off today's log: a worn piece goes back on its hanger. One already in the basket stays there. */
export function statusAfterUnwear(status: ItemStatus, day: DayKey, today: DayKey): 'in_wardrobe' | null {
  return day === today && status === 'worn' ? 'in_wardrobe' : null;
}

/** The toast after logging: "Logged · 5 pieces marked worn · 2 in the basket". */
export function logToast(result: { added: number; worn: number; laundry: number; already: boolean }): string {
  if (result.added === 0) return result.already ? 'Already logged for that day' : 'Log saved';
  const pieces = `${result.added} ${result.added === 1 ? 'piece' : 'pieces'}`;
  if (result.laundry > 0) return `Logged · ${pieces} +1 wear · ${result.laundry} in the basket`;
  if (result.worn > 0) return `Logged · ${pieces} marked worn`;
  return `Logged · ${pieces} +1 wear`;
}

/** The note under the log sheet's pieces: what each piece gets, and which go to the basket. */
export function logCaption(names: { due: readonly string[]; isToday: boolean }): string {
  if (!names.isToday) return 'Each piece gets +1 wear. Where it is now stays as it is.';
  const head = 'Each piece gets +1 wear and is marked Worn.';
  const due = names.due;
  if (due.length === 0) return `${head} Nothing’s due a wash yet.`;
  const list = due.length <= 2 ? due.join(' and ') : `${due.slice(0, 2).join(', ')} and ${due.length - 2} more`;
  return `${head} ${list} ${due.length === 1 ? 'goes' : 'go'} straight to the laundry.`;
}

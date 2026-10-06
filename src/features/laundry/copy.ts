/**
 * Copy for the laundry, lent and dry-cleaner lists. Pure — safe to import from tests.
 */
import type { ZoneType } from '@/features/items/catalog';
import { daysBetween, formatShortDay, formatWeekdayDay } from '@/lib/dates';

/** Lent this long, a piece is highlighted. */
export const LENT_OVERDUE_DAYS = 14;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export type LentAge = { days: number; overdue: boolean; line: string };

/** "21 days · reminder Fri 20 Oct", highlighted after two weeks. */
export function lentAge(lentAt: Date | null, remindAt: Date | null, now: Date): LentAge {
  const days = lentAt ? Math.max(0, daysBetween(lentAt, now)) : 0;
  const age = days === 0 ? 'Lent today' : plural(days, 'day');
  let reminder = '';
  if (remindAt) {
    reminder = remindAt > now ? ` · reminder ${formatWeekdayDay(remindAt)}` : ` · reminded ${formatShortDay(remindAt)}`;
  }
  return { days, overdue: days >= LENT_OVERDUE_DAYS, line: `${age}${reminder}` };
}

export type CleanerInfo = {
  dropped: string;
  /** Second line: the ready date, or how long it's been there. */
  line: string;
  /** "ready" once the ready day has come. */
  tone: 'muted' | 'success';
  /** 0 → 1 from drop-off to the ready day; null without a ready date. */
  progress: number | null;
};

export function cleanerInfo(droppedAt: Date | null, readyAt: Date | null, now: Date): CleanerInfo {
  const dropped = droppedAt ? `Dropped off ${formatWeekdayDay(droppedAt)}` : 'At the cleaner';
  if (!readyAt) {
    const days = droppedAt ? Math.max(0, daysBetween(droppedAt, now)) : null;
    let line = 'No ready date yet';
    if (days === 0) line = 'Dropped off today';
    else if (days !== null) line = `${plural(days, 'day')} at the cleaner`;
    return { dropped, line, tone: 'muted', progress: null };
  }
  const left = daysBetween(now, readyAt);
  let line = `Ready ${formatWeekdayDay(readyAt)} · in ${plural(left, 'day')}`;
  if (left === 1) line = 'Ready tomorrow';
  if (left === 0) line = 'Ready to collect today';
  if (left < 0) line = `Ready since ${formatWeekdayDay(readyAt)}`;

  let progress = left <= 0 ? 1 : 0;
  if (droppedAt && left > 0) {
    const span = readyAt.getTime() - droppedAt.getTime();
    progress = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - droppedAt.getTime()) / span)) : 1;
  }
  return { dropped, line, tone: left <= 0 ? 'success' : 'muted', progress };
}

const BACK_SPOT: Record<ZoneType, string> = {
  rail: 'back on the rail',
  shelf: 'back on the shelf',
  drawer: 'back in its drawer',
  shoes: 'back on the rack',
  accessories: 'back in the tray',
};

/** "Stone trench is back on the rail". */
export function backLine(name: string, zone: ZoneType | null | undefined): string {
  return `${name} is ${zone ? BACK_SPOT[zone] : 'back in your wardrobe'}`;
}

/** "6 pieces back in your wardrobe". */
export function washedLine(count: number): string {
  return count === 1 ? '1 piece back in your wardrobe' : `${count} pieces back in your wardrobe`;
}

/** Under the basket: "4 pieces in the wash". */
export function pileLine(count: number): string {
  return count === 0 ? 'Everything’s clean and back where it lives.' : `${plural(count, 'piece')} in the wash`;
}

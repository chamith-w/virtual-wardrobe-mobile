/**
 * The Planner's calendar (Planner.dc.html): a week strip that opens into the
 * month, Monday first, with the neighbouring months' days filling the edge
 * weeks. Pure — safe to import from tests.
 */
import type { ItemColor } from '@/db/schema';
import { CATEGORY_ROLE, type Category } from '@/features/items/catalog';
import { addDays, daysBetween, fromDayKey, isSameDay, startOfDay, toDayKey, type DayKey } from '@/lib/dates';

/** A day cell is 56 tall with 4 between rows. */
export const CELL_HEIGHT = 56;
export const ROW_HEIGHT = 60;

export function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The first day of the week holding `day`. */
export function weekStart(day: Date, weekStartsOn = 1): Date {
  const d = startOfDay(day);
  return addDays(d, -((d.getDay() - weekStartsOn + 7) % 7));
}

/** Rows of seven covering the month; every cell is a real day. */
export function calendarRows(month: Date, weekStartsOn = 1): Date[][] {
  const first = firstOfMonth(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const rows: Date[][] = [];
  for (let start = weekStart(first, weekStartsOn); start <= last; start = addDays(start, 7)) {
    rows.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return rows;
}

/** The row holding `day`, or -1. */
export function rowOf(rows: readonly Date[][], day: Date): number {
  return rows.findIndex((r) => r.some((d) => isSameDay(d, day)));
}

/**
 * Which month a week shows under: the selected day's, when it's in the week;
 * otherwise the month most of the week falls in (its Thursday's).
 */
export function monthOfWeek(start: Date, selected: Date): Date {
  const end = addDays(start, 6);
  if (selected >= start && selected <= end) return firstOfMonth(selected);
  return firstOfMonth(addDays(start, 3));
}

/** Moving the week strip by `weeks`: the new month and row to show. */
export function stepWeek(
  rows: readonly Date[][],
  row: number,
  weeks: number,
  selected: Date,
): { month: Date; row: number } {
  const start = addDays(rows[Math.max(0, Math.min(row, rows.length - 1))]![0]!, weeks * 7);
  const month = monthOfWeek(start, selected);
  return { month, row: Math.max(0, rowOf(calendarRows(month), start)) };
}

export type DayKind = 'today' | 'journal' | 'planned' | 'free' | 'past';

/** A day with a log is a journal page; otherwise it depends on when it is and whether it's planned. */
export function dayKind(day: DayKey, today: DayKey, hasLog: boolean, hasPlan: boolean): DayKind {
  if (hasLog) return 'journal';
  if (day === today) return 'today';
  if (day < today) return 'past';
  return hasPlan ? 'planned' : 'free';
}

/** The eyebrow over the selected day, and its tone. */
export function kindLabel(kind: DayKind, isToday: boolean): { label: string; tone: 'success' | 'accent' | 'muted' } {
  switch (kind) {
    case 'journal':
      return { label: isToday ? 'Worn today' : 'Outfit journal', tone: 'success' };
    case 'today':
      return { label: 'Today', tone: 'accent' };
    case 'planned':
      return { label: 'Planned', tone: 'muted' };
    case 'free':
      return { label: 'Free day', tone: 'muted' };
    case 'past':
      return { label: 'Past', tone: 'muted' };
  }
}

const DOT_ROLES = ['one_piece', 'top', 'bottom', 'layer'] as const;

/** Up to three dots for a planned day: the main pieces' colours, top to toe. */
export function dotColors(pieces: readonly { category: Category; colors: readonly ItemColor[] }[]): string[] {
  const ranked = [...pieces].sort((a, b) => {
    const ra = DOT_ROLES.indexOf(CATEGORY_ROLE[a.category] as (typeof DOT_ROLES)[number]);
    const rb = DOT_ROLES.indexOf(CATEGORY_ROLE[b.category] as (typeof DOT_ROLES)[number]);
    return (ra < 0 ? 9 : ra) - (rb < 0 ? 9 : rb);
  });
  return ranked.flatMap((p) => (p.colors[0] ? [p.colors[0].hex] : [])).slice(0, 3);
}

/** "Wednesday 7 October, planned: Ecru & navy" for screen readers. */
export function dayLabel(
  day: Date,
  flags: { today: boolean; worn: boolean; planned: string | null; trip: string | null },
  locale?: string,
): string {
  const parts = [day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })];
  if (flags.today) parts.push('today');
  if (flags.worn) parts.push('worn');
  if (flags.planned) parts.push(`planned: ${flags.planned}`);
  if (flags.trip) parts.push(`${flags.trip} trip`);
  return parts.join(', ');
}

/** The trip a day falls in, if any. */
export function tripOn<T extends { startDate: DayKey; endDate: DayKey }>(day: DayKey, trips: readonly T[]): T | null {
  return trips.find((t) => day >= t.startDate && day <= t.endDate) ?? null;
}

/** "Day 2 of 5" of a trip. */
export function tripDayLabel(day: DayKey, trip: { startDate: DayKey; endDate: DayKey }): string {
  const start = fromDayKey(trip.startDate);
  const n = daysBetween(start, fromDayKey(day)) + 1;
  const total = daysBetween(start, fromDayKey(trip.endDate)) + 1;
  return `Day ${n} of ${total}`;
}

/** The visible range to load plans and logs for: the month's rows, a week either side. */
export function loadRange(rows: readonly Date[][], selected: DayKey): { from: DayKey; to: DayKey } {
  const from = toDayKey(addDays(rows[0]![0]!, -7));
  const to = toDayKey(addDays(rows[rows.length - 1]![6]!, 7));
  return { from: selected < from ? selected : from, to: selected > to ? selected : to };
}

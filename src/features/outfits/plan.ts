/**
 * Copy for planning an outfit on a day (the hand-off to the planner).
 * Pure — safe to import from tests.
 */
import type { DatePreset } from '@/components/ui/DatePickerSheet';
import { addDays, formatWeekdayDay, isSameDay } from '@/lib/dates';

export const PLAN_PRESETS: DatePreset[] = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'In a week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

/** "today", "tomorrow", or "Fri 9 Oct". */
export function planDayLabel(day: Date, today: Date, locale?: string): string {
  if (isSameDay(day, today)) return 'today';
  if (isSameDay(day, addDays(today, 1))) return 'tomorrow';
  return formatWeekdayDay(day, locale);
}

/** The toast after planning. */
export function planToast(
  day: Date,
  result: { replaced: string | null; already: boolean },
  today: Date,
  locale?: string,
): string {
  const when = planDayLabel(day, today, locale);
  if (result.already) return `Already planned for ${when}`;
  if (result.replaced) return `Planned for ${when}, instead of ${result.replaced}`;
  return `Planned for ${when}`;
}

export function planButtonLabel(day: Date, today: Date, locale?: string): string {
  const when = planDayLabel(day, today, locale);
  return `Plan for ${when}`;
}

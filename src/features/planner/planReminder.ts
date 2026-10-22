/**
 * The optional evening nudge: "Plan tomorrow's outfit", at 20:00 on evenings
 * when the next day has nothing planned. Local notifications only; the next
 * week of evenings is rescheduled whenever plans change. Ids are derived:
 * `plan-reminder:<day>`. The timing and copy are pure and tested.
 */
import { addDays, formatWeekdayDay, fromDayKey, startOfDay, toDayKey, type DayKey } from '@/lib/dates';
import { cancelLocalWithPrefix, scheduleLocal, type LocalNotification } from '@/lib/notifications';

export const PLAN_REMINDER_PREFIX = 'plan-reminder:';
export const PLAN_REMINDER_HOUR = 20;
/** Evenings scheduled ahead; opening the app tops them up. */
export const PLAN_REMINDER_EVENINGS = 7;

/** The coming evenings (still ahead of `now`) whose next day has no plan, with the day they're for. */
export function reminderEvenings(
  now: Date,
  planned: ReadonlySet<DayKey>,
  evenings = PLAN_REMINDER_EVENINGS,
  hour = PLAN_REMINDER_HOUR,
): { at: Date; day: DayKey }[] {
  const out: { at: Date; day: DayKey }[] = [];
  for (let i = 0; i < evenings; i++) {
    const at = startOfDay(addDays(now, i));
    at.setHours(hour, 0, 0, 0);
    if (at <= now) continue;
    const day = toDayKey(addDays(at, 1));
    if (!planned.has(day)) out.push({ at, day });
  }
  return out;
}

export function planReminderContent(day: DayKey, locale?: string): LocalNotification {
  return {
    title: 'Plan tomorrow’s outfit',
    body: `Nothing planned for ${formatWeekdayDay(fromDayKey(day), locale)} yet. Pick something for the forecast.`,
    data: { kind: 'plan', day },
  };
}

/** Replaces the scheduled evening reminders (or just clears them when off). */
export async function syncPlanReminders(enabled: boolean, planned: ReadonlySet<DayKey>, now = new Date()) {
  await cancelLocalWithPrefix(PLAN_REMINDER_PREFIX);
  if (!enabled) return;
  for (const { at, day } of reminderEvenings(now, planned)) {
    await scheduleLocal(`${PLAN_REMINDER_PREFIX}${day}`, at, planReminderContent(day)).catch(() => {});
  }
}

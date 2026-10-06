/**
 * "Remind me to ask for it back": local notifications for lent pieces.
 * Dates, ids and copy only; scheduling lives in src/lib/notifications.ts.
 * Pure — safe to import from tests.
 */
import { addDays, daysBetween, startOfDay } from '@/lib/dates';

/** Reminders arrive mid-morning, a good time to message a friend. */
export const REMINDER_HOUR = 10;
/** The spec's default: two weeks after lending. */
export const DEFAULT_REMINDER_DAYS = 14;

const PREFIX = 'lend-reminder:';

/**
 * One notification per piece, with an id derived from the item, so it can be
 * cancelled or replaced without storing the id anywhere.
 */
export function reminderId(itemId: string): string {
  return `${PREFIX}${itemId}`;
}

export function itemIdFromReminder(id: string): string | null {
  return id.startsWith(PREFIX) && id.length > PREFIX.length ? id.slice(PREFIX.length) : null;
}

/** `day` at the reminder hour, local time. */
export function atReminderHour(day: Date): Date {
  const at = startOfDay(day);
  at.setHours(REMINDER_HOUR, 0, 0, 0);
  return at;
}

/** The first day a reminder can be set for: today if the hour is still ahead, else tomorrow. */
export function earliestReminderDay(now: Date): Date {
  return atReminderHour(now) > now ? startOfDay(now) : startOfDay(addDays(now, 1));
}

/**
 * Default reminder: 14 days after it was lent, at 10:00. A piece lent long ago
 * would get a date in the past, so it falls back to the earliest moment ahead.
 */
export function defaultReminderDate(lentAt: Date | null, now: Date): Date {
  const planned = atReminderHour(addDays(lentAt ?? now, DEFAULT_REMINDER_DAYS));
  return planned > now ? planned : atReminderHour(earliestReminderDay(now));
}

/** The moment a picked day fires, or null if that moment has already passed. */
export function reminderMoment(day: Date, now: Date): Date | null {
  const at = atReminderHour(day);
  return at > now ? at : null;
}

/** "black midi dress" from "Black midi dress", leaving acronyms ("NYC tee") alone. */
function inSentence(name: string): string {
  const second = name.charAt(1);
  return second && second === second.toLowerCase() ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

export type ReminderContent = {
  title: string;
  body: string;
  /** Tapping the notification opens `url` (see useNotificationRouting). */
  data: { url: string; itemId: string };
};

/** What the notification says when it fires at `at`. */
export function reminderContent(
  item: { id: string; name: string; lentTo: string | null; lentAt: Date | null },
  at: Date,
): ReminderContent {
  const who = item.lentTo?.trim();
  const piece = inSentence(item.name);
  const title = who ? `Ask ${who} for your ${piece}` : `Time to get your ${piece} back`;
  const days = item.lentAt ? daysBetween(item.lentAt, at) : null;
  let body = 'You asked to be reminded about it.';
  if (days !== null && days > 0) {
    body = `${who ?? 'They'} ${who ? 'has' : 'have'} had it ${days === 1 ? 'a day' : `${days} days`}. Tap to see it.`;
  }
  return { title, body, data: { url: `/item/${item.id}`, itemId: item.id } };
}

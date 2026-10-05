/**
 * Wear logs and plans are keyed by the user's *local* calendar day as
 * "YYYY-MM-DD" strings, so a log made at 11pm never drifts into the next day
 * when read in another timezone.
 */
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: Date, b: Date): number {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / 86_400_000);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Human distance from a past day to today: "Today", "Yesterday", "5 days ago",
 * "3 weeks ago", "4 months ago", "2 years ago" — or "Never" for null.
 */
export function formatRelativeDay(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return 'Never';
  const days = daysBetween(date, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30.4)} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/** "Aug 2025" in the device locale. */
export function formatMonthYear(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

/** "14 Sep" in the device locale. */
export function formatShortDay(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** "Monday, 5 October" in the device locale. */
export function formatLongDay(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

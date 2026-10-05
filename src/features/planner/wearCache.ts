/**
 * `items.wearCount` and `items.lastWornAt` are a cache of the wear logs. This
 * derives them from the days an item appears in. Pure — safe to import from tests.
 */
import { fromDayKey, type DayKey } from '@/lib/dates';

export type WearCache = { wearCount: number; lastWornAt: Date | null };

/** Distinct days count once each; the last-worn time is noon of the latest day. */
export function wearCacheFromDays(days: readonly DayKey[]): WearCache {
  const unique = [...new Set(days)].sort();
  const last = unique[unique.length - 1];
  if (!last) return { wearCount: 0, lastWornAt: null };
  const lastWornAt = fromDayKey(last);
  lastWornAt.setHours(12, 0, 0, 0);
  return { wearCount: unique.length, lastWornAt };
}

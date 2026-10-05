import { toDayKey } from '@/lib/dates';

import { wearCacheFromDays } from './wearCache';

describe('wearCacheFromDays', () => {
  it('is empty for an unworn piece', () => {
    expect(wearCacheFromDays([])).toEqual({ wearCount: 0, lastWornAt: null });
  });

  it('counts distinct days and stamps noon of the latest', () => {
    const cache = wearCacheFromDays(['2026-09-30', '2026-10-05', '2026-10-01', '2026-10-05']);
    expect(cache.wearCount).toBe(3);
    expect(cache.lastWornAt && toDayKey(cache.lastWornAt)).toBe('2026-10-05');
    expect(cache.lastWornAt?.getHours()).toBe(12);
  });
});

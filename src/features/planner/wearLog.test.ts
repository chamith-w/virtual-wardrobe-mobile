import { statusFields, type StatusState } from '@/features/items/status';
import { addDays, toDayKey } from '@/lib/dates';

import { laundryAfter, laundryAfterLabel, laundryDue, overridesSummary, wearsSinceWash } from './autoLaundry';
import { logCaption, logToast, statusAfterUnwear, statusAfterWear } from './logEffects';
import { wearCacheFromDays } from './wearCache';

const NOW = new Date(2026, 9, 22, 9);
const TODAY = toDayKey(NOW);
const day = (offset: number) => toDayKey(addDays(NOW, offset));

describe('auto-laundry rule', () => {
  it('uses the per-category defaults', () => {
    expect(laundryAfter('tshirts')).toBe(1);
    expect(laundryAfter('socks')).toBe(1);
    expect(laundryAfter('activewear')).toBe(1);
    expect(laundryAfter('shirts')).toBe(2);
    expect(laundryAfter('knitwear')).toBe(3);
    expect(laundryAfter('jeans')).toBe(4);
    expect(laundryAfter('coats')).toBeNull();
    expect(laundryAfter('jackets')).toBeNull();
  });

  it('lets Settings override a default, including to never', () => {
    expect(laundryAfter('jeans', { jeans: 6 })).toBe(6);
    expect(laundryAfter('tshirts', { tshirts: null })).toBeNull();
    expect(laundryAfter('shirts', { jeans: 6 })).toBe(2);
    expect(overridesSummary({})).toMatch(/Tees after 1/);
    expect(overridesSummary({ jeans: 6, tshirts: 1 })).toBe('1 category changed');
  });

  it('counts distinct wear days after the last wash', () => {
    const washed = addDays(NOW, -5);
    expect(wearsSinceWash([day(-8), day(-5), day(-3), day(-1), day(-1)], washed)).toBe(2);
    expect(wearsSinceWash([day(-8), day(-3)], null)).toBe(2);
    expect(wearsSinceWash([], washed)).toBe(0);
  });

  it('is due once the wears reach the setting, never for never', () => {
    expect(laundryDue('jeans', 3)).toBe(false);
    expect(laundryDue('jeans', 4)).toBe(true);
    expect(laundryDue('tshirts', 1)).toBe(true);
    expect(laundryDue('coats', 40)).toBe(false);
    expect(laundryAfterLabel(null)).toBe('Never');
    expect(laundryAfterLabel(1)).toBe('After 1 wear');
    expect(laundryAfterLabel(3)).toBe('After 3 wears');
  });

  it('starts counting again when a piece goes into the wash or to the cleaner', () => {
    const home: StatusState = {
      status: 'in_wardrobe',
      statusChangedAt: null,
      lentTo: null,
      lentAt: null,
      remindAt: null,
      readyAt: null,
    };
    expect(statusFields(home, 'laundry', NOW).washedAt).toBe(NOW);
    expect(statusFields(home, 'dry_cleaner', NOW).washedAt).toBe(NOW);
    expect(statusFields(home, 'worn', NOW)).not.toHaveProperty('washedAt');
  });
});

describe('logging a wear', () => {
  const tee = { category: 'tshirts' as const, status: 'in_wardrobe' as const, washedAt: addDays(NOW, -3) };
  const jeans = { category: 'jeans' as const, status: 'in_wardrobe' as const, washedAt: addDays(NOW, -10) };

  it('marks today’s pieces worn, or sends them to the basket when due', () => {
    expect(statusAfterWear({ ...tee, wearDays: [TODAY] }, TODAY, TODAY)).toBe('laundry');
    expect(statusAfterWear({ ...jeans, wearDays: [day(-6), day(-2), TODAY] }, TODAY, TODAY)).toBe('worn');
    expect(statusAfterWear({ ...jeans, wearDays: [day(-6), day(-4), day(-2), TODAY] }, TODAY, TODAY)).toBe('laundry');
    expect(statusAfterWear({ ...tee, wearDays: [TODAY] }, TODAY, TODAY, { tshirts: null })).toBe('worn');
  });

  it('leaves statuses alone for a past day', () => {
    expect(statusAfterWear({ ...tee, wearDays: [day(-1)] }, day(-1), TODAY)).toBeNull();
    expect(statusAfterUnwear('worn', day(-1), TODAY)).toBeNull();
  });

  it('un-logging today puts a worn piece back, but leaves the basket alone', () => {
    expect(statusAfterUnwear('worn', TODAY, TODAY)).toBe('in_wardrobe');
    expect(statusAfterUnwear('laundry', TODAY, TODAY)).toBeNull();
  });

  it('keeps the cache right when a log is created and undone', () => {
    const before = [day(-9), day(-4)];
    const logged = wearCacheFromDays([...before, TODAY]);
    expect(logged.wearCount).toBe(3);
    expect(logged.lastWornAt && toDayKey(logged.lastWornAt)).toBe(TODAY);
    const undone = wearCacheFromDays(before);
    expect(undone.wearCount).toBe(2);
    expect(undone.lastWornAt && toDayKey(undone.lastWornAt)).toBe(day(-4));
    // Logging the same day twice still counts once.
    expect(wearCacheFromDays([...before, TODAY, TODAY]).wearCount).toBe(3);
  });

  it('words the toast and the sheet’s note', () => {
    expect(logToast({ added: 5, worn: 5, laundry: 0, already: false })).toBe('Logged · 5 pieces marked worn');
    expect(logToast({ added: 5, worn: 3, laundry: 2, already: false })).toBe(
      'Logged · 5 pieces +1 wear · 2 in the basket',
    );
    expect(logToast({ added: 1, worn: 0, laundry: 0, already: false })).toBe('Logged · 1 piece +1 wear');
    expect(logToast({ added: 0, worn: 0, laundry: 0, already: true })).toBe('Already logged for that day');
    expect(logCaption({ due: [], isToday: true })).toMatch(/Nothing’s due a wash yet/);
    expect(logCaption({ due: ['White tee'], isToday: true })).toMatch(/White tee goes straight to the laundry/);
    expect(logCaption({ due: ['White tee', 'Socks', 'Leggings'], isToday: true })).toMatch(
      /White tee, Socks and 1 more go straight/,
    );
    expect(logCaption({ due: ['White tee'], isToday: false })).toMatch(/stays as it is/);
  });
});

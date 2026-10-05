import { costPerWear, formatCostPerWear, formatMoney } from './stats';

describe('costPerWear', () => {
  it('divides price by wears', () => {
    expect(costPerWear(390, 23)).toBeCloseTo(16.96, 2);
  });

  it('treats an unworn piece as one wear', () => {
    expect(costPerWear(120, 0)).toBe(120);
  });

  it('is null without a price', () => {
    expect(costPerWear(null, 4)).toBeNull();
    expect(costPerWear(undefined, 4)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('rounds to whole units for larger amounts and keeps cents for small ones', () => {
    expect(formatMoney(16.96, 'USD', { locale: 'en-US' })).toBe('$17');
    expect(formatMoney(4.2, 'USD', { locale: 'en-US' })).toBe('$4.20');
  });

  it('honours the currency', () => {
    expect(formatMoney(240, 'EUR', { locale: 'en-US' })).toBe('€240');
  });
});

describe('formatCostPerWear', () => {
  it('formats or dashes', () => {
    expect(formatCostPerWear(390, 23, 'USD', 'en-US')).toBe('$17');
    expect(formatCostPerWear(null, 3, 'USD', 'en-US')).toBe('—');
  });
});

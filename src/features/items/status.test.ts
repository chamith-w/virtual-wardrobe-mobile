import { isOut, lendingFor, statusTagLabel } from './status';

describe('statusTagLabel', () => {
  it('names the borrower on lent pieces', () => {
    expect(statusTagLabel('lent', 'Nadia')).toBe('Lent · Nadia');
    expect(statusTagLabel('lent', '  ')).toBe('Lent');
    expect(statusTagLabel('lent', null)).toBe('Lent');
  });

  it('uses short labels for the other states', () => {
    expect(statusTagLabel('laundry')).toBe('Laundry');
    expect(statusTagLabel('dry_cleaner')).toBe('Dry cleaner');
    expect(statusTagLabel('worn')).toBe('Worn');
  });
});

describe('isOut', () => {
  it('is true only for pieces that have left their spot', () => {
    expect(isOut('worn')).toBe(true);
    expect(isOut('laundry')).toBe(true);
    expect(isOut('dry_cleaner')).toBe(true);
    expect(isOut('lent')).toBe(true);
    expect(isOut('in_wardrobe')).toBe(false);
    expect(isOut('storage')).toBe(false);
  });
});

describe('lendingFor', () => {
  const now = new Date(2026, 9, 5, 9);
  const since = new Date(2026, 8, 14);

  it('stamps the lend date and keeps a name already entered', () => {
    expect(lendingFor({ status: 'in_wardrobe', lentTo: 'Jo', lentAt: null }, 'lent', now)).toEqual({
      lentTo: 'Jo',
      lentAt: now,
    });
  });

  it('keeps the original date while staying lent', () => {
    expect(lendingFor({ status: 'lent', lentTo: 'Jo', lentAt: since }, 'lent', now)).toEqual({
      lentTo: 'Jo',
      lentAt: since,
    });
  });

  it('clears the borrower when the piece comes back', () => {
    expect(lendingFor({ status: 'lent', lentTo: 'Jo', lentAt: since }, 'in_wardrobe', now)).toEqual({
      lentTo: null,
      lentAt: null,
    });
  });
});

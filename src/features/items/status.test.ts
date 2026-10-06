import { isOut, statusFields, statusTagLabel, type StatusState } from './status';

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

describe('statusFields', () => {
  const now = new Date(2026, 9, 5, 9);
  const since = new Date(2026, 8, 14);
  const remind = new Date(2026, 9, 9, 10);
  const home: StatusState = {
    status: 'in_wardrobe',
    statusChangedAt: null,
    lentTo: null,
    lentAt: null,
    remindAt: null,
    readyAt: null,
  };
  const lent: StatusState = {
    ...home,
    status: 'lent',
    statusChangedAt: since,
    lentTo: 'Jo',
    lentAt: since,
    remindAt: remind,
  };

  it('stamps when the status changed, and keeps the stamp when it does not', () => {
    expect(statusFields(home, 'laundry', now).statusChangedAt).toBe(now);
    expect(statusFields(lent, 'lent', now).statusChangedAt).toBe(since);
  });

  it('stamps the lend date and takes the borrower’s name', () => {
    expect(statusFields(home, 'lent', now, { lentTo: '  Nadia  ' })).toMatchObject({
      lentTo: 'Nadia',
      lentAt: now,
      remindAt: null,
    });
  });

  it('keeps a name already entered when none is given', () => {
    expect(statusFields({ ...home, lentTo: 'Jo' }, 'lent', now).lentTo).toBe('Jo');
  });

  it('keeps the original date and reminder while staying lent', () => {
    expect(statusFields(lent, 'lent', now)).toMatchObject({ lentTo: 'Jo', lentAt: since, remindAt: remind });
  });

  it('clears the borrower, date and reminder when the piece comes back', () => {
    expect(statusFields(lent, 'in_wardrobe', now)).toMatchObject({ lentTo: null, lentAt: null, remindAt: null });
  });

  it('records the dry cleaner drop-off and an optional ready day', () => {
    const ready = new Date(2026, 9, 8);
    expect(statusFields(home, 'dry_cleaner', now, { readyAt: ready })).toMatchObject({
      statusChangedAt: now,
      readyAt: ready,
    });
    expect(statusFields(home, 'dry_cleaner', now).readyAt).toBeNull();
    const atCleaner = { ...home, status: 'dry_cleaner' as const, readyAt: ready };
    expect(statusFields(atCleaner, 'in_wardrobe', now).readyAt).toBeNull();
  });

  it('records why a piece was archived', () => {
    expect(statusFields(home, 'archived', now, { archivedReason: 'sold', archivedNote: '  Vinted ' })).toMatchObject({
      archivedReason: 'sold',
      archivedNote: 'Vinted',
    });
    expect(statusFields(home, 'laundry', now)).not.toHaveProperty('archivedReason');
  });
});

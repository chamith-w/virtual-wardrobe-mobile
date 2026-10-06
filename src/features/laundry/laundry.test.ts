import { backLine, cleanerInfo, lentAge, pileLine, washedLine } from './copy';
import { BASKET_BOX, PILE_VISIBLE, pileLayout, pieceSize, washDelay, washDuration } from './pile';

const now = new Date(2026, 9, 5, 12);

describe('lentAge', () => {
  it('counts days out and highlights pieces gone two weeks or more', () => {
    expect(lentAge(new Date(2026, 9, 2), null, now)).toMatchObject({ days: 3, overdue: false, line: '3 days' });
    expect(lentAge(new Date(2026, 8, 21), null, now)).toMatchObject({ days: 14, overdue: true });
    expect(lentAge(new Date(2026, 9, 5, 8), null, now).line).toBe('Lent today');
    expect(lentAge(new Date(2026, 9, 4), null, now).line).toBe('1 day');
  });

  it('mentions an upcoming or past reminder', () => {
    expect(lentAge(new Date(2026, 9, 2), new Date(2026, 9, 9, 10), now).line).toMatch(/^3 days · reminder /);
    expect(lentAge(new Date(2026, 8, 1), new Date(2026, 9, 1, 10), now).line).toMatch(/· reminded /);
  });
});

describe('cleanerInfo', () => {
  const dropped = new Date(2026, 9, 1, 9);

  it('tracks progress towards the ready day', () => {
    const info = cleanerInfo(dropped, new Date(2026, 9, 8, 9), now);
    expect(info.line).toMatch(/· in 3 days$/);
    expect(info.tone).toBe('muted');
    expect(info.progress).toBeGreaterThan(0.5);
    expect(info.progress).toBeLessThan(0.65);
  });

  it('says when it is ready to collect', () => {
    expect(cleanerInfo(dropped, new Date(2026, 9, 6), now).line).toBe('Ready tomorrow');
    expect(cleanerInfo(dropped, new Date(2026, 9, 5), now)).toMatchObject({
      line: 'Ready to collect today',
      tone: 'success',
      progress: 1,
    });
    expect(cleanerInfo(dropped, new Date(2026, 9, 3), now).line).toMatch(/^Ready since /);
  });

  it('counts days at the cleaner when there is no ready date', () => {
    expect(cleanerInfo(dropped, null, now)).toMatchObject({ line: '4 days at the cleaner', progress: null });
    expect(cleanerInfo(new Date(2026, 9, 5, 8), null, now).line).toBe('Dropped off today');
    expect(cleanerInfo(null, null, now)).toMatchObject({ dropped: 'At the cleaner', line: 'No ready date yet' });
  });
});

describe('copy', () => {
  it('says where a returned piece went', () => {
    expect(backLine('Stone trench', 'rail')).toBe('Stone trench is back on the rail');
    expect(backLine('Socks', 'drawer')).toBe('Socks is back in its drawer');
    expect(backLine('Tote', null)).toBe('Tote is back in your wardrobe');
  });

  it('counts pieces', () => {
    expect(washedLine(1)).toBe('1 piece back in your wardrobe');
    expect(washedLine(6)).toBe('6 pieces back in your wardrobe');
    expect(pileLine(0)).toMatch(/^Everything/);
    expect(pileLine(4)).toBe('4 pieces in the wash');
  });
});

describe('pileLayout', () => {
  it('sizes pieces by kind and keeps them inside the basket', () => {
    expect(pieceSize('shoes')).toEqual({ width: 88, height: 59 });
    expect(pieceSize('socks')).toEqual({ width: 72, height: 56 });
    expect(pieceSize('dresses')).toEqual({ width: 80, height: 96 });
    const slots = pileLayout(Array.from({ length: 20 }, () => 'shirts' as const));
    expect(slots).toHaveLength(PILE_VISIBLE);
    for (const s of slots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + s.width).toBeLessThanOrEqual(BASKET_BOX.width);
    }
    // The second layer sits higher than the first.
    expect(slots[10]!.y).toBeLessThan(slots[0]!.y);
  });
});

describe('wash done timing', () => {
  it('flies the newest piece first, 90ms apart', () => {
    expect([0, 1, 2, 3].map((i) => washDelay(i, 4))).toEqual([270, 180, 90, 0]);
    expect(washDuration(4)).toBe(1270);
    expect(washDuration(0)).toBe(0);
  });
});

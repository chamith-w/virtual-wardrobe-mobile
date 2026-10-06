import type { Category, ItemStatus } from '@/features/items/catalog';

import { roleOf, seededRandom, shuffleBoard, starterOutfit, type ShuffleItem } from './shuffle';

const hex = {
  ecru: '#E8DDC8',
  navy: '#26354E',
  black: '#1D1C1B',
  rust: '#B5542E',
  sage: '#A3B196',
  pink: '#E0457B',
  mustard: '#D9B520',
};
const item = (
  id: string,
  category: Category,
  color: keyof typeof hex,
  status: ItemStatus = 'in_wardrobe',
  over: Partial<ShuffleItem> = {},
): ShuffleItem => ({
  id,
  category,
  colors: [{ hex: hex[color], name: color }],
  seasons: [],
  status,
  isFavorite: false,
  ...over,
});

const wardrobe = new Map(
  [
    item('ecru-shirt', 'shirts', 'ecru'),
    item('navy-knit', 'knitwear', 'navy'),
    item('black-tee', 'tshirts', 'black'),
    item('washing-tee', 'tshirts', 'sage', 'laundry'),
    item('lent-shirt', 'shirts', 'rust', 'lent'),
    item('chinos', 'trousers', 'ecru'),
    item('jeans', 'jeans', 'navy'),
    item('stored-skirt', 'skirts', 'black', 'storage'),
    item('loafers', 'shoes', 'black'),
    item('sneakers', 'shoes', 'ecru'),
    item('blazer', 'jackets', 'navy'),
    item('tote', 'bags', 'rust'),
    item('dress', 'dresses', 'rust'),
  ].map((i) => [i.id, i]),
);

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

describe('shuffleBoard', () => {
  const board = [
    { itemId: 'ecru-shirt', locked: true },
    { itemId: 'chinos', locked: false },
    { itemId: 'loafers', locked: false },
  ];

  it('leaves locked pieces alone', () => {
    for (const seed of seeds) {
      const r = shuffleBoard(board, wardrobe, seededRandom(seed));
      if (r.kind !== 'swapped') throw new Error(r.kind);
      expect(r.swaps.map((s) => s.from)).not.toContain('ecru-shirt');
    }
  });

  it('keeps roles and only uses available pieces', () => {
    for (const seed of seeds) {
      const r = shuffleBoard(board, wardrobe, seededRandom(seed));
      if (r.kind !== 'swapped') throw new Error(r.kind);
      for (const s of r.swaps) {
        const to = wardrobe.get(s.to)!;
        expect(roleOf(to)).toBe(roleOf(wardrobe.get(s.from)!));
        expect(to.status).toBe('in_wardrobe');
      }
    }
  });

  it('never duplicates a piece', () => {
    const tops = [
      { itemId: 'ecru-shirt', locked: false },
      { itemId: 'navy-knit', locked: false },
    ];
    for (const seed of seeds) {
      const r = shuffleBoard(tops, wardrobe, seededRandom(seed));
      if (r.kind !== 'swapped') throw new Error(r.kind);
      const after = tops.map((p) => r.swaps.find((s) => s.from === p.itemId)?.to ?? p.itemId);
      expect(new Set(after).size).toBe(after.length);
      // Nothing that was on the board comes back in another slot.
      for (const s of r.swaps) expect(tops.map((p) => p.itemId)).not.toContain(s.to);
    }
  });

  it('keeps a piece when its role has nothing else available', () => {
    const r = shuffleBoard(
      [
        { itemId: 'blazer', locked: false },
        { itemId: 'jeans', locked: false },
      ],
      wardrobe,
      seededRandom(3),
    );
    if (r.kind !== 'swapped') throw new Error(r.kind);
    expect(r.swaps.map((s) => s.from)).toEqual(['jeans']);
    expect(r.swaps[0].to).toBe('chinos');
  });

  it('says why nothing changed', () => {
    expect(shuffleBoard([{ itemId: 'blazer', locked: true }], wardrobe).kind).toBe('all-locked');
    expect(shuffleBoard([], wardrobe).kind).toBe('all-locked');
    expect(shuffleBoard([{ itemId: 'blazer', locked: false }], wardrobe).kind).toBe('no-alternatives');
  });

  it('favours colours that harmonise with what stays', () => {
    const palette = new Map(
      [
        item('anchor', 'shirts', 'pink'),
        item('clash', 'trousers', 'mustard'),
        item('calm', 'trousers', 'black'),
        item('current', 'trousers', 'ecru'),
      ].map((i) => [i.id, i]),
    );
    const picks = seeds.map((seed) => {
      const r = shuffleBoard(
        [
          { itemId: 'anchor', locked: true },
          { itemId: 'current', locked: false },
        ],
        palette,
        seededRandom(seed),
      );
      return r.kind === 'swapped' ? r.swaps[0].to : null;
    });
    const calm = picks.filter((p) => p === 'calm').length;
    expect(calm).toBeGreaterThan(picks.length / 2);
  });
});

describe('starterOutfit', () => {
  it('builds a complete, available, duplicate-free outfit', () => {
    for (const seed of seeds) {
      const ids = starterOutfit(wardrobe, seededRandom(seed));
      expect(new Set(ids).size).toBe(ids.length);
      const roles = ids.map((id) => roleOf(wardrobe.get(id)!));
      for (const id of ids) expect(wardrobe.get(id)!.status).toBe('in_wardrobe');
      expect(roles).toContain('shoes');
      const dressed = roles.includes('one_piece');
      if (dressed) expect(roles).not.toContain('top');
      else expect(roles).toEqual(expect.arrayContaining(['top', 'bottom']));
    }
  });

  it('is empty for an empty wardrobe', () => {
    expect(starterOutfit(new Map())).toEqual([]);
  });
});

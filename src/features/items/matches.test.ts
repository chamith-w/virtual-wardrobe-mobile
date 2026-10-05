import { paletteColor } from '@/lib/color';

import type { Category, Season } from './catalog';
import { colorHarmony, findMatches, type MatchCandidate } from './matches';

const c = (name: string) => {
  const p = paletteColor(name);
  return { hex: p.hex, name: p.name };
};

const piece = (
  id: string,
  category: Category,
  color: string,
  seasons: Season[] = [],
  extra: Partial<MatchCandidate> = {},
): MatchCandidate => ({
  id,
  category,
  colors: [c(color)],
  seasons,
  status: 'in_wardrobe',
  isFavorite: false,
  ...extra,
});

describe('colorHarmony', () => {
  it('pairs neutrals with anything', () => {
    expect(colorHarmony(c('Rust'), c('Stone')).reason).toBe('Neutral pairing');
  });

  it('rewards complementary and tonal hues and flags clashes', () => {
    expect(colorHarmony(c('Rust'), c('Denim')).reason).toBe('Complementary colour');
    expect(colorHarmony(c('Rust'), c('Mustard')).reason).toBe('Tonal match');
    const scarlet = { hex: '#D02A2A', name: 'Scarlet' };
    const kelly = { hex: '#2AA02A', name: 'Kelly' };
    expect(colorHarmony(scarlet, kelly).score).toBeLessThan(0.5);
  });
});

describe('findMatches', () => {
  const blazer = piece('blazer', 'jackets', 'Navy', ['autumn']);
  const wardrobe = [
    blazer,
    piece('chinos', 'trousers', 'Stone', ['autumn', 'spring']),
    piece('tee', 'tshirts', 'White'),
    piece('loafers', 'shoes', 'Black'),
    piece('trench', 'coats', 'Stone', ['autumn']),
    piece('shorts', 'shorts', 'Sky', ['summer']),
    piece('archived-shirt', 'shirts', 'Ecru', [], { status: 'archived' }),
  ];

  it('suggests complementary roles, never the piece itself or another layer', () => {
    const ids = findMatches(blazer, wardrobe).map((m) => m.item.id);
    expect(ids).toEqual(expect.arrayContaining(['chinos', 'tee', 'loafers']));
    expect(ids).not.toContain('blazer');
    expect(ids).not.toContain('trench');
    expect(ids).not.toContain('archived-shirt');
  });

  it('ranks shared seasons above off-season pieces', () => {
    const scores = new Map(findMatches(blazer, wardrobe).map((m) => [m.item.id, m.score]));
    expect(scores.get('chinos') ?? 0).toBeGreaterThan(scores.get('shorts') ?? 0);
  });

  it('keeps at most two pieces per role', () => {
    const many = [
      blazer,
      ...['a', 'b', 'c', 'd'].map((id) => piece(`shoe-${id}`, 'shoes', 'Black')),
      piece('jeans', 'jeans', 'Indigo'),
    ];
    const shoes = findMatches(blazer, many).filter((m) => m.item.category === 'shoes');
    expect(shoes).toHaveLength(2);
  });
});

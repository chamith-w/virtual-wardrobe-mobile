import type { Category, Occasion, Season } from '@/features/items/catalog';

import { copyName, finalName, suggestOccasion, suggestOutfitName, suggestSeasons } from './defaults';

const piece = (category: Category, color: string | null, occasions: Occasion[] = [], seasons: Season[] = []) => ({
  category,
  colors: color ? [{ hex: '#000000', name: color }] : [],
  occasions,
  seasons,
});

describe('suggestOutfitName', () => {
  it('names the two leading colours, main pieces first', () => {
    expect(suggestOutfitName([piece('shoes', 'Black'), piece('jackets', 'Navy'), piece('shirts', 'Ecru')])).toBe(
      'Ecru & navy',
    );
  });

  it('handles one colour, one piece and no colours', () => {
    expect(suggestOutfitName([piece('trousers', 'Black'), piece('knitwear', 'Black')])).toBe('Head-to-toe black');
    expect(suggestOutfitName([piece('coats', 'Camel')])).toBe('Camel look');
    expect(suggestOutfitName([piece('coats', null)])).toBe('New outfit');
    expect(suggestOutfitName([])).toBe('New outfit');
  });
});

describe('suggestOccasion', () => {
  it('picks the most common occasion', () => {
    expect(
      suggestOccasion([
        piece('shirts', null, ['work', 'evening']),
        piece('trousers', null, ['evening']),
        piece('shoes', null),
      ]),
    ).toBe('evening');
    expect(suggestOccasion([piece('shirts', null, ['weekend', 'work'])])).toBe('work');
    expect(suggestOccasion([piece('shirts', null)])).toBeNull();
  });
});

describe('suggestSeasons', () => {
  it('keeps the seasons every seasonal piece shares', () => {
    expect(
      suggestSeasons([
        piece('shirts', null, [], ['spring', 'autumn', 'summer']),
        piece('trousers', null, [], ['autumn', 'spring']),
        piece('shoes', null, [], []),
      ]),
    ).toEqual(['spring', 'autumn']);
    expect(suggestSeasons([piece('shoes', null)])).toEqual([]);
    expect(suggestSeasons([piece('coats', null, [], ['winter']), piece('shirts', null, [], ['summer'])])).toEqual([]);
  });
});

describe('names', () => {
  it('falls back to the suggestion and tidies what was typed', () => {
    expect(finalName('   ', 'Ecru & navy')).toBe('Ecru & navy');
    expect(finalName('  Sunday   gallery ', 'x')).toBe('Sunday gallery');
    expect(finalName('a'.repeat(60), 'x')).toHaveLength(40);
  });

  it('numbers copies', () => {
    expect(copyName('Rust weekend', [])).toBe('Rust weekend copy');
    expect(copyName('Rust weekend', ['rust weekend copy'])).toBe('Rust weekend copy 2');
    expect(copyName('Rust weekend copy', ['Rust weekend copy', 'Rust weekend copy 2'])).toBe('Rust weekend copy 3');
  });
});

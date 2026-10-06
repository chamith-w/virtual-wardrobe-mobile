import { cleanName, planWardrobe, wardrobeNameProblem } from './wardrobes';

const existing = [
  { name: 'Home', sortOrder: 0 },
  { name: 'Storage', sortOrder: 1 },
];

describe('cleanName', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanName("  Parents'   place ")).toBe("Parents' place");
  });

  it('is null when blank and caps the length', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('abcdef', 3)).toBe('abc');
  });
});

describe('wardrobeNameProblem', () => {
  it('needs a name that is not taken (case-insensitively)', () => {
    expect(wardrobeNameProblem('', existing)).toBe('Give it a name');
    expect(wardrobeNameProblem(' storage ', existing)).toBe('You already have Storage');
    expect(wardrobeNameProblem('Summer house', existing)).toBeNull();
  });
});

describe('planWardrobe', () => {
  it('gives a wardrobe the Home zones and sorts it last', () => {
    const plan = planWardrobe(' Summer house ', 'wardrobe', existing);
    expect(plan?.wardrobe).toEqual({ name: 'Summer house', icon: 'home', sortOrder: 2 });
    expect(plan?.zones.map((z) => z.type)).toEqual([
      'rail',
      'shelf',
      'shelf',
      'drawer',
      'drawer',
      'drawer',
      'shoes',
      'accessories',
    ]);
  });

  it('gives storage the archive icon and storage zones', () => {
    const plan = planWardrobe('Under the bed', 'storage', existing);
    expect(plan?.wardrobe.icon).toBe('archive');
    expect(plan?.zones.map((z) => z.type)).toEqual(['rail', 'shelf', 'shoes', 'accessories']);
  });

  it('refuses blank or duplicate names', () => {
    expect(planWardrobe('  ', 'wardrobe', existing)).toBeNull();
    expect(planWardrobe('HOME', 'wardrobe', existing)).toBeNull();
  });

  it('starts at zero when there are no wardrobes yet', () => {
    expect(planWardrobe('Home', 'wardrobe', [])?.wardrobe.sortOrder).toBe(0);
  });
});

import { cleanName } from '@/lib/text';

import {
  deletionPlan,
  kindChangeProblem,
  moveInList,
  planWardrobe,
  renameProblem,
  sortOrders,
  wardrobeNameProblem,
} from './wardrobes';

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

describe('managing wardrobes', () => {
  const home = { id: 'h', name: 'Home', icon: 'home', sortOrder: 0 };
  const cabin = { id: 'c', name: 'Cabin', icon: 'home', sortOrder: 1 };
  const storage = { id: 's', name: 'Storage', icon: 'archive', sortOrder: 2 };
  const attic = { id: 'a', name: 'Attic', icon: 'archive', sortOrder: 3 };

  it('lets a wardrobe keep its own name but not take another’s', () => {
    expect(renameProblem('home', home, [home, cabin])).toBeNull();
    expect(renameProblem('Cabin', home, [home, cabin])).toBe('You already have Cabin');
    expect(renameProblem('  ', home, [home])).toBe('Give it a name');
  });

  it('reorders by moving one entry', () => {
    expect(moveInList(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInList(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveInList(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'c', 'b']);
    expect(sortOrders(['c', 'a'])).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ]);
  });

  it('can’t delete the last wardrobe or the last everyday one', () => {
    expect(deletionPlan(home, [home])).toEqual({ ok: false, problem: 'last' });
    expect(deletionPlan(home, [home, storage])).toEqual({ ok: false, problem: 'last_everyday' });
  });

  it('re-homes into a wardrobe of the same kind when there is one', () => {
    expect(deletionPlan(cabin, [home, cabin, storage])).toMatchObject({ ok: true, suggested: home });
    expect(deletionPlan(storage, [home, storage, attic])).toMatchObject({ ok: true, suggested: attic });
    expect(deletionPlan(storage, [home, storage])).toMatchObject({ ok: true, suggested: home, targets: [home] });
  });

  it('won’t turn the last everyday wardrobe into storage', () => {
    expect(kindChangeProblem(home, 'storage', [home, storage])).toBe('last_everyday');
    expect(kindChangeProblem(home, 'storage', [home, cabin, storage])).toBeNull();
    expect(kindChangeProblem(storage, 'wardrobe', [home, storage])).toBeNull();
  });
});

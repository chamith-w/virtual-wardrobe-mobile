/**
 * Auto-laundry: "move to laundry after N wears", per category. A piece's
 * wears are counted from the day it last went into the wash (or to the
 * cleaner). The defaults are editable in Me → Settings. Pure — safe to
 * import from tests.
 */
import type { Category } from '@/features/items/catalog';
import { toDayKey, type DayKey } from '@/lib/dates';
import type { AutoLaundryOverrides } from '@/store/preferences';

/** Null means never: outerwear, shoes and accessories don't go in the basket. */
export const AUTO_LAUNDRY_DEFAULTS: Record<Category, number | null> = {
  tshirts: 1,
  underwear: 1,
  socks: 1,
  activewear: 1,
  tops: 2,
  shirts: 2,
  dresses: 2,
  shorts: 2,
  knitwear: 3,
  skirts: 3,
  trousers: 3,
  jeans: 4,
  jackets: null,
  coats: null,
  shoes: null,
  bags: null,
  belts: null,
  jewelry: null,
  hats: null,
  scarves: null,
};

/** The steps offered in Settings: never, then 1–8 wears. */
export const AUTO_LAUNDRY_STEPS: (number | null)[] = [null, 1, 2, 3, 4, 5, 6, 8];

export function laundryAfter(category: Category, overrides: AutoLaundryOverrides = {}): number | null {
  return category in overrides ? (overrides[category] ?? null) : AUTO_LAUNDRY_DEFAULTS[category];
}

/** Distinct days worn after the day it was last washed (all of them if it never was). */
export function wearsSinceWash(days: readonly DayKey[], washedAt: Date | null): number {
  const washed = washedAt ? toDayKey(washedAt) : null;
  return new Set(days.filter((d) => washed === null || d > washed)).size;
}

/** Whether a piece with this many wears since its wash is due in the basket. */
export function laundryDue(category: Category, wears: number, overrides: AutoLaundryOverrides = {}): boolean {
  const n = laundryAfter(category, overrides);
  return n !== null && wears >= n;
}

/** "Never", "After 1 wear", "After 3 wears". */
export function laundryAfterLabel(n: number | null): string {
  if (n === null) return 'Never';
  return n === 1 ? 'After 1 wear' : `After ${n} wears`;
}

/** The settings row's hint: the defaults in brief, or how many categories differ from them. */
export function overridesSummary(overrides: AutoLaundryOverrides): string {
  const changed = (Object.keys(overrides) as Category[]).filter(
    (c) => overrides[c] !== AUTO_LAUNDRY_DEFAULTS[c],
  ).length;
  const base = 'Tees after 1 wear, jeans after 4, coats never';
  return changed === 0 ? base : `${changed} ${changed === 1 ? 'category' : 'categories'} changed`;
}

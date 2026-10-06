/**
 * Search, filters and sorting shared by the Closet and Grid views.
 * Within a filter group the choices are ORed; across groups they are ANDed.
 * Pure — safe to import from tests.
 */
import type { ItemColor } from '@/db/schema';
import {
  CATEGORY_GROUP,
  CATEGORY_GROUPS,
  CATEGORY_LABEL,
  GROUP_LABEL,
  ITEM_STATUSES,
  OCCASIONS,
  SEASONS,
  type Category,
  type CategoryGroup,
  type ItemStatus,
  type Occasion,
  type Season,
} from '@/features/items/catalog';
import { costPerWear, formatCostPerWear } from '@/features/items/stats';
import { hexToHsl, isNeutral } from '@/lib/color';
import { formatRelativeDay } from '@/lib/dates';

export type SortKey = 'recent' | 'most' | 'least' | 'cpw' | 'color';

export const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'recent', label: 'Recently added', hint: 'Newest pieces first' },
  { key: 'most', label: 'Most worn', hint: 'Your true favourites' },
  { key: 'least', label: 'Least worn', hint: 'Pieces that need some love' },
  { key: 'cpw', label: 'Cost per wear', hint: 'Price ÷ times worn, lowest first' },
  { key: 'color', label: 'Colour', hint: 'Arranged around the colour wheel' },
];

export function sortLabel(key: SortKey): string {
  return SORT_OPTIONS.find((o) => o.key === key)?.label ?? 'Recently added';
}

export type WardrobeFilters = {
  groups: CategoryGroup[];
  /** Palette colour names, e.g. "Camel". */
  colors: string[];
  seasons: Season[];
  occasions: Occasion[];
  statuses: ItemStatus[];
  brands: string[];
};

export const EMPTY_FILTERS: WardrobeFilters = {
  groups: [],
  colors: [],
  seasons: [],
  occasions: [],
  statuses: [],
  brands: [],
};

export type FilterableItem = {
  name: string;
  category: Category;
  subcategory: string | null;
  colors: ItemColor[];
  brand: string | null;
  material: string | null;
  seasons: Season[];
  occasions: Occasion[];
  status: ItemStatus;
  tags: string[];
};

/** Adds the value if missing, removes it if present. */
export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function activeFilterCount(filters: WardrobeFilters): number {
  return (
    filters.groups.length +
    filters.colors.length +
    filters.seasons.length +
    filters.occasions.length +
    filters.statuses.length +
    filters.brands.length
  );
}

function haystack(item: FilterableItem): string {
  return [
    item.name,
    item.brand,
    item.material,
    item.subcategory,
    CATEGORY_LABEL[item.category],
    GROUP_LABEL[CATEGORY_GROUP[item.category]],
    ...item.colors.map((c) => c.name),
    ...item.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Every word of the query must appear somewhere: "navy wool" finds the navy wool blazer. */
export function matchesQuery(item: FilterableItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = haystack(item);
  return words.every((w) => text.includes(w));
}

const overlaps = <T>(wanted: readonly T[], have: readonly T[]) => wanted.some((w) => have.includes(w));

export function matchesFilters(item: FilterableItem, filters: WardrobeFilters): boolean {
  if (filters.groups.length > 0 && !filters.groups.includes(CATEGORY_GROUP[item.category])) return false;
  if (
    filters.colors.length > 0 &&
    !overlaps(
      filters.colors.map((c) => c.toLowerCase()),
      item.colors.map((c) => c.name.toLowerCase()),
    )
  ) {
    return false;
  }
  // A piece with no seasons is treated as all-year.
  if (filters.seasons.length > 0 && item.seasons.length > 0 && !overlaps(filters.seasons, item.seasons)) return false;
  if (filters.occasions.length > 0 && !overlaps(filters.occasions, item.occasions)) return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) return false;
  if (filters.brands.length > 0 && !(item.brand && filters.brands.includes(item.brand))) return false;
  return true;
}

export function matchesAll(item: FilterableItem, query: string, filters: WardrobeFilters): boolean {
  return matchesQuery(item, query) && matchesFilters(item, filters);
}

export type SortableItem = {
  name: string;
  createdAt: Date;
  wearCount: number;
  lastWornAt: Date | null;
  price: number | null;
  colors: ItemColor[];
};

const time = (d: Date | null) => (d ? d.getTime() : 0);

/**
 * Where the colour wheel starts. Burgundy (~350°) and red (~3°) sit either
 * side of 0°, so starting at 340° keeps the reds and pinks together.
 */
const WHEEL_START = 340;

/**
 * Position on the colour wheel: neutrals grouped first, light to dark, then
 * chromatic colours by hue from burgundy round to lilac. Pieces without a
 * colour go last.
 */
export function colorSortKey(colors: readonly ItemColor[]): number {
  const primary = colors[0];
  if (!primary) return 2000;
  const { h, l } = hexToHsl(primary.hex);
  if (isNeutral(primary)) return (1 - l) * 100;
  return 1000 + ((h - WHEEL_START + 360) % 360);
}

/** Returns a new array; ties fall back to name so the order is stable. */
export function sortItems<T extends SortableItem>(rows: readonly T[], key: SortKey): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const compare: Record<SortKey, (a: T, b: T) => number> = {
    recent: (a, b) => time(b.createdAt) - time(a.createdAt) || byName(a, b),
    most: (a, b) => b.wearCount - a.wearCount || time(b.lastWornAt) - time(a.lastWornAt) || byName(a, b),
    least: (a, b) => a.wearCount - b.wearCount || time(a.lastWornAt) - time(b.lastWornAt) || byName(a, b),
    cpw: (a, b) => {
      const ca = costPerWear(a.price, a.wearCount);
      const cb = costPerWear(b.price, b.wearCount);
      if (ca === null && cb === null) return byName(a, b);
      if (ca === null) return 1;
      if (cb === null) return -1;
      return ca - cb || byName(a, b);
    },
    color: (a, b) => colorSortKey(a.colors) - colorSortKey(b.colors) || byName(a, b),
  };
  return [...rows].sort(compare[key]);
}

/** The subtitle under a grid card, chosen to explain the current sort. */
export function sortSubtitle(
  item: SortableItem & { currency?: string | null },
  key: SortKey,
  now: Date = new Date(),
): string {
  if (key === 'cpw') {
    const cpw = formatCostPerWear(item.price, item.wearCount, item.currency);
    return cpw === '—' ? 'No price yet' : `${cpw} per wear`;
  }
  if (key === 'most' || key === 'least') return item.wearCount === 0 ? 'Not worn yet' : `Worn ${item.wearCount}×`;
  if (key === 'color') return item.colors.map((c) => c.name).join(', ') || 'No colour';
  const added = formatRelativeDay(item.createdAt, now);
  return added === 'Today' || added === 'Yesterday' ? `Added ${added.toLowerCase()}` : `Added ${added}`;
}

export type Facet<T> = { value: T; count: number };
export type ColorFacet = Facet<string> & { hex: string };

export type Facets = {
  groups: Facet<CategoryGroup>[];
  colors: ColorFacet[];
  seasons: Facet<Season>[];
  occasions: Facet<Occasion>[];
  statuses: Facet<ItemStatus>[];
  brands: Facet<string>[];
};

/** The filter values that actually occur in a set of items, with counts. */
export function facetsOf(rows: readonly FilterableItem[]): Facets {
  const count = <T>(values: T[]) => {
    const m = new Map<T, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const groups = count(rows.map((r) => CATEGORY_GROUP[r.category]));
  const seasons = count(rows.flatMap((r) => r.seasons));
  const occasions = count(rows.flatMap((r) => r.occasions));
  const statuses = count(rows.map((r) => r.status));
  const brands = count(rows.map((r) => r.brand).filter((b): b is string => !!b));

  const colorCounts = new Map<string, ColorFacet>();
  for (const r of rows) {
    for (const c of new Map(r.colors.map((x) => [x.name, x])).values()) {
      const prev = colorCounts.get(c.name);
      colorCounts.set(c.name, { value: c.name, hex: prev?.hex ?? c.hex, count: (prev?.count ?? 0) + 1 });
    }
  }

  const ordered = <T>(order: readonly T[], m: Map<T, number>) =>
    order.filter((v) => m.has(v)).map((value) => ({ value, count: m.get(value) ?? 0 }));

  return {
    groups: ordered(CATEGORY_GROUPS, groups),
    colors: [...colorCounts.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    seasons: ordered(SEASONS, seasons),
    occasions: ordered(OCCASIONS, occasions),
    statuses: ordered(ITEM_STATUSES, statuses),
    brands: [...brands.entries()]
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  };
}

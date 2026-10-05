/**
 * Layout rules for the stylised closet: zone grouping, hanger sway weights,
 * tile sizes. Pure — safe to import from tests.
 */
import { CATEGORY_DEFAULT_ZONE, type Category, type ItemStatus, type ZoneType } from '@/features/items/catalog';
import { isOut } from '@/features/items/status';

export const ZONE_SECTION_TITLE: Record<ZoneType, string> = {
  rail: 'Hanging rail',
  shelf: 'Shelves',
  drawer: 'Drawers',
  shoes: 'Shoe rack',
  accessories: 'Accessories tray',
};

export type ZoneSection<Z> = { type: ZoneType; zones: Z[] };

/** Groups zones by type, ordered by where each type first appears. */
export function zoneSections<Z extends { type: ZoneType; sortOrder: number }>(zones: readonly Z[]): ZoneSection<Z>[] {
  const sorted = [...zones].sort((a, b) => a.sortOrder - b.sortOrder);
  const sections: ZoneSection<Z>[] = [];
  for (const zone of sorted) {
    const existing = sections.find((s) => s.type === zone.type);
    if (existing) existing.zones.push(zone);
    else sections.push({ type: zone.type, zones: [zone] });
  }
  return sections;
}

/** "10 pieces · 3 out" */
export function zoneMeta(rows: readonly { status: ItemStatus }[]): string {
  const out = rows.filter((r) => isOut(r.status)).length;
  const pieces = `${rows.length} ${rows.length === 1 ? 'piece' : 'pieces'}`;
  return out > 0 ? `${pieces} · ${out} out` : pieces;
}

const SWAY_BY_CATEGORY: Partial<Record<Category, number>> = {
  coats: 0.72,
  jackets: 0.88,
  knitwear: 1,
  tops: 1.12,
  shirts: 1.12,
  tshirts: 1.08,
  skirts: 1.2,
  dresses: 1.28,
};

/**
 * How much a garment swings on the rail (docs/DESIGN.md → "Swaying hangers"):
 * heavy coats barely move (0.7), silk and dresses swing most (up to 1.35).
 */
export function swayFactor(item: { category: Category; material?: string | null; subcategory?: string | null }): number {
  let k = SWAY_BY_CATEGORY[item.category] ?? 1;
  const fabric = `${item.material ?? ''} ${item.subcategory ?? ''}`.toLowerCase();
  if (/silk|satin|chiffon|slip/.test(fabric)) k += 0.1;
  if (/puffer|down|padded/.test(fabric)) k += 0.08;
  if (/wool|cashmere|tweed|leather/.test(fabric)) k -= 0.05;
  return Math.round(Math.min(1.35, Math.max(0.7, k)) * 100) / 100;
}

/** Small deterministic tilt for pieces scattered in the accessories tray (−6°…6°). */
export function trayTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 13) - 6;
}

/** Image well height for a grid card: tall for hanging and folded pieces, short for shoes. */
export function gridTileHeight(category: Category): number {
  const zone = CATEGORY_DEFAULT_ZONE[category];
  if (zone === 'shoes') return 112;
  if (zone === 'accessories' || zone === 'drawer') return 134;
  return 176;
}

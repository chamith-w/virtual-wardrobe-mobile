/**
 * The words on the item detail screen: stat tiles, the eyebrow and byline
 * under the cutout, and the details list. Pure — safe to import from tests.
 */
import { daysBetween, formatMonthYear, formatRelativeDay } from '@/lib/dates';

import {
  CATEGORY_GROUP,
  CATEGORY_LABEL,
  GROUP_LABEL,
  OCCASION_LABEL,
  SEASON_LABEL,
  SEASONS,
  type Category,
  type Occasion,
  type Season,
} from './catalog';
import { formatCostPerWear, formatMoney } from './stats';

export type DetailStats = {
  timesWorn: string;
  lastWorn: string;
  costPerWear: string;
  sinceAdded: string;
};

type StatSource = {
  wearCount: number;
  lastWornAt: Date | null;
  price: number | null;
  currency: string | null;
  createdAt: Date;
};

/** The four stat tiles: times worn, cost per wear, last worn, days since added. */
export function detailStats(item: StatSource, now: Date = new Date(), locale?: string): DetailStats {
  const days = Math.max(0, daysBetween(item.createdAt, now));
  return {
    timesWorn: String(item.wearCount),
    costPerWear: formatCostPerWear(item.price, item.wearCount, item.currency, locale),
    lastWorn: formatRelativeDay(item.lastWornAt, now),
    sinceAdded: days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`,
  };
}

/** "Outerwear · Overcoat" — the group, then the subcategory (or category). */
export function itemEyebrow(item: { category: Category; subcategory: string | null }): string {
  const group = GROUP_LABEL[CATEGORY_GROUP[item.category]];
  const detail = item.subcategory?.trim() || CATEGORY_LABEL[item.category];
  return detail.toLowerCase() === group.toLowerCase() ? group : `${group} · ${detail}`;
}

/** "Maison Lune · Size 38", or whichever half is known. */
export function itemByline(item: { brand: string | null; size: string | null }): string | null {
  const parts = [item.brand?.trim(), item.size?.trim() ? `Size ${item.size.trim()}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** "Autumn, Winter", or "All year" for none or all four. */
export function seasonsLabel(seasons: readonly Season[]): string {
  if (seasons.length === 0 || SEASONS.every((s) => seasons.includes(s))) return 'All year';
  return SEASONS.filter((s) => seasons.includes(s))
    .map((s) => SEASON_LABEL[s])
    .join(', ');
}

export type DetailRow = { label: string; value: string };

type RowSource = {
  material: string | null;
  pattern: string | null;
  careNotes: string | null;
  seasons: Season[];
  occasions: Occasion[];
  purchaseDate: Date | null;
  store: string | null;
  price: number | null;
  currency: string | null;
};

/** The details list, skipping anything that was never filled in. */
export function detailRows(item: RowSource, locale?: string): DetailRow[] {
  const purchased = [item.purchaseDate ? formatMonthYear(item.purchaseDate, locale) : null, item.store?.trim()]
    .filter(Boolean)
    .join(' · ');
  const rows: (DetailRow | null)[] = [
    item.material?.trim() ? { label: 'Material', value: item.material.trim() } : null,
    item.pattern?.trim() ? { label: 'Pattern', value: item.pattern.trim() } : null,
    item.careNotes?.trim() ? { label: 'Care', value: item.careNotes.trim() } : null,
    { label: 'Seasons', value: seasonsLabel(item.seasons) },
    item.occasions.length > 0
      ? { label: 'Occasions', value: item.occasions.map((o) => OCCASION_LABEL[o]).join(', ') }
      : null,
    purchased ? { label: 'Purchased', value: purchased } : null,
    item.price !== null ? { label: 'Price', value: formatMoney(item.price, item.currency, { locale }) } : null,
  ];
  return rows.filter((r): r is DetailRow => r !== null);
}

/**
 * "Find matches" on item detail: pieces that pair well with this one. A light
 * cousin of the phase 6 suggestion engine — complementary role, colour
 * harmony and shared seasons. Pure — safe to import from tests.
 */
import type { ItemColor } from '@/db/schema';
import { hexToHsl, hueDistance, isNeutral } from '@/lib/color';

import { CATEGORY_ROLE, type Category, type ItemStatus, type Season } from './catalog';

type Role = (typeof CATEGORY_ROLE)[Category];

/** Which roles complete an outfit around a given role. */
const PAIRS_WITH: Record<Role, Role[]> = {
  top: ['bottom', 'layer', 'shoes', 'accessory'],
  bottom: ['top', 'layer', 'shoes', 'accessory'],
  one_piece: ['layer', 'shoes', 'accessory'],
  layer: ['top', 'bottom', 'one_piece', 'shoes'],
  shoes: ['top', 'bottom', 'one_piece', 'layer'],
  accessory: ['top', 'bottom', 'one_piece', 'layer'],
  basic: ['shoes'],
};

export type MatchCandidate = {
  id: string;
  category: Category;
  colors: ItemColor[];
  seasons: Season[];
  status: ItemStatus;
  isFavorite: boolean;
};

export type Match<T> = { item: T; score: number; reason: string };

/** 0–1 harmony of two primary colours, with the reason shown under the card. */
export function colorHarmony(a: ItemColor | undefined, b: ItemColor | undefined): { score: number; reason: string } {
  if (!a || !b) return { score: 0.5, reason: 'Easy pairing' };
  if (isNeutral(b)) return { score: 0.85, reason: 'Neutral pairing' };
  if (isNeutral(a)) return { score: 0.8, reason: `Lifts the ${a.name.toLowerCase()}` };
  const ha = hexToHsl(a.hex);
  const hb = hexToHsl(b.hex);
  const d = hueDistance(ha.h, hb.h);
  if (d <= 35) return { score: 0.9, reason: 'Tonal match' };
  if (d >= 150) return { score: 0.95, reason: 'Complementary colour' };
  const clashing = ha.s > 0.45 && hb.s > 0.45 && d > 60 && d < 140;
  if (clashing) return { score: 0.15, reason: 'Bold contrast' };
  return { score: 0.55, reason: 'Soft contrast' };
}

/**
 * Up to `limit` pieces that pair with `item`, best first, at most two per role
 * so one category never crowds the row.
 */
export function findMatches<T extends MatchCandidate>(item: MatchCandidate, candidates: readonly T[], limit = 6): Match<T>[] {
  const wanted = PAIRS_WITH[CATEGORY_ROLE[item.category]];
  const scored = candidates
    .filter((c) => c.id !== item.id && c.status !== 'archived' && wanted.includes(CATEGORY_ROLE[c.category]))
    .map((c) => {
      const harmony = colorHarmony(item.colors[0], c.colors[0]);
      const sharedSeason =
        item.seasons.length === 0 || c.seasons.length === 0 || item.seasons.some((s) => c.seasons.includes(s));
      let score = harmony.score;
      score += sharedSeason ? 0.3 : -0.2;
      if (c.isFavorite) score += 0.1;
      if (c.status !== 'in_wardrobe') score -= 0.25;
      const reason = harmony.score < 0.6 && sharedSeason ? 'Same season' : harmony.reason;
      return { item: c, score, reason };
    })
    .filter((m) => m.score > 0.5)
    .sort((a, b) => b.score - a.score);

  const perRole = new Map<Role, number>();
  const picked: Match<T>[] = [];
  for (const m of scored) {
    const role = CATEGORY_ROLE[m.item.category];
    const n = perRole.get(role) ?? 0;
    if (n >= 2) continue;
    perRole.set(role, n + 1);
    picked.push(m);
    if (picked.length >= limit) break;
  }
  return picked;
}

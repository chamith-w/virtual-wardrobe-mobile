/**
 * Item detail → "Find matches": pieces that pair well with this one, scored
 * by the engine's colour harmony and the weights in config.ts (role,
 * harmony, shared seasons and occasions, favourites). Pure — safe to import
 * from tests.
 */
import type { ItemColor } from '@/db/schema';
import { CATEGORY_ROLE, type Category, type ItemStatus, type Occasion, type Season } from '@/features/items/catalog';

import { SUGGESTION_CONFIG, type SuggestionConfig } from './config';
import { colorHarmony } from './harmony';

export { colorHarmony };

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
  occasions?: Occasion[];
  status: ItemStatus;
  isFavorite: boolean;
};

export type Match<T> = { item: T; score: number; reason: string };

/**
 * Up to `limit` pieces that pair with `item`, best first, at most two per role
 * so one category never crowds the row.
 */
export function findMatches<T extends MatchCandidate>(
  item: MatchCandidate,
  candidates: readonly T[],
  limit = 6,
  config: SuggestionConfig = SUGGESTION_CONFIG,
): Match<T>[] {
  const m = config.matches;
  const wanted = PAIRS_WITH[CATEGORY_ROLE[item.category]];
  const scored = candidates
    .filter((c) => c.id !== item.id && c.status !== 'archived' && wanted.includes(CATEGORY_ROLE[c.category]))
    .map((c) => {
      const harmony = colorHarmony(item.colors[0], c.colors[0], config);
      const sharedSeason =
        item.seasons.length === 0 || c.seasons.length === 0 || item.seasons.some((s) => c.seasons.includes(s));
      const sharedOccasion = (item.occasions ?? []).some((o) => (c.occasions ?? []).includes(o));
      let score = harmony.score;
      score += sharedSeason ? m.sharedSeason : -m.offSeason;
      if (sharedOccasion) score += m.sharedOccasion;
      if (c.isFavorite) score += m.favorite;
      if (c.status !== 'in_wardrobe') score -= m.notAtHome;
      const reason = harmony.score < 0.6 && sharedSeason ? 'Same season' : harmony.reason;
      return { item: c, score, reason };
    })
    .filter((x) => x.score > m.minScore)
    .sort((a, b) => b.score - a.score);

  const perRole = new Map<Role, number>();
  const picked: Match<T>[] = [];
  for (const x of scored) {
    const role = CATEGORY_ROLE[x.item.category];
    const n = perRole.get(role) ?? 0;
    if (n >= m.perRole) continue;
    perRole.set(role, n + 1);
    picked.push(x);
    if (picked.length >= limit) break;
  }
  return picked;
}

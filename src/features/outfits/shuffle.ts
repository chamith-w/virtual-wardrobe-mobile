/**
 * The builder's tray tabs and Shuffle. Shuffle swaps every unlocked piece for
 * another available garment in the same role, choosing ones whose colours sit
 * well with what stays (reusing `colorHarmony` from Find matches). Phase 6's
 * suggestion engine can take this over. Pure — safe to import from tests.
 */
import type { ItemColor } from '@/db/schema';
import { CATEGORY_ROLE, type Category, type ItemStatus, type Season } from '@/features/items/catalog';
import { colorHarmony } from '@/features/items/matches';

export type Role = (typeof CATEGORY_ROLE)[Category];

/** The tray's tabs, in order. Basics (underwear, socks, activewear) aren't styled on a board. */
export const TRAY_TABS: { role: Role; label: string }[] = [
  { role: 'top', label: 'Tops' },
  { role: 'bottom', label: 'Bottoms' },
  { role: 'layer', label: 'Layers' },
  { role: 'one_piece', label: 'Dresses' },
  { role: 'shoes', label: 'Shoes' },
  { role: 'accessory', label: 'Accessories' },
];

export type ShuffleItem = {
  id: string;
  category: Category;
  colors: ItemColor[];
  seasons: Season[];
  status: ItemStatus;
  isFavorite: boolean;
};

/** Only pieces hanging in the wardrobe can go into an outfit: not worn, washing, lent, stored or archived. */
export function isAvailable(item: { status: ItemStatus }): boolean {
  return item.status === 'in_wardrobe';
}

export function roleOf(item: { category: Category }): Role {
  return CATEGORY_ROLE[item.category];
}

/** The order slots are filled in, so later picks harmonise with the main pieces. */
const ROLE_PRIORITY: Role[] = ['one_piece', 'top', 'bottom', 'layer', 'shoes', 'accessory', 'basic'];
const POOL_TOP = 4;

/** How well a candidate sits with the pieces already chosen: colour harmony, shared seasons, a nudge for favourites. */
function fitScore(candidate: ShuffleItem, anchors: readonly ShuffleItem[], replacing?: ShuffleItem): number {
  let harmony = 0.6;
  if (anchors.length > 0) {
    harmony =
      anchors.reduce((sum, a) => sum + colorHarmony(a.colors[0], candidate.colors[0]).score, 0) / anchors.length;
  }
  const seasonal = anchors.every(
    (a) =>
      a.seasons.length === 0 || candidate.seasons.length === 0 || a.seasons.some((s) => candidate.seasons.includes(s)),
  );
  let score = harmony + (seasonal ? 0.2 : -0.2);
  if (replacing && replacing.category === candidate.category) score += 0.08;
  if (candidate.isFavorite) score += 0.05;
  return score;
}

/** One of the best few, weighted towards the best, so repeated shuffles vary. */
function pick(scored: { item: ShuffleItem; score: number }[], random: () => number): ShuffleItem | null {
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, POOL_TOP);
  if (top.length === 0) return null;
  const weights = top.map((s) => Math.max(0.01, s.score) ** 2);
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i].item;
  }
  return top[top.length - 1].item;
}

export type ShuffleResult =
  { kind: 'swapped'; swaps: { from: string; to: string }[] } | { kind: 'all-locked' } | { kind: 'no-alternatives' };

/**
 * New garments for the board's unlocked pieces. Each replacement has the same
 * role, is available, isn't already on the board and isn't picked twice;
 * pieces with nothing to swap in stay as they are.
 */
export function shuffleBoard(
  board: readonly { itemId: string; locked: boolean }[],
  items: ReadonlyMap<string, ShuffleItem>,
  random: () => number = Math.random,
): ShuffleResult {
  const unlocked = board.filter((p) => !p.locked && items.has(p.itemId));
  if (unlocked.length === 0) return { kind: 'all-locked' };

  const taken = new Set(board.map((p) => p.itemId));
  const anchors = board.filter((p) => p.locked).flatMap((p) => items.get(p.itemId) ?? []);
  const queue = [...unlocked].sort(
    (a, b) => ROLE_PRIORITY.indexOf(roleOf(items.get(a.itemId)!)) - ROLE_PRIORITY.indexOf(roleOf(items.get(b.itemId)!)),
  );
  const pool = [...items.values()].filter(isAvailable);

  const swaps: { from: string; to: string }[] = [];
  for (const slot of queue) {
    const current = items.get(slot.itemId)!;
    const role = roleOf(current);
    const options = pool
      .filter((c) => roleOf(c) === role && !taken.has(c.id))
      .map((item) => ({ item, score: fitScore(item, anchors, current) }));
    const next = pick(options, random);
    if (!next) {
      anchors.push(current);
      continue;
    }
    taken.add(next.id);
    anchors.push(next);
    swaps.push({ from: slot.itemId, to: next.id });
  }
  return swaps.length > 0 ? { kind: 'swapped', swaps } : { kind: 'no-alternatives' };
}

/**
 * Shuffle on an empty board: a whole outfit. Top, bottoms and shoes, or a
 * dress and shoes, sometimes with a layer and an accessory. Returns item ids
 * in the order they're chosen (main pieces first).
 */
export function starterOutfit(items: ReadonlyMap<string, ShuffleItem>, random: () => number = Math.random): string[] {
  const pool = [...items.values()].filter(isAvailable);
  const has = (role: Role) => pool.some((i) => roleOf(i) === role);

  const dress = has('one_piece') && (random() < 0.35 || !(has('top') && has('bottom')));
  const roles: Role[] = dress ? ['one_piece', 'shoes'] : ['top', 'bottom', 'shoes'];
  if (random() < 0.5) roles.push('layer');
  if (random() < 0.6) roles.push('accessory');

  const chosen: ShuffleItem[] = [];
  for (const role of roles) {
    const options = pool
      .filter((c) => roleOf(c) === role && !chosen.includes(c))
      .map((item) => ({ item, score: fitScore(item, chosen) }));
    const next = pick(options, random);
    if (next) chosen.push(next);
  }
  return chosen.map((i) => i.id);
}

/** A small seeded random source (mulberry32), for reproducible shuffles in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

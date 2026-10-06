/**
 * What the save sheet starts with for a new outfit: a name from its colours,
 * and the occasion and seasons its pieces share. Pure — safe to import from
 * tests.
 */
import type { ItemColor } from '@/db/schema';
import { CATEGORY_ROLE, OCCASIONS, SEASONS, type Category, type Occasion, type Season } from '@/features/items/catalog';

export const OUTFIT_NAME_MAX = 40;

type Piece = { category: Category; colors: ItemColor[]; occasions: Occasion[]; seasons: Season[] };

const ROLE_ORDER = ['one_piece', 'top', 'layer', 'bottom', 'shoes', 'accessory', 'basic'] as const;

/** "Ecru & navy" from the two leading colours (main pieces first), "Head-to-toe black" when there's one. */
export function suggestOutfitName(pieces: readonly Piece[]): string {
  const ordered = [...pieces].sort(
    (a, b) => ROLE_ORDER.indexOf(CATEGORY_ROLE[a.category]) - ROLE_ORDER.indexOf(CATEGORY_ROLE[b.category]),
  );
  const names: string[] = [];
  for (const p of ordered) {
    const name = p.colors[0]?.name?.trim().toLowerCase();
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length === 0) return 'New outfit';
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (names.length === 1) return pieces.length > 1 ? `Head-to-toe ${names[0]}` : `${cap(names[0])} look`;
  return `${cap(names[0])} & ${names[1]}`;
}

/** The occasion most pieces are tagged for (ties go to the catalogue's order), or none. */
export function suggestOccasion(pieces: readonly Piece[]): Occasion | null {
  let best: Occasion | null = null;
  let bestCount = 0;
  for (const o of OCCASIONS) {
    const n = pieces.filter((p) => p.occasions.includes(o)).length;
    if (n > bestCount) [best, bestCount] = [o, n];
  }
  return best;
}

/** Seasons every seasonal piece shares; pieces tagged for no season fit any. Empty means all year. */
export function suggestSeasons(pieces: readonly Piece[]): Season[] {
  const seasonal = pieces.filter((p) => p.seasons.length > 0);
  if (seasonal.length === 0) return [];
  return SEASONS.filter((s) => seasonal.every((p) => p.seasons.includes(s)));
}

/** A trimmed name, or the suggestion when it's blank. */
export function finalName(typed: string, suggestion: string): string {
  const name = typed.trim().replace(/\s+/g, ' ').slice(0, OUTFIT_NAME_MAX);
  return name || suggestion;
}

/** "Ecru & navy copy", "Ecru & navy copy 2"… avoiding names in use. */
export function copyName(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  const base = `${name.replace(/ copy( \d+)?$/i, '')} copy`;
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const next = `${base} ${n}`;
    if (!used.has(next.toLowerCase())) return next;
  }
}

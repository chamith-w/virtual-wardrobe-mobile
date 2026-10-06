/**
 * Creating wardrobes from the switcher ("+ New"). A wardrobe starts with the
 * same zones as Home; a storage wardrobe with rail, shelves, shoes and tray.
 * Pure — safe to import from tests.
 */
import { DEFAULT_HOME_ZONES, DEFAULT_STORAGE_ZONES } from '@/db/seed/demo-plan';
import type { ZoneType } from '@/features/items/catalog';
import { cleanName } from '@/lib/text';

export type WardrobeKind = 'wardrobe' | 'storage';

/** Storage wardrobes are recognised by their archive icon (see placement.ts). */
export const WARDROBE_KIND_ICON: Record<WardrobeKind, string> = { wardrobe: 'home', storage: 'archive' };

export const WARDROBE_NAME_MAX = 32;

/** Why a new wardrobe name can't be used, or null when it can. */
export function wardrobeNameProblem(raw: string, existing: readonly { name: string }[]): string | null {
  const name = cleanName(raw, WARDROBE_NAME_MAX);
  if (!name) return 'Give it a name';
  const taken = existing.find((w) => w.name.toLowerCase() === name.toLowerCase());
  return taken ? `You already have ${taken.name}` : null;
}

export type WardrobePlan = {
  wardrobe: { name: string; icon: string; sortOrder: number };
  zones: { type: ZoneType; name: string; sortOrder: number }[];
};

/** The rows for a new wardrobe, sorted after the existing ones. Null if the name is unusable. */
export function planWardrobe(
  raw: string,
  kind: WardrobeKind,
  existing: readonly { name: string; sortOrder: number }[],
): WardrobePlan | null {
  const name = cleanName(raw, WARDROBE_NAME_MAX);
  if (!name || wardrobeNameProblem(name, existing)) return null;
  const sortOrder = existing.reduce((max, w) => Math.max(max, w.sortOrder + 1), 0);
  const template = kind === 'storage' ? DEFAULT_STORAGE_ZONES : DEFAULT_HOME_ZONES;
  return {
    wardrobe: { name, icon: WARDROBE_KIND_ICON[kind], sortOrder },
    zones: template.map((z) => ({ type: z.type, name: z.name, sortOrder: z.sortOrder })),
  };
}

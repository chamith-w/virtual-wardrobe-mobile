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

// ------------------------------------------------------------- managing --

/** Why a rename can't be used, or null when it can. The wardrobe's own name doesn't count as taken. */
export function renameProblem(
  raw: string,
  wardrobe: { id: string },
  all: readonly { id: string; name: string }[],
): string | null {
  return wardrobeNameProblem(
    raw,
    all.filter((w) => w.id !== wardrobe.id),
  );
}

/** Ids in a new order after dragging `from` to `to`. */
export function moveInList<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved as T);
  return next;
}

/** sortOrder per id for a list in its new order. */
export function sortOrders(ids: readonly string[]): { id: string; sortOrder: number }[] {
  return ids.map((id, sortOrder) => ({ id, sortOrder }));
}

export type WardrobeRef = { id: string; name: string; icon: string; sortOrder: number };

/** Why a wardrobe can't be deleted or turned into storage. */
export type WardrobeProblem = 'last' | 'last_everyday';

export const WARDROBE_PROBLEM_COPY: Record<WardrobeProblem, string> = {
  last: 'You need at least one wardrobe.',
  last_everyday: 'Keep at least one everyday wardrobe: pieces come back to it from storage.',
};

const isStorage = (w: { icon: string }) => w.icon === WARDROBE_KIND_ICON.storage;
const byOrder = <W extends { sortOrder: number }>(list: readonly W[]) =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Deleting a wardrobe re-homes its pieces, so there must be somewhere to put
 * them — and an everyday wardrobe must remain for pieces leaving storage.
 * The suggested target is another wardrobe of the same kind, else the first
 * everyday one.
 */
export function deletionPlan<W extends WardrobeRef>(
  wardrobe: W,
  all: readonly W[],
): { ok: false; problem: WardrobeProblem } | { ok: true; targets: W[]; suggested: W } {
  const others = byOrder(all.filter((w) => w.id !== wardrobe.id));
  if (others.length === 0) return { ok: false, problem: 'last' };
  if (!others.some((w) => !isStorage(w))) return { ok: false, problem: 'last_everyday' };
  const sameKind = others.find((w) => isStorage(w) === isStorage(wardrobe));
  const everyday = others.find((w) => !isStorage(w));
  return { ok: true, targets: others, suggested: (sameKind ?? everyday) as W };
}

/** Turning the last everyday wardrobe into storage would leave stored pieces nowhere to return to. */
export function kindChangeProblem(
  wardrobe: WardrobeRef,
  kind: WardrobeKind,
  all: readonly WardrobeRef[],
): WardrobeProblem | null {
  if (kind !== 'storage' || isStorage(wardrobe)) return null;
  return all.some((w) => w.id !== wardrobe.id && !isStorage(w)) ? null : 'last_everyday';
}

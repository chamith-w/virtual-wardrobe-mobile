/**
 * Where an item lives: which wardrobe and zone. Keeps one invariant in step
 * with status — a piece is "In storage" exactly when it sits in a storage
 * wardrobe — so the status switcher and "Move to…" can never disagree.
 * Pure — safe to import from tests.
 */
import { CATEGORY_DEFAULT_ZONE, type Category, type ItemStatus, type ZoneType } from './catalog';
import { statusFields, type StatusExtra, type StatusFields, type StatusState } from './status';

export type WardrobeLite = { id: string; icon: string; sortOrder: number };
export type ZoneLite = { id: string; wardrobeId: string; type: ZoneType; sortOrder: number };

export type PlacedItem = StatusState & {
  wardrobeId: string;
  zoneId: string | null;
  category: Category;
};

export type PlacementPatch = Pick<PlacedItem, 'wardrobeId' | 'zoneId'> & StatusFields;

/** Storage wardrobes are the ones created with the archive icon (Home + Storage by default). */
export function isStorageWardrobe(wardrobe: Pick<WardrobeLite, 'icon'>): boolean {
  return wardrobe.icon === 'archive';
}

/**
 * The best zone for an item in a wardrobe: the same kind of zone it is in now
 * (a shelf piece stays on a shelf), else its category's default, else the
 * first zone. Shelves and drawers fall back to each other because storage
 * wardrobes usually have shelves but no drawers.
 */
export function zoneFor(
  zones: readonly ZoneLite[],
  wardrobeId: string,
  category: Category,
  preferredType?: ZoneType,
): string | null {
  const inWardrobe = zones.filter((z) => z.wardrobeId === wardrobeId).sort((a, b) => a.sortOrder - b.sortOrder);
  const defaultType = CATEGORY_DEFAULT_ZONE[category];
  const folded: ZoneType[] = ['shelf', 'drawer'];
  const candidates: ZoneType[] = [preferredType, defaultType].filter((t): t is ZoneType => !!t);
  if (folded.includes(defaultType)) candidates.push(...folded);
  for (const type of candidates) {
    const match = inWardrobe.find((z) => z.type === type);
    if (match) return match.id;
  }
  return inWardrobe[0]?.id ?? null;
}

function byId<T extends { id: string }>(rows: readonly T[], id: string | null | undefined): T | undefined {
  return id ? rows.find((r) => r.id === id) : undefined;
}

/**
 * The zone after an edit changes the category. A piece sitting in its old
 * category's kind of zone follows the new category (a top retagged as a
 * T-shirt moves from the rail to a shelf); one the user dragged somewhere
 * else stays put.
 */
export function zoneAfterCategoryChange(
  item: Pick<PlacedItem, 'wardrobeId' | 'zoneId' | 'category'>,
  next: Category,
  zones: readonly ZoneLite[],
): string | null {
  if (next === item.category) return item.zoneId;
  const current = byId(zones, item.zoneId);
  if (current && current.wardrobeId === item.wardrobeId) {
    if (current.type !== CATEGORY_DEFAULT_ZONE[item.category]) return current.id;
    if (current.type === CATEGORY_DEFAULT_ZONE[next]) return current.id;
  }
  return zoneFor(zones, item.wardrobeId, next);
}

/** The wardrobe an item returns to when it comes out of storage. */
export function homeWardrobe<W extends WardrobeLite>(wardrobes: readonly W[]): W | undefined {
  return [...wardrobes].sort((a, b) => a.sortOrder - b.sortOrder).find((w) => !isStorageWardrobe(w));
}

/**
 * Where a new piece is hung: the wardrobe on show, unless that's a storage
 * wardrobe (a new piece is in use, not stored), in which case home.
 */
export function wardrobeForNewPiece(
  wardrobes: readonly WardrobeLite[],
  activeId: string | null | undefined,
): WardrobeLite | undefined {
  const active = byId(wardrobes, activeId);
  if (active && !isStorageWardrobe(active)) return active;
  return homeWardrobe(wardrobes) ?? [...wardrobes].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/** The status a piece takes on when it moves into a wardrobe: stored in storage, back in use out of it. */
export function statusInWardrobe(current: ItemStatus, target: Pick<WardrobeLite, 'icon'> | undefined): ItemStatus {
  if (target && isStorageWardrobe(target)) return 'storage';
  return current === 'storage' ? 'in_wardrobe' : current;
}

/** Moves an item to another wardrobe, updating status if it enters or leaves storage. */
export function moveToWardrobe(
  item: PlacedItem,
  targetId: string,
  wardrobes: readonly WardrobeLite[],
  zones: readonly ZoneLite[],
  now: Date,
): PlacementPatch {
  const target = byId(wardrobes, targetId);
  const currentZoneType = byId(zones, item.zoneId)?.type;
  const zoneId = zoneFor(zones, targetId, item.category, currentZoneType);
  const status = statusInWardrobe(item.status, target);
  return { wardrobeId: targetId, zoneId, ...statusFields(item, status, now) };
}

/**
 * Applies a status from the switcher. "In storage" carries the piece to the
 * storage wardrobe; any other status brings a stored piece back home.
 */
export function applyStatus(
  item: PlacedItem,
  next: ItemStatus,
  wardrobes: readonly WardrobeLite[],
  zones: readonly ZoneLite[],
  now: Date,
  extra: StatusExtra = {},
): PlacementPatch {
  const current = byId(wardrobes, item.wardrobeId);
  const inStorage = current ? isStorageWardrobe(current) : false;

  if (next === 'storage' && !inStorage) {
    const storage = firstStorageWardrobe(wardrobes);
    if (storage) return moveToWardrobe(item, storage.id, wardrobes, zones, now);
  }
  if (next !== 'storage' && inStorage) {
    const home = homeWardrobe(wardrobes);
    if (home) {
      const moved = moveToWardrobe(item, home.id, wardrobes, zones, now);
      return { wardrobeId: moved.wardrobeId, zoneId: moved.zoneId, ...statusFields(item, next, now, extra) };
    }
  }
  return { wardrobeId: item.wardrobeId, zoneId: item.zoneId, ...statusFields(item, next, now, extra) };
}

/** Where "In storage" sends a piece: the first storage wardrobe. */
export function firstStorageWardrobe<W extends WardrobeLite>(wardrobes: readonly W[]): W | undefined {
  return [...wardrobes].sort((a, b) => a.sortOrder - b.sortOrder).find(isStorageWardrobe);
}

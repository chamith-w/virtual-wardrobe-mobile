import { and, asc, count, desc, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, wardrobes, zones, type Item, type Wardrobe, type Zone } from '@/db/schema';
import { useSession } from '@/store/session';

/** The columns the Closet and Grid need — thumbnails only, never full cutouts. */
const closetColumns = {
  id: items.id,
  wardrobeId: items.wardrobeId,
  zoneId: items.zoneId,
  name: items.name,
  category: items.category,
  subcategory: items.subcategory,
  colors: items.colors,
  brand: items.brand,
  material: items.material,
  seasons: items.seasons,
  occasions: items.occasions,
  tags: items.tags,
  price: items.price,
  currency: items.currency,
  thumbUri: items.thumbUri,
  status: items.status,
  lentTo: items.lentTo,
  lentAt: items.lentAt,
  isFavorite: items.isFavorite,
  wearCount: items.wearCount,
  lastWornAt: items.lastWornAt,
  createdAt: items.createdAt,
};

export type ClosetItem = Pick<Item, keyof typeof closetColumns>;

const live = and(isNull(items.deletedAt), ne(items.status, 'archived'));

/** All wardrobes plus the one the Wardrobe tab is showing (first by default). */
export function useActiveWardrobe() {
  const { data: all, loaded } = useLiveData(
    () => db.select().from(wardrobes).where(isNull(wardrobes.deletedAt)).orderBy(asc(wardrobes.sortOrder)),
    [wardrobes],
    [],
    [] as Wardrobe[],
  );
  const activeId = useSession((s) => s.activeWardrobeId);
  const setActive = useSession((s) => s.setActiveWardrobe);
  const active = all.find((w) => w.id === activeId) ?? all[0];
  return { wardrobes: all, active, setActive, loaded };
}

/** Every live zone, across wardrobes (moves and drag targets need them all). */
export function useZones() {
  return useLiveData(
    () => db.select().from(zones).where(isNull(zones.deletedAt)).orderBy(asc(zones.sortOrder)),
    [zones],
    [],
    [] as Zone[],
  );
}

/** Pieces in one wardrobe, oldest first (the order they were hung). */
export function useWardrobeItems(wardrobeId: string | undefined) {
  return useLiveData(
    () =>
      db
        .select(closetColumns)
        .from(items)
        .where(and(live, eq(items.wardrobeId, wardrobeId ?? '')))
        .orderBy(asc(items.createdAt)),
    [items],
    [wardrobeId],
    [] as ClosetItem[],
  );
}

/** Every live piece in every wardrobe (matches, wardrobe sheet counts). */
export function useAllItems() {
  return useLiveData(
    () => db.select(closetColumns).from(items).where(live).orderBy(desc(items.createdAt)),
    [items],
    [],
    [] as ClosetItem[],
  );
}

/** Live piece count per wardrobe id. */
export function useWardrobeCounts() {
  const { data } = useLiveData(
    () => db.select({ wardrobeId: items.wardrobeId, n: count() }).from(items).where(live).groupBy(items.wardrobeId),
    [items],
    [],
    [] as { wardrobeId: string; n: number }[],
  );
  return Object.fromEntries(data.map((r) => [r.wardrobeId, r.n])) as Record<string, number>;
}

import { and, asc, count, eq, isNull, lt, or } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { items, wardrobes, zones } from '@/db/schema';

const notDeleted = isNull(items.deletedAt);

/** Live counts by status across all wardrobes (Today tiles, Me hub). */
export function useStatusCounts() {
  const { data } = useLiveQuery(
    db.select({ status: items.status, n: count() }).from(items).where(notDeleted).groupBy(items.status),
  );
  const by = Object.fromEntries(data.map((r) => [r.status, r.n])) as Partial<Record<string, number>>;
  const total = data.reduce((s, r) => s + (r.status === 'archived' ? 0 : r.n), 0);
  return {
    total,
    inWardrobe: by.in_wardrobe ?? 0,
    worn: by.worn ?? 0,
    laundry: by.laundry ?? 0,
    lent: by.lent ?? 0,
    dryCleaner: by.dry_cleaner ?? 0,
    storage: by.storage ?? 0,
  };
}

/** Pieces not worn for `days`+ days (or never worn and older than that). */
export function useForgottenCount(days = 90, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const { data } = useLiveQuery(
    db
      .select({ n: count() })
      .from(items)
      .where(
        and(
          notDeleted,
          eq(items.status, 'in_wardrobe'),
          or(lt(items.lastWornAt, cutoff), and(isNull(items.lastWornAt), lt(items.createdAt, cutoff))),
        ),
      ),
    [cutoff.toDateString()],
  );
  return data[0]?.n ?? 0;
}

export function useWardrobes() {
  const { data } = useLiveQuery(
    db.select().from(wardrobes).where(isNull(wardrobes.deletedAt)).orderBy(asc(wardrobes.sortOrder)),
  );
  return data;
}

/** Zones of one wardrobe with their item counts. */
export function useZoneSummary(wardrobeId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select({ id: zones.id, name: zones.name, type: zones.type, n: count(items.id) })
      .from(zones)
      .leftJoin(items, and(eq(items.zoneId, zones.id), notDeleted))
      .where(and(eq(zones.wardrobeId, wardrobeId ?? ''), isNull(zones.deletedAt)))
      .groupBy(zones.id)
      .orderBy(asc(zones.sortOrder)),
    [wardrobeId],
  );
  return data;
}

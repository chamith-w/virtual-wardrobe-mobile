import { and, asc, eq, gte, isNull, lte, ne } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, wearLogItems, wearLogs } from '@/db/schema';
import type { DayKey } from '@/lib/dates';

import type { WearDay } from './engine';
import type { SuggestItem } from './garments';

/** A piece as the engine and the cards need it: its attributes plus images. */
export type LookItem = SuggestItem & { thumbUri: string | null; cutoutUri: string | null; wardrobeId: string };

const lookColumns = {
  id: items.id,
  wardrobeId: items.wardrobeId,
  name: items.name,
  category: items.category,
  subcategory: items.subcategory,
  material: items.material,
  tags: items.tags,
  colors: items.colors,
  seasons: items.seasons,
  occasions: items.occasions,
  status: items.status,
  isFavorite: items.isFavorite,
  wearCount: items.wearCount,
  lastWornAt: items.lastWornAt,
  createdAt: items.createdAt,
  thumbUri: items.thumbUri,
  cutoutUri: items.cutoutUri,
};

/** Every live piece that hasn't been archived, oldest first, with a lookup by id. */
export function useLookItems() {
  const { data, loaded } = useLiveData(
    () =>
      db
        .select(lookColumns)
        .from(items)
        .where(and(isNull(items.deletedAt), ne(items.status, 'archived')))
        .orderBy(asc(items.createdAt)),
    [items],
    [],
    [] as LookItem[],
  );
  return { items: data, byId: new Map(data.map((i) => [i.id, i])), loaded };
}

/** The pieces worn on each logged day from `from` to `to` (inclusive). */
export function useWearHistory(from: DayKey, to: DayKey) {
  return useLiveData(
    async () => {
      const rows = await db
        .select({ date: wearLogs.date, itemId: wearLogItems.itemId })
        .from(wearLogs)
        .innerJoin(wearLogItems, and(eq(wearLogItems.wearLogId, wearLogs.id), isNull(wearLogItems.deletedAt)))
        .where(and(isNull(wearLogs.deletedAt), gte(wearLogs.date, from), lte(wearLogs.date, to)))
        .orderBy(asc(wearLogs.date));
      const byDay = new Map<DayKey, string[]>();
      for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r.itemId]);
      return [...byDay].map(([date, itemIds]): WearDay => ({ date, itemIds }));
    },
    [wearLogs, wearLogItems],
    [from, to],
    [] as WearDay[],
  );
}

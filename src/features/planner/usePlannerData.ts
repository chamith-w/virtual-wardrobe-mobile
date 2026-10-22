import { and, asc, count, eq, gte, isNull, lte, sum } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import {
  items,
  outfits,
  plannedOutfits,
  tripItems,
  trips,
  wearLogItems,
  wearLogs,
  type ItemColor,
  type WeatherSnapshot,
} from '@/db/schema';
import type { Category, ItemStatus } from '@/features/items/catalog';
import type { DayKey } from '@/lib/dates';

export type PlanRow = { id: string; date: DayKey; outfitId: string };

/** Plans from `from` to `to`, one per day, for outfits that still exist. */
export function usePlans(from: DayKey, to: DayKey) {
  const { data, loaded } = useLiveData(
    () =>
      db
        .select({ id: plannedOutfits.id, date: plannedOutfits.date, outfitId: plannedOutfits.outfitId })
        .from(plannedOutfits)
        .innerJoin(outfits, and(eq(outfits.id, plannedOutfits.outfitId), isNull(outfits.deletedAt)))
        .where(and(isNull(plannedOutfits.deletedAt), gte(plannedOutfits.date, from), lte(plannedOutfits.date, to)))
        .orderBy(asc(plannedOutfits.date)),
    [plannedOutfits, outfits],
    [from, to],
    [] as PlanRow[],
  );
  return { plans: new Map(data.map((p) => [p.date, p])), loaded };
}

export type LogPiece = {
  id: string;
  name: string;
  category: Category;
  colors: ItemColor[];
  status: ItemStatus;
  wardrobeId: string;
  thumbUri: string | null;
  cutoutUri: string | null;
};

export type DayLog = {
  id: string;
  date: DayKey;
  outfitId: string | null;
  /** Kept even if the outfit was deleted since: the journal remembers. */
  outfitName: string | null;
  photoUri: string | null;
  weather: WeatherSnapshot | null;
  notes: string | null;
  pieces: LogPiece[];
};

/** Wear logs from `from` to `to`, keyed by day, with their pieces. */
export function useLogs(from: DayKey, to: DayKey) {
  const { data, loaded } = useLiveData(
    async () => {
      const rows = await db
        .select({
          id: wearLogs.id,
          date: wearLogs.date,
          outfitId: wearLogs.outfitId,
          outfitName: outfits.name,
          photoUri: wearLogs.photoUri,
          weather: wearLogs.weather,
          notes: wearLogs.notes,
          itemId: items.id,
          name: items.name,
          category: items.category,
          colors: items.colors,
          status: items.status,
          wardrobeId: items.wardrobeId,
          thumbUri: items.thumbUri,
          cutoutUri: items.cutoutUri,
        })
        .from(wearLogs)
        .leftJoin(outfits, eq(outfits.id, wearLogs.outfitId))
        .leftJoin(wearLogItems, and(eq(wearLogItems.wearLogId, wearLogs.id), isNull(wearLogItems.deletedAt)))
        .leftJoin(items, and(eq(items.id, wearLogItems.itemId), isNull(items.deletedAt)))
        .where(and(isNull(wearLogs.deletedAt), gte(wearLogs.date, from), lte(wearLogs.date, to)))
        .orderBy(asc(wearLogs.date), asc(wearLogItems.createdAt));
      const byDay = new Map<DayKey, DayLog>();
      for (const r of rows) {
        // One log per day; an older duplicate (if any) keeps the first.
        let log = byDay.get(r.date);
        if (log && log.id !== r.id) continue;
        if (!log) {
          log = {
            id: r.id,
            date: r.date,
            outfitId: r.outfitId,
            outfitName: r.outfitName,
            photoUri: r.photoUri,
            weather: r.weather,
            notes: r.notes,
            pieces: [],
          };
          byDay.set(r.date, log);
        }
        if (r.itemId && r.name && r.category && r.status && r.wardrobeId)
          log.pieces.push({
            id: r.itemId,
            name: r.name,
            category: r.category,
            colors: r.colors ?? [],
            status: r.status,
            wardrobeId: r.wardrobeId,
            thumbUri: r.thumbUri,
            cutoutUri: r.cutoutUri,
          });
      }
      return byDay;
    },
    [wearLogs, wearLogItems, outfits, items],
    [from, to],
    new Map<DayKey, DayLog>(),
  );
  return { logs: data, loaded };
}

export type TripSummary = {
  id: string;
  name: string;
  destination: string;
  startDate: DayKey;
  endDate: DayKey;
  /** Packing-list lines, counting quantities. */
  total: number;
  packed: number;
};

/** Trips that haven't ended yet, soonest first, with how much is packed. */
export function useUpcomingTrips(today: DayKey) {
  return useLiveData(
    async () => {
      const list = await db
        .select({
          id: trips.id,
          name: trips.name,
          destination: trips.destination,
          startDate: trips.startDate,
          endDate: trips.endDate,
        })
        .from(trips)
        .where(and(isNull(trips.deletedAt), gte(trips.endDate, today)))
        .orderBy(asc(trips.startDate));
      const counts = await db
        .select({ tripId: tripItems.tripId, packed: tripItems.packed, n: count(), qty: sum(tripItems.quantity) })
        .from(tripItems)
        .where(isNull(tripItems.deletedAt))
        .groupBy(tripItems.tripId, tripItems.packed);
      return list.map((t): TripSummary => {
        const rows = counts.filter((c) => c.tripId === t.id);
        const qty = (r: (typeof rows)[number]) => Number(r.qty ?? r.n);
        return {
          ...t,
          total: rows.reduce((s, r) => s + qty(r), 0),
          packed: rows.filter((r) => r.packed).reduce((s, r) => s + qty(r), 0),
        };
      });
    },
    [trips, tripItems],
    [today],
    [] as TripSummary[],
  );
}

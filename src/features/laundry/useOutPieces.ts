import { and, asc, inArray, isNull, notInArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, type Item } from '@/db/schema';

const columns = {
  id: items.id,
  name: items.name,
  category: items.category,
  wardrobeId: items.wardrobeId,
  zoneId: items.zoneId,
  thumbUri: items.thumbUri,
  status: items.status,
  statusChangedAt: items.statusChangedAt,
  lentTo: items.lentTo,
  lentAt: items.lentAt,
  remindAt: items.remindAt,
  readyAt: items.readyAt,
  createdAt: items.createdAt,
};

export type OutPiece = Pick<Item, keyof typeof columns>;

const when = (p: OutPiece) => (p.statusChangedAt ?? p.createdAt).getTime();

/**
 * Everything that's left its spot, split the way the Laundry screen shows it:
 * just worn (newest first), the basket (oldest first, so the newest lands on
 * top), the dry cleaner and lent pieces (longest away first).
 */
export function useOutPieces() {
  const { data, loaded } = useLiveData(
    () =>
      db
        .select(columns)
        .from(items)
        .where(and(isNull(items.deletedAt), inArray(items.status, ['worn', 'laundry', 'dry_cleaner', 'lent'])))
        .orderBy(asc(items.createdAt)),
    [items],
    [],
    [] as OutPiece[],
  );
  const by = (status: OutPiece['status']) => data.filter((p) => p.status === status);
  return {
    loaded,
    worn: by('worn').sort((a, b) => when(b) - when(a)),
    pile: by('laundry').sort((a, b) => when(a) - when(b)),
    cleaner: by('dry_cleaner').sort((a, b) => when(a) - when(b)),
    lent: by('lent').sort((a, b) => (a.lentAt?.getTime() ?? when(a)) - (b.lentAt?.getTime() ?? when(b))),
  };
}

export type LendablePiece = Pick<Item, 'id' | 'name' | 'category' | 'thumbUri' | 'status' | 'lentTo' | 'zoneId'>;

/** Pieces at hand that can be lent: everything not already out (or archived). */
export function useLendablePieces() {
  return useLiveData(
    () =>
      db
        .select({
          id: items.id,
          name: items.name,
          category: items.category,
          thumbUri: items.thumbUri,
          status: items.status,
          lentTo: items.lentTo,
          zoneId: items.zoneId,
        })
        .from(items)
        .where(and(isNull(items.deletedAt), notInArray(items.status, ['laundry', 'dry_cleaner', 'lent', 'archived'])))
        .orderBy(asc(items.name)),
    [items],
    [],
    [] as LendablePiece[],
  );
}

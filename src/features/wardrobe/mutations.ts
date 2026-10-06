import { db } from '@/db/client';
import { wardrobes, zones } from '@/db/schema';
import { newId } from '@/lib/ids';

import type { WardrobePlan } from './wardrobes';

/** Inserts a planned wardrobe and its zones; returns the new wardrobe's id. */
export function createWardrobe(plan: WardrobePlan): string {
  const id = newId();
  db.transaction((tx) => {
    tx.insert(wardrobes)
      .values({ id, ...plan.wardrobe })
      .run();
    tx.insert(zones)
      .values(plan.zones.map((z) => ({ id: newId(), wardrobeId: id, ...z })))
      .run();
  });
  return id;
}

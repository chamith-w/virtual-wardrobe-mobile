import { and, eq, isNull, max } from 'drizzle-orm';

import { db } from '@/db/client';
import { outfitItems } from '@/db/schema';
import { newId } from '@/lib/ids';

/**
 * Adds an item to an outfit at a neutral pose on top of the stack (the
 * builder in phase 5 lets you arrange it), or removes it. Returns the new
 * membership.
 */
export function toggleItemInOutfit(outfitId: string, itemId: string): boolean {
  return db.transaction((tx) => {
    const link = tx
      .select({ id: outfitItems.id, deletedAt: outfitItems.deletedAt })
      .from(outfitItems)
      .where(and(eq(outfitItems.outfitId, outfitId), eq(outfitItems.itemId, itemId)))
      .get();

    if (link && !link.deletedAt) {
      tx.update(outfitItems).set({ deletedAt: new Date() }).where(eq(outfitItems.id, link.id)).run();
      return false;
    }

    const top =
      tx
        .select({ z: max(outfitItems.zIndex) })
        .from(outfitItems)
        .where(and(eq(outfitItems.outfitId, outfitId), isNull(outfitItems.deletedAt)))
        .get()?.z ?? -1;
    const pose = { x: 0.5, y: 0.5, scale: 0.9, rotation: 0, zIndex: top + 1, locked: false };

    // (outfit, item) is unique, so a soft-deleted link is revived rather than re-inserted.
    if (link) tx.update(outfitItems).set({ ...pose, deletedAt: null }).where(eq(outfitItems.id, link.id)).run();
    else tx.insert(outfitItems).values({ id: newId(), outfitId, itemId, ...pose }).run();
    return true;
  });
}

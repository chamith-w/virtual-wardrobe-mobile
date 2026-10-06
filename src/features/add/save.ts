import { isNull } from 'drizzle-orm';
import { File } from 'expo-file-system';

import { db } from '@/db/client';
import { wardrobes, zones } from '@/db/schema';
import type { DraftFields } from '@/features/items/details/draft';
import { createItem } from '@/features/items/mutations';
import { wardrobeForNewPiece, zoneFor } from '@/features/items/placement';
import { haptics } from '@/lib/haptics';
import { newId } from '@/lib/ids';
import { itemDir } from '@/lib/images';
import { useSession } from '@/store/session';

import type { SavedPiece } from './flow';
import { CUTOUT_SIDE, ITEM_IMAGE_FILES, THUMB_SIDE } from './images';
import { renderWebp } from './photo';
import type { Cutout, Photo } from './segmentation';

export type SaveInput = {
  /** The working photo (upright, ≤2048px JPEG); always kept as the original. */
  photo: Photo;
  cutout: Cutout | null;
  /** Use the photo as it is instead of the cutout. */
  keepOriginal: boolean;
  fields: DraftFields;
};

async function moveInto(uri: string, dest: File) {
  if (dest.exists) dest.delete();
  await new File(uri).move(dest);
}

/**
 * Writes the piece's images to documents/items/<id>/ (original JPEG, ~1200px
 * cutout and ~400px thumb as WebP with alpha), then inserts it into its
 * category's default zone in the wardrobe on show.
 */
export async function saveNewPiece(input: SaveInput): Promise<SavedPiece> {
  const allWardrobes = db
    .select({ id: wardrobes.id, icon: wardrobes.icon, sortOrder: wardrobes.sortOrder })
    .from(wardrobes)
    .where(isNull(wardrobes.deletedAt))
    .all();
  const allZones = db
    .select({ id: zones.id, wardrobeId: zones.wardrobeId, type: zones.type, sortOrder: zones.sortOrder })
    .from(zones)
    .where(isNull(zones.deletedAt))
    .all();
  const wardrobe = wardrobeForNewPiece(allWardrobes, useSession.getState().activeWardrobeId);
  if (!wardrobe) throw new Error('There is no wardrobe to hang it in');
  const zoneId = zoneFor(allZones, wardrobe.id, input.fields.category);

  const id = newId();
  const dir = itemDir(id);
  try {
    const original = new File(dir, ITEM_IMAGE_FILES.original);
    if (original.exists) original.delete();
    await new File(input.photo.uri).copy(original);

    const source = input.keepOriginal || !input.cutout ? input.photo.uri : input.cutout.cutoutUri;
    const cutout = new File(dir, ITEM_IMAGE_FILES.cutout);
    const thumb = new File(dir, ITEM_IMAGE_FILES.thumb);
    await moveInto(await renderWebp(source, CUTOUT_SIDE, 0.9), cutout);
    await moveInto(await renderWebp(source, THUMB_SIDE, 0.86), thumb);

    createItem({
      id,
      wardrobeId: wardrobe.id,
      zoneId,
      ...input.fields,
      originalUri: original.uri,
      cutoutUri: cutout.uri,
      thumbUri: thumb.uri,
      status: 'in_wardrobe',
    });
    haptics.itemAdded();
    return { id, name: input.fields.name, thumbUri: thumb.uri, wardrobeId: wardrobe.id, zoneId };
  } catch (error) {
    // Leave nothing half-saved behind.
    if (dir.exists) dir.delete();
    throw error;
  }
}

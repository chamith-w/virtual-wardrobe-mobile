import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Garment images live in the app's documents directory — never in SQLite.
 * Layout: documents/items/<itemId>/{original,cutout,thumb}.<ext>, outfit
 * snapshots as documents/outfits/<outfitId>-<version>.png, and wear-log
 * selfies as documents/logs/<photoId>.jpg.
 */
export const itemsRoot = () => new Directory(Paths.document, 'items');
export const wishlistRoot = () => new Directory(Paths.document, 'wishlist');
export const outfitsRoot = () => new Directory(Paths.document, 'outfits');
export const logsRoot = () => new Directory(Paths.document, 'logs');

export function itemDir(itemId: string): Directory {
  const dir = new Directory(itemsRoot(), itemId);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Copies a bundled asset (require(...)) into `dest`, returning the file URI. */
export async function copyBundledAsset(moduleId: number, dest: File): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error(`Could not resolve bundled asset ${asset.name}`);
  if (dest.exists) dest.delete();
  await new File(asset.localUri).copy(dest);
  return dest.uri;
}

/** Deletes one stored image by URI, if it's still there. */
export function deleteImage(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or not ours to delete.
  }
}

/** Removes every stored garment, wishlist, outfit and selfie image. */
export function deleteAllImages() {
  for (const dir of [itemsRoot(), wishlistRoot(), outfitsRoot(), logsRoot()]) {
    if (dir.exists) dir.delete();
  }
}

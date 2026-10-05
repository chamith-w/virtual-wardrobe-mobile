import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Garment images live in the app's documents directory — never in SQLite.
 * Layout: documents/items/<itemId>/{original,cutout,thumb}.<ext>
 */
export const itemsRoot = () => new Directory(Paths.document, 'items');
export const wishlistRoot = () => new Directory(Paths.document, 'wishlist');

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

/** Removes every stored garment and wishlist image. */
export function deleteAllImages() {
  for (const dir of [itemsRoot(), wishlistRoot()]) {
    if (dir.exists) dir.delete();
  }
}

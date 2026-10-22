/**
 * The mirror selfie on a wear log: taken with the camera (or picked from
 * photos where there's no camera, as in the Simulator), resized and kept as
 * documents/logs/<id>.jpg.
 */
import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { fitInside } from '@/features/add/images';
import { newId } from '@/lib/ids';
import { logsRoot } from '@/lib/images';

const SELFIE_SIDE = 1400;

export type SelfieResult = { uri: string } | { error: 'cancelled' | 'denied' | 'blocked' | 'failed' };

async function keep(uri: string): Promise<string> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const size = fitInside(source.width, source.height, SELFIE_SIDE);
  const image = await ImageManipulator.manipulate(source).resize(size).renderAsync();
  source.release();
  try {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.84 });
    const dir: Directory = logsRoot();
    dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${newId()}.jpg`);
    await new File(saved.uri).move(dest);
    return dest.uri;
  } finally {
    image.release();
  }
}

async function fromLibrary(): Promise<SelfieResult> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (picked.canceled || !picked.assets[0]) return { error: 'cancelled' };
  return { uri: await keep(picked.assets[0].uri) };
}

/** Opens the camera for a mirror selfie; falls back to photos when there's no camera. */
export async function takeSelfie(): Promise<SelfieResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: permission.canAskAgain ? 'denied' : 'blocked' };
    let shot: ImagePicker.ImagePickerResult;
    try {
      shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    } catch {
      // No camera (the Simulator): choose a photo instead.
      return await fromLibrary();
    }
    if (shot.canceled || !shot.assets[0]) return { error: 'cancelled' };
    return { uri: await keep(shot.assets[0].uri) };
  } catch {
    return { error: 'failed' };
  }
}

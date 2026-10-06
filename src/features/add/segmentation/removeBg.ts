import { File, Paths } from 'expo-file-system';

import { newId } from '@/lib/ids';

import { normalizeBounds } from './engine';
import { SegmentationError, type Cutout } from './types';

/**
 * remove.bg, as a fallback for when on-device segmentation isn't available
 * (the iOS Simulator, mostly).
 *
 * ⚠️ DEV ONLY. `EXPO_PUBLIC_*` variables are inlined into the JavaScript
 * bundle, so this key can be pulled out of any build that ships it. Use it
 * for local testing; a production fallback must call remove.bg through our
 * own server so the key never reaches the device.
 */
const API_KEY = process.env.EXPO_PUBLIC_REMOVE_BG_KEY;
const ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

export const removeBgEnabled = typeof API_KEY === 'string' && API_KEY.length > 0;

const header = (response: Response, name: string) => {
  const value = Number(response.headers.get(name));
  return Number.isFinite(value) ? value : null;
};

/** Uploads the (already downscaled) photo and saves the returned cutout PNG. */
export async function removeBgCutout(photo: { uri: string; width: number; height: number }): Promise<Cutout> {
  if (!removeBgEnabled || !API_KEY) throw new SegmentationError('unavailable', 'No remove.bg key is set');

  const form = new FormData();
  // React Native's FormData takes a file descriptor object for uploads.
  form.append('image_file', { uri: photo.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('size', 'auto');
  form.append('format', 'png');
  form.append('crop', 'true');
  form.append('crop_margin', '4%');

  let response: Response;
  try {
    response = await fetch(ENDPOINT, { method: 'POST', headers: { 'X-Api-Key': API_KEY }, body: form });
  } catch (error) {
    throw new SegmentationError('failed', error instanceof Error ? error.message : 'Network error');
  }
  if (!response.ok) {
    const reason = response.status === 400 ? 'no-subject' : 'failed';
    throw new SegmentationError(reason, `remove.bg answered ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File(Paths.cache, `removebg-${newId()}.png`);
  file.write(bytes);

  // remove.bg reports the result size and where the subject was found in the upload.
  const width = header(response, 'X-Width') ?? 0;
  const height = header(response, 'X-Height') ?? 0;
  const left = header(response, 'X-Foreground-Left');
  const top = header(response, 'X-Foreground-Top');
  const fgWidth = header(response, 'X-Foreground-Width');
  const fgHeight = header(response, 'X-Foreground-Height');
  const bounds =
    left !== null && top !== null && fgWidth !== null && fgHeight !== null
      ? normalizeBounds({ x: left, y: top, width: fgWidth, height: fgHeight }, photo.width, photo.height)
      : null;

  return { cutoutUri: file.uri, width, height, bounds, engine: 'remove.bg' };
}

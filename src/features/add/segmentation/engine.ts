/**
 * Which background remover to use. Pure — safe to import from tests.
 */
import type { DeviceStatus, EngineId, NormalizedRect, SegmentationFailure } from './types';

/** On-device whenever the platform can (even if its model still needs downloading); remove.bg only as a fallback. */
export function chooseEngine(device: DeviceStatus, removeBgEnabled: boolean): EngineId | null {
  if (device !== 'unsupported') return 'device';
  return removeBgEnabled ? 'remove.bg' : null;
}

/** After the on-device engine fails, whether remove.bg should get a go. */
export function fallbackAfter(reason: SegmentationFailure, removeBgEnabled: boolean): EngineId | null {
  return removeBgEnabled && reason !== 'unavailable' ? 'remove.bg' : null;
}

/** Pixel bounds in the photo the model saw → fractions of that photo, clamped to it. */
export function normalizeBounds(
  bounds: { x: number; y: number; width: number; height: number } | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
): NormalizedRect | null {
  if (!bounds || sourceWidth <= 0 || sourceHeight <= 0 || bounds.width <= 0 || bounds.height <= 0) return null;
  const x = Math.max(0, Math.min(1, bounds.x / sourceWidth));
  const y = Math.max(0, Math.min(1, bounds.y / sourceHeight));
  return {
    x,
    y,
    width: Math.max(0, Math.min(1 - x, bounds.width / sourceWidth)),
    height: Math.max(0, Math.min(1 - y, bounds.height / sourceHeight)),
  };
}

/** What to tell the user when a cutout couldn't be made. */
export function failureMessage(reason: SegmentationFailure): { title: string; body: string } {
  switch (reason) {
    case 'no-subject':
      return {
        title: 'Couldn’t find the piece',
        body: 'Try a plainer background with the whole garment in frame, or keep the photo as it is.',
      };
    case 'model':
      return {
        title: 'Cutouts aren’t ready yet',
        body: 'The on-device model couldn’t download. Check your connection and try again, or keep the photo as it is.',
      };
    case 'unavailable':
      return {
        title: 'No cutouts on this device',
        body: 'Background removal runs on a real phone (iOS 17 or Android). You can keep the photo as it is.',
      };
    default:
      return { title: 'Something went wrong', body: 'Try again, or keep the photo as it is.' };
  }
}

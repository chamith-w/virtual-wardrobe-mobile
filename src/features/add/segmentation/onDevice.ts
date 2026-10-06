import SubjectSegmentation from '../../../../modules/subject-segmentation';

import { normalizeBounds } from './engine';
import { SegmentationError, type Cutout, type DeviceStatus } from './types';

/** Native error messages carry no stable code across platforms; sort them by what they say. */
function reasonOf(error: unknown): SegmentationError {
  const message = error instanceof Error ? error.message : String(error);
  if (/no subject/i.test(message)) return new SegmentationError('no-subject', message);
  if (/could not be downloaded|model/i.test(message)) return new SegmentationError('model', message);
  if (/needs iOS 17|simulator/i.test(message)) return new SegmentationError('unavailable', message);
  return new SegmentationError('failed', message);
}

export async function deviceStatus(): Promise<DeviceStatus> {
  if (!SubjectSegmentation) return 'unsupported';
  try {
    return await SubjectSegmentation.getStatusAsync();
  } catch {
    return 'unsupported';
  }
}

/**
 * Downloads the on-device model if it isn't there yet (Android, through Play
 * services), reporting 0–1 progress.
 */
export async function prepareDevice(onProgress?: (progress: number) => void): Promise<void> {
  if (!SubjectSegmentation) throw new SegmentationError('unavailable', 'Background removal isn’t in this build');
  const subscription = onProgress
    ? SubjectSegmentation.addListener('onPrepareProgress', ({ progress }) => onProgress(progress))
    : null;
  try {
    await SubjectSegmentation.prepareAsync();
  } catch (error) {
    throw reasonOf(error);
  } finally {
    subscription?.remove();
  }
}

export async function deviceCutout(photoUri: string): Promise<Cutout> {
  if (!SubjectSegmentation) throw new SegmentationError('unavailable', 'Background removal isn’t in this build');
  try {
    const result = await SubjectSegmentation.removeBackgroundAsync(photoUri, { maxSide: 2048, padding: 0.04 });
    return {
      cutoutUri: result.uri,
      width: result.width,
      height: result.height,
      bounds: normalizeBounds(result.bounds, result.sourceWidth, result.sourceHeight),
      engine: 'device',
    };
  } catch (error) {
    throw reasonOf(error);
  }
}

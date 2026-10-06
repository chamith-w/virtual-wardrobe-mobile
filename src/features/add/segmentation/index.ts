/**
 * One way in for background removal: `removeBackground(photo)`. On-device by
 * default (modules/subject-segmentation); remove.bg when that's unavailable
 * and a dev key is set. See engine.ts for the choice.
 */
import { chooseEngine, fallbackAfter } from './engine';
import { deviceCutout, deviceStatus, prepareDevice } from './onDevice';
import { removeBgCutout, removeBgEnabled } from './removeBg';
import { SegmentationError, type Cutout, type DeviceStatus, type EngineId } from './types';

export * from './types';
export { failureMessage } from './engine';
export { refineAvailable } from './refine';
export { removeBgEnabled } from './removeBg';

export type Photo = { uri: string; width: number; height: number };

export async function segmentationStatus(): Promise<{ device: DeviceStatus; engine: EngineId | null }> {
  const device = await deviceStatus();
  return { device, engine: chooseEngine(device, removeBgEnabled) };
}

export type RemoveOptions = {
  /** Called while the on-device model downloads (0–1); null once it's ready. */
  onPreparing?: (progress: number | null) => void;
};

/** Lifts the garment off the photo's background. Throws `SegmentationError`. */
export async function removeBackground(photo: Photo, options: RemoveOptions = {}): Promise<Cutout> {
  const { device, engine } = await segmentationStatus();
  if (engine === null) {
    throw new SegmentationError('unavailable', 'On-device background removal isn’t available here');
  }
  if (engine === 'remove.bg') return removeBgCutout(photo);

  try {
    if (device === 'needs-download') {
      options.onPreparing?.(0);
      await prepareDevice((p) => options.onPreparing?.(p));
      options.onPreparing?.(null);
    }
    return await deviceCutout(photo.uri);
  } catch (error) {
    const failure = error instanceof SegmentationError ? error : new SegmentationError('failed', String(error));
    options.onPreparing?.(null);
    if (fallbackAfter(failure.reason, removeBgEnabled) === 'remove.bg') return removeBgCutout(photo);
    throw failure;
  }
}

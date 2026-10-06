/** A rectangle as fractions (0–1) of the photo it came from. */
export type NormalizedRect = { x: number; y: number; width: number; height: number };

export type EngineId = 'device' | 'remove.bg';

/** On-device segmentation availability (see modules/subject-segmentation). */
export type DeviceStatus = 'ready' | 'needs-download' | 'unsupported';

/** A garment lifted off its background. */
export type Cutout = {
  /** `file://` PNG with alpha, cropped to the garment plus a small margin. */
  cutoutUri: string;
  width: number;
  height: number;
  /** Where the cutout sat in the photo, so the reveal can dissolve the background around it. */
  bounds: NormalizedRect | null;
  engine: EngineId;
};

export type SegmentationFailure =
  /** Nothing can cut out on this device (Simulator, or no build with the module) and no remove.bg key. */
  | 'unavailable'
  /** The model looked and found no subject. */
  | 'no-subject'
  /** The on-device model couldn't be downloaded (Android, Play services). */
  | 'model'
  | 'failed';

export class SegmentationError extends Error {
  constructor(
    readonly reason: SegmentationFailure,
    message: string,
  ) {
    super(message);
    this.name = 'SegmentationError';
  }
}

/**
 * - `ready`: segmentation can run now.
 * - `needs-download`: Android only; the ML Kit model comes through Google Play
 *   services on first use (call `prepareAsync`).
 * - `unsupported`: no on-device segmentation here (iOS Simulator, or the
 *   native module isn't in this build yet).
 */
export type SegmentationStatus = 'ready' | 'needs-download' | 'unsupported';

export type SegmentOptions = {
  /** Longest side, in pixels, of the photo handed to the model. Default 2048. */
  maxSide?: number;
  /** Transparent margin around the subject, as a fraction of its longer side. Default 0.04. */
  padding?: number;
};

export type PixelRect = { x: number; y: number; width: number; height: number };

export type NativeSegmentation = {
  /** `file://` URI of a PNG with alpha, cropped to the subject plus padding. */
  uri: string;
  width: number;
  height: number;
  /** Size of the upright, scaled photo the model saw. */
  sourceWidth: number;
  sourceHeight: number;
  /** Where the cutout sits in that photo, in its pixels. */
  bounds: PixelRect;
};

export type SubjectSegmentationEvents = {
  /** 0–1 while Play services downloads the model (Android). */
  onPrepareProgress: (event: { progress: number }) => void;
};

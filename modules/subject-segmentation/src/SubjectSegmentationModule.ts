import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  NativeSegmentation,
  SegmentationStatus,
  SegmentOptions,
  SubjectSegmentationEvents,
} from './SubjectSegmentation.types';

declare class SubjectSegmentationModule extends NativeModule<SubjectSegmentationEvents> {
  getStatusAsync(): Promise<SegmentationStatus>;
  prepareAsync(): Promise<SegmentationStatus>;
  removeBackgroundAsync(uri: string, options: SegmentOptions): Promise<NativeSegmentation>;
}

/** Null until the app is rebuilt with this module (and on web). */
export default requireOptionalNativeModule<SubjectSegmentationModule>('SubjectSegmentation');

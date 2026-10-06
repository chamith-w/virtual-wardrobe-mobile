/**
 * On-device subject segmentation for garment cutouts: Vision's foreground
 * instance mask on iOS 17+, ML Kit Subject Segmentation on Android.
 * App code should go through src/features/add/segmentation, not this module.
 */
export { default } from './src/SubjectSegmentationModule';
export * from './src/SubjectSegmentation.types';

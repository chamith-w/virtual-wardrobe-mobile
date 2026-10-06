/**
 * Stretch goal, not built yet: an eraser / restore brush to touch up a
 * cutout's mask with Skia paths. The shapes below are the intended contract
 * so the review screen can grow a "Refine edges" mode without reshaping the
 * segmentation API. The button stays hidden until this exists.
 */
import type { Cutout } from './types';

export type BrushMode = 'erase' | 'restore';

/** One finger stroke in cutout pixel coordinates. */
export type BrushStroke = {
  mode: BrushMode;
  /** Brush diameter in cutout pixels. */
  size: number;
  points: { x: number; y: number }[];
};

export type RefineInput = {
  cutout: Cutout;
  /** The photo the cutout came from: "restore" paints its pixels back in. */
  photoUri: string;
  strokes: BrushStroke[];
};

export const refineAvailable = false;

export async function refineCutout(input: RefineInput): Promise<Cutout> {
  void input;
  throw new Error('Refining cutouts isn’t built yet');
}

/**
 * Geometry for the thumbnail → detail "shared element" flight. The hero is
 * laid out at its destination (the detail stage) and starts with a uniform
 * scale and offset that put its garment exactly over the thumbnail it came
 * from. Pure — safe to import from tests.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export type HeroPose = { translateX: number; translateY: number; scale: number };

export const IDENTITY_POSE: HeroPose = { translateX: 0, translateY: 0, scale: 1 };

/** Where an image of `aspect` (width ÷ height) lands when `contain`-fitted into `box`. */
export function containRect(box: Rect, aspect: number): Rect {
  if (!(aspect > 0) || box.width <= 0 || box.height <= 0) return box;
  const wide = box.width / box.height > aspect;
  const width = wide ? box.height * aspect : box.width;
  const height = wide ? box.height : box.width / aspect;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/**
 * The pose (applied about the target's centre) that maps the garment drawn in
 * `target` onto the garment drawn in `source`. Both boxes contain-fit the same
 * image, so the scale is uniform and the garment never stretches. Without a
 * known `aspect`, the source box's own shape stands in for it.
 */
export function heroPose(source: Rect, target: Rect, aspect: number | null | undefined): HeroPose {
  if (target.width <= 0 || target.height <= 0) return IDENTITY_POSE;
  const a = aspect && aspect > 0 ? aspect : source.width / source.height;
  const from = containRect(source, a);
  const to = containRect(target, a);
  return {
    translateX: from.x + from.width / 2 - (to.x + to.width / 2),
    translateY: from.y + from.height / 2 - (to.y + to.height / 2),
    scale: to.width > 0 ? from.width / to.width : 1,
  };
}

/** Linear blend between the start pose (p = 0) and resting at the target (p = 1). */
export function poseAt(start: HeroPose, p: number): HeroPose {
  'worklet';
  return {
    translateX: start.translateX * (1 - p),
    translateY: start.translateY * (1 - p),
    scale: start.scale + (1 - start.scale) * p,
  };
}

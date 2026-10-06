/**
 * Geometry of the outfit board (OutfitBuilder.dc.html). Pure, and every
 * function is a worklet, so gestures run it on the UI thread and tests run it
 * in Jest.
 *
 * Coordinates:
 *  - A piece's pose is stored normalised: `x` and `y` are its centre as a
 *    fraction of the board's width and height, `scale` is relative to the
 *    base size, `rotation` is in degrees. That's what `outfit_items` keeps.
 *  - On screen the board is `width` × `width × BOARD_ASPECT` points. At scale
 *    1 a garment's longest visible side is `PIECE_BASE × width`.
 *  - A garment's box is its visible content (the cutout's opaque bounds), not
 *    the image, so outlines, snapping and hit tests hug the garment.
 */
import type { Category } from '@/features/items/catalog';
import { CATEGORY_ROLE } from '@/features/items/catalog';

/** Board height ÷ width, from the prototype's 366 × 476 board. Fixed, so a layout restores exactly on any screen. */
export const BOARD_ASPECT = 1.3;
/** Longest visible side of a garment at scale 1, as a fraction of the board width. */
export const PIECE_BASE = 0.4;
export const MIN_SCALE = 0.35;
export const MAX_SCALE = 2.6;
/** Snap guides catch within this many points. */
export const SNAP_DISTANCE = 8;
/** Rotation settles on a right angle within this many degrees. */
export const ROTATION_SNAP = 4;
/** Every piece can be grabbed by at least a 44pt square. */
const MIN_TOUCH_HALF = 22;
/** The dashed outline sits this far outside the garment. */
export const OUTLINE_PAD = 6;
/** The corner handle's touch radius. */
export const HANDLE_RADIUS = 26;

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** What `outfit_items` stores for a piece. */
export type NormalisedPose = { x: number; y: number; scale: number; rotation: number };

/** A pose in board points. */
export type CanvasPose = { cx: number; cy: number; scale: number; rotation: number };

/** A piece placed on the board: its pose plus the aspect (width ÷ height) of its visible garment. */
export type PlacedPiece = CanvasPose & { aspect: number };

export function boardSize(width: number): Size {
  'worklet';
  return { width, height: width * BOARD_ASPECT };
}

export function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

export function clampScale(scale: number): number {
  'worklet';
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** Degrees in (−180, 180]. */
export function normaliseRotation(deg: number): number {
  'worklet';
  let r = deg % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r;
}

export function toCanvas(pose: NormalisedPose, board: Size): CanvasPose {
  'worklet';
  return { cx: pose.x * board.width, cy: pose.y * board.height, scale: pose.scale, rotation: pose.rotation };
}

export function toNormalised(pose: CanvasPose, board: Size): NormalisedPose {
  'worklet';
  return {
    x: board.width > 0 ? pose.cx / board.width : 0.5,
    y: board.height > 0 ? pose.cy / board.height : 0.5,
    scale: pose.scale,
    rotation: normaliseRotation(pose.rotation),
  };
}

/** The visible garment's size in points at a given scale. */
export function contentSize(aspect: number, scale: number, boardWidth: number): Size {
  'worklet';
  const long = PIECE_BASE * boardWidth * scale;
  const a = aspect > 0 ? aspect : 1;
  return a >= 1 ? { width: long, height: long / a } : { width: long * a, height: long };
}

/** Half-extents of a rotated w × h box's axis-aligned bounds. */
export function rotatedHalfExtents(width: number, height: number, rotationDeg: number): Size {
  'worklet';
  const t = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return { width: (width / 2) * c + (height / 2) * s, height: (width / 2) * s + (height / 2) * c };
}

/** A placed piece's axis-aligned bounds in points. */
export function pieceBounds(piece: PlacedPiece, boardWidth: number): Rect {
  'worklet';
  const size = contentSize(piece.aspect, piece.scale, boardWidth);
  const half = rotatedHalfExtents(size.width, size.height, piece.rotation);
  return { x: piece.cx - half.width, y: piece.cy - half.height, width: half.width * 2, height: half.height * 2 };
}

/** A point in the piece's own (unrotated, centred) frame. */
export function toLocal(point: Point, piece: CanvasPose): Point {
  'worklet';
  const t = (piece.rotation * Math.PI) / 180;
  const dx = point.x - piece.cx;
  const dy = point.y - piece.cy;
  return { x: dx * Math.cos(t) + dy * Math.sin(t), y: -dx * Math.sin(t) + dy * Math.cos(t) };
}

export function containsPoint(piece: PlacedPiece, point: Point, boardWidth: number): boolean {
  'worklet';
  const size = contentSize(piece.aspect, piece.scale, boardWidth);
  const local = toLocal(point, piece);
  const hw = Math.max(size.width / 2 + 4, MIN_TOUCH_HALF);
  const hh = Math.max(size.height / 2 + 4, MIN_TOUCH_HALF);
  return Math.abs(local.x) <= hw && Math.abs(local.y) <= hh;
}

/** The topmost piece under a point (highest z first), or null. */
export function hitTest<T extends PlacedPiece & { id: string; z: number }>(
  pieces: readonly T[],
  point: Point,
  boardWidth: number,
): string | null {
  'worklet';
  let best: T | null = null;
  for (const p of pieces) {
    if (!containsPoint(p, point, boardWidth)) continue;
    if (!best || p.z > best.z) best = p;
  }
  return best ? best.id : null;
}

/** Where the corner handle sits: the outline's bottom-right corner, turned with the piece. */
export function handlePoint(piece: PlacedPiece, boardWidth: number): Point {
  'worklet';
  const size = contentSize(piece.aspect, piece.scale, boardWidth);
  const lx = size.width / 2 + OUTLINE_PAD;
  const ly = size.height / 2 + OUTLINE_PAD;
  const t = (piece.rotation * Math.PI) / 180;
  return { x: piece.cx + lx * Math.cos(t) - ly * Math.sin(t), y: piece.cy + lx * Math.sin(t) + ly * Math.cos(t) };
}

export function isOnHandle(piece: PlacedPiece, point: Point, boardWidth: number): boolean {
  'worklet';
  const h = handlePoint(piece, boardWidth);
  return Math.hypot(point.x - h.x, point.y - h.y) <= HANDLE_RADIUS;
}

/**
 * Dragging the corner handle: rotation follows the finger's angle around the
 * centre, scale follows its distance, both relative to where the drag began.
 */
export function handleTransform(
  start: { scale: number; rotation: number; angle: number; distance: number },
  centre: Point,
  finger: Point,
): { scale: number; rotation: number } {
  'worklet';
  const angle = Math.atan2(finger.y - centre.y, finger.x - centre.x);
  const distance = Math.max(1, Math.hypot(finger.x - centre.x, finger.y - centre.y));
  return {
    scale: clampScale((start.scale * distance) / Math.max(1, start.distance)),
    rotation: normaliseRotation(start.rotation + ((angle - start.angle) * 180) / Math.PI),
  };
}

/** Settles a rotation on 0°, ±90° or 180° when it's within `ROTATION_SNAP`. */
export function snapRotation(deg: number): { rotation: number; snapped: boolean } {
  'worklet';
  const r = normaliseRotation(deg);
  const nearest = Math.round(r / 90) * 90;
  if (Math.abs(r - nearest) <= ROTATION_SNAP) return { rotation: normaliseRotation(nearest), snapped: true };
  return { rotation: r, snapped: false };
}

// ---------------------------------------------------------------- snapping --

/**
 * A line something can snap to. Centre lines (the board's and other pieces'
 * centres) catch a moving piece's centre; edges catch its edges.
 */
export type SnapLine = { at: number; edge: boolean };
export type SnapTargets = { xs: SnapLine[]; ys: SnapLine[] };

/** The board's centre lines plus every other piece's centres and edges. */
export function snapTargets(others: readonly PlacedPiece[], board: Size): SnapTargets {
  'worklet';
  const xs: SnapLine[] = [{ at: board.width / 2, edge: false }];
  const ys: SnapLine[] = [{ at: board.height / 2, edge: false }];
  for (const p of others) {
    const b = pieceBounds(p, board.width);
    xs.push({ at: p.cx, edge: false }, { at: b.x, edge: true }, { at: b.x + b.width, edge: true });
    ys.push({ at: p.cy, edge: false }, { at: b.y, edge: true }, { at: b.y + b.height, edge: true });
  }
  return { xs, ys };
}

/** The nearest line within `threshold` of a moving span (lo, centre, hi): how far to shift, and the guide to draw. */
export function snapAxis(
  lo: number,
  mid: number,
  hi: number,
  lines: readonly SnapLine[],
  threshold?: number,
): { delta: number; guide: number } | null {
  'worklet';
  // Not a default parameter: worklets only carry over constants their body uses.
  const limit = threshold === undefined ? SNAP_DISTANCE : threshold;
  let best: { delta: number; guide: number } | null = null;
  for (const line of lines) {
    const candidates = line.edge ? [lo, hi] : [mid];
    for (const v of candidates) {
      const d = line.at - v;
      if (Math.abs(d) > limit) continue;
      if (!best || Math.abs(d) < Math.abs(best.delta)) best = { delta: d, guide: line.at };
    }
  }
  return best;
}

export type SnapResult = { cx: number; cy: number; guideX: number | null; guideY: number | null };

/** Snaps a moving piece's centre so it lines up with the targets on each axis independently. */
export function snapPiece(moving: PlacedPiece, targets: SnapTargets, boardWidth: number): SnapResult {
  'worklet';
  const b = pieceBounds(moving, boardWidth);
  const sx = snapAxis(b.x, moving.cx, b.x + b.width, targets.xs);
  const sy = snapAxis(b.y, moving.cy, b.y + b.height, targets.ys);
  return {
    cx: moving.cx + (sx ? sx.delta : 0),
    cy: moving.cy + (sy ? sy.delta : 0),
    guideX: sx ? sx.guide : null,
    guideY: sy ? sy.guide : null,
  };
}

/** A dragged centre never leaves the board, so a piece can't be lost off the edge. */
export function clampToBoard(point: Point, board: Size): Point {
  'worklet';
  return { x: clamp(point.x, 0, board.width), y: clamp(point.y, 0, board.height) };
}

// --------------------------------------------------------------- placement --

type Role = (typeof CATEGORY_ROLE)[Category];

/**
 * Where a piece lands when tapped in from the tray: a flat-lay spot per role,
 * so tapping a top, bottoms and shoes composes itself. (The demo outfits use
 * the same spots.)
 */
export const ROLE_POSE: Record<Role, NormalisedPose> = {
  layer: { x: 0.26, y: 0.33, scale: 1, rotation: -6 },
  top: { x: 0.5, y: 0.3, scale: 0.95, rotation: 2 },
  one_piece: { x: 0.56, y: 0.4, scale: 1.05, rotation: 2 },
  bottom: { x: 0.72, y: 0.42, scale: 0.92, rotation: 5 },
  shoes: { x: 0.3, y: 0.72, scale: 0.9, rotation: -3 },
  accessory: { x: 0.76, y: 0.71, scale: 0.7, rotation: 7 },
  basic: { x: 0.5, y: 0.6, scale: 0.75, rotation: 0 },
};

/**
 * A spot for a new piece of `category`: its role's spot, nudged down and
 * across (and tilted the other way) for each piece already sitting there.
 */
export function placeNewPiece(category: Category, existing: readonly NormalisedPose[]): NormalisedPose {
  const base = ROLE_POSE[CATEGORY_ROLE[category]];
  let pose = base;
  for (let n = 1; n <= 6; n++) {
    const crowded = existing.some((p) => Math.abs(p.x - pose.x) < 0.06 && Math.abs(p.y - pose.y) < 0.05);
    if (!crowded) return pose;
    const dir = base.x > 0.5 ? -1 : 1;
    pose = {
      x: clamp(base.x + dir * 0.07 * n, 0.12, 0.88),
      y: clamp(base.y + 0.05 * n, 0.1, 0.9),
      scale: base.scale,
      rotation: n % 2 ? -base.rotation - 3 : base.rotation,
    };
  }
  return pose;
}

// ------------------------------------------------------------------- frame --

/** Snapshot heights stay within these multiples of their width, so the masonry never gets a sliver. */
export const FRAME_MIN_ASPECT = 0.9;
export const FRAME_MAX_ASPECT = BOARD_ASPECT;
const FRAME_PAD = 0.05;

/**
 * The part of the board worth showing in a thumbnail, in board-width units
 * (the board is 1 wide and BOARD_ASPECT tall): every piece's bounds plus a
 * margin, kept inside the board and between FRAME_MIN_ASPECT and
 * FRAME_MAX_ASPECT tall. Pieces count as squares of their longest side, so the
 * frame is known before any image loads and the card never resizes.
 */
export function contentFrame(pieces: readonly NormalisedPose[]): Rect {
  const W = 1;
  const H = BOARD_ASPECT;
  if (pieces.length === 0) return { x: 0, y: 0, width: W, height: H };

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pieces) {
    const long = PIECE_BASE * p.scale;
    const half = rotatedHalfExtents(long, long, p.rotation);
    x0 = Math.min(x0, p.x * W - half.width);
    x1 = Math.max(x1, p.x * W + half.width);
    y0 = Math.min(y0, p.y * H - half.height);
    y1 = Math.max(y1, p.y * H + half.height);
  }
  x0 = Math.max(0, x0 - FRAME_PAD);
  y0 = Math.max(0, y0 - FRAME_PAD);
  x1 = Math.min(W, x1 + FRAME_PAD);
  y1 = Math.min(H, y1 + FRAME_PAD);

  // Grow the short side around its centre, sliding back inside the board,
  // until the aspect fits. The board itself is FRAME_MAX_ASPECT tall, so
  // there's always room.
  const grow = (lo: number, hi: number, length: number, limit: number) => {
    const target = Math.min(length, limit);
    const mid = (lo + hi) / 2;
    const a = clamp(mid - target / 2, 0, limit - target);
    return [a, a + target] as const;
  };
  const w = x1 - x0;
  const h = y1 - y0;
  if (h / w > FRAME_MAX_ASPECT) [x0, x1] = grow(x0, x1, h / FRAME_MAX_ASPECT, W);
  else if (h / w < FRAME_MIN_ASPECT) [y0, y1] = grow(y0, y1, w * FRAME_MIN_ASPECT, H);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function frameAspect(pieces: readonly NormalisedPose[]): number {
  const f = contentFrame(pieces);
  return f.height / f.width;
}

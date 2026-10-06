import {
  Canvas,
  DashPathEffect,
  Group,
  Line,
  Points,
  RoundedRect,
  rect,
  rrect,
  vec,
  type Transforms3d,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { durations, springs } from '@/theme/tokens';

import { contentSize, OUTLINE_PAD, type Point } from '../canvas';
import { GarmentArt, type SceneShadow } from '../OutfitScene';
import type { PieceArt } from '../pieceArt';

/** A piece as the UI thread sees it: normalised pose plus its garment's aspect. */
export type LivePiece = { x: number; y: number; scale: number; rotation: number; z: number; aspect: number };
export type LiveMap = Record<string, LivePiece>;

/** Shared values the board's gestures drive and its layers read. */
export type BoardMotion = {
  live: SharedValue<LiveMap>;
  /** The selected piece, '' for none. */
  selected: SharedValue<string>;
  /** The piece a gesture is moving, '' for none. */
  activeId: SharedValue<string>;
  /** Snap guide positions in points, −1 when hidden. */
  guideX: SharedValue<number>;
  guideY: SharedValue<number>;
  /** 1 while a piece is being dragged (the trash is up). */
  dragging: SharedValue<number>;
  /** 1 while the dragged piece is over the trash. */
  hot: SharedValue<number>;
  /** 0 → 1 as a grabbed piece lifts. */
  lift: SharedValue<number>;
  /** A piece dropped on the trash, shrinking into it as `exitT` goes 0 → 1. */
  exitId: SharedValue<string>;
  exitT: SharedValue<number>;
};

/** How a piece arrives: popping in from the tray or a shuffle, fading in when an outfit opens. */
export type Entrance = 'pop' | 'fade';

const DOT_GAP = 18;
const HIDDEN: Transforms3d = [{ scale: 0 }];

function CanvasPiece({
  id,
  art,
  entrance,
  tilt,
  motion,
  width,
  height,
  trash,
  shadow,
}: {
  id: string;
  art: PieceArt;
  entrance: Entrance;
  /** Degrees the pop starts turned by. */
  tilt: number;
  motion: BoardMotion;
  width: number;
  height: number;
  trash: Point;
  shadow: SceneShadow;
}) {
  const reduced = useMotionReduced();
  const size = contentSize(art.aspect, 1, width);
  const appear = useSharedValue(0);
  const pop = entrance === 'pop' && !reduced;

  useEffect(() => {
    // Prototype popA/popB: from half size and ±10°, overshooting to ~1.08.
    appear.set(
      pop ? withSpring(1, springs.bouncy) : withTiming(1, { duration: reduced ? durations.reducedFade : 260 }),
    );
    // Arrives once, when it first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transform = useDerivedValue<Transforms3d>(() => {
    const p = motion.live.get()[id];
    if (!p) return HIDDEN;
    const a = appear.get();
    let cx = p.x * width;
    let cy = p.y * height;
    let s = p.scale;
    let r = p.rotation;
    if (pop) {
      s *= 0.5 + 0.5 * a;
      r += tilt * (1 - Math.min(1, a));
    }
    if (motion.activeId.get() === id) s *= 1 + 0.04 * motion.lift.get();
    if (motion.exitId.get() === id) {
      const t = motion.exitT.get();
      cx += (trash.x - cx) * t;
      cy += (trash.y - cy) * t;
      s *= 1 - 0.8 * t;
    }
    return [{ translateX: cx }, { translateY: cy }, { rotate: (r * Math.PI) / 180 }, { scale: s }];
  });

  const opacity = useDerivedValue(() => {
    const a = appear.get();
    let o = pop ? Math.min(1, a * 1.6) : a;
    if (motion.activeId.get() === id && motion.hot.get() > 0) o *= 0.4;
    if (motion.exitId.get() === id) o *= 1 - motion.exitT.get();
    return o;
  });

  return (
    <Group transform={transform} opacity={opacity}>
      <GarmentArt art={art} width={size.width} height={size.height} shadow={shadow} />
    </Group>
  );
}

/** The dashed outline round the selected garment (OutfitBuilder.dc.html), turned with it. */
function SelectionOutline({
  motion,
  width,
  height,
  color,
}: {
  motion: BoardMotion;
  width: number;
  height: number;
  color: string;
}) {
  const transform = useDerivedValue<Transforms3d>(() => {
    const p = motion.live.get()[motion.selected.get()];
    if (!p) return HIDDEN;
    return [{ translateX: p.x * width }, { translateY: p.y * height }, { rotate: (p.rotation * Math.PI) / 180 }];
  });
  const box = useDerivedValue(() => {
    const p = motion.live.get()[motion.selected.get()];
    if (!p) return rrect(rect(0, 0, 0, 0), 0, 0);
    const s = contentSize(p.aspect, p.scale, width);
    return rrect(
      rect(
        -s.width / 2 - OUTLINE_PAD,
        -s.height / 2 - OUTLINE_PAD,
        s.width + OUTLINE_PAD * 2,
        s.height + OUTLINE_PAD * 2,
      ),
      12,
      12,
    );
  });
  const opacity = useDerivedValue(() => {
    const id = motion.selected.get();
    return id && motion.live.get()[id] && motion.exitId.get() !== id ? 1 : 0;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect rect={box} style="stroke" strokeWidth={1.5} color={color}>
        <DashPathEffect intervals={[6, 5]} />
      </RoundedRect>
    </Group>
  );
}

/** The vertical and horizontal snap guides, full height and width of the board. */
function Guides({
  motion,
  width,
  height,
  color,
}: {
  motion: BoardMotion;
  width: number;
  height: number;
  color: string;
}) {
  const x1 = useDerivedValue(() => vec(motion.guideX.get(), 0));
  const x2 = useDerivedValue(() => vec(motion.guideX.get(), height));
  const xOpacity = useDerivedValue(() => (motion.guideX.get() >= 0 ? 1 : 0));
  const y1 = useDerivedValue(() => vec(0, motion.guideY.get()));
  const y2 = useDerivedValue(() => vec(width, motion.guideY.get()));
  const yOpacity = useDerivedValue(() => (motion.guideY.get() >= 0 ? 1 : 0));
  return (
    <>
      <Line p1={x1} p2={x2} color={color} strokeWidth={1.5} opacity={xOpacity}>
        <DashPathEffect intervals={[5, 4]} />
      </Line>
      <Line p1={y1} p2={y2} color={color} strokeWidth={1.5} opacity={yOpacity}>
        <DashPathEffect intervals={[5, 4]} />
      </Line>
    </>
  );
}

export type CanvasPieceSpec = { id: string; art: PieceArt; entrance: Entrance; tilt: number };

/**
 * Everything drawn on the board, in one Skia canvas so it all moves on the UI
 * thread: the faint dot grid, the garments back to front, snap guides and the
 * selection outline.
 */
export function BoardCanvas({
  pieces,
  motion,
  width,
  height,
  trash,
  shadow,
  dotColor,
  accent,
}: {
  /** Back to front. */
  pieces: readonly CanvasPieceSpec[];
  motion: BoardMotion;
  width: number;
  height: number;
  trash: Point;
  shadow: SceneShadow;
  dotColor: string;
  accent: string;
}) {
  const dots = [];
  for (let y = DOT_GAP / 2; y < height; y += DOT_GAP) {
    for (let x = DOT_GAP / 2; x < width; x += DOT_GAP) dots.push(vec(x, y));
  }
  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      <Points points={dots} mode="points" color={dotColor} strokeWidth={2} strokeCap="round" />
      {pieces.map((p) => (
        <CanvasPiece
          key={p.id}
          id={p.id}
          art={p.art}
          entrance={p.entrance}
          tilt={p.tilt}
          motion={motion}
          width={width}
          height={height}
          trash={trash}
          shadow={shadow}
        />
      ))}
      <Guides motion={motion} width={width} height={height} color={accent} />
      <SelectionOutline motion={motion} width={width} height={height} color={accent} />
    </Canvas>
  );
}

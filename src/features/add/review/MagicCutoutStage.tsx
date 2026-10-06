import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect as SvgRect } from 'react-native-svg';

import { Cutout, useCutoutImage } from '@/components/ui';
import { heroPose, poseAt, type Rect as Box } from '@/features/items/detail/hero';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import type { Cutout as CutoutResult, Photo } from '../segmentation';

/** DESIGN.md #3: the background blurs, scales 1.06 and fades over 1.1s. */
const DISSOLVE_MS = 1100;
const DISSOLVE_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const PRESENT_PADDING = 28;

function Checkerboard({ width, height }: { width: number; height: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id="checker" width={24} height={24} patternUnits="userSpaceOnUse">
          <SvgRect width={24} height={24} fill={colors.surface} />
          <SvgRect width={12} height={12} fill={colors.surfaceTinted} />
          <SvgRect x={12} y={12} width={12} height={12} fill={colors.surfaceTinted} />
        </Pattern>
      </Defs>
      <SvgRect width={width} height={height} fill="url(#checker)" />
    </Svg>
  );
}

/** A diagonal band of light sweeping across every 1.25s while the cutout is being made. */
function Shimmer({ width, height }: { width: number; height: number }) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const sweep = useSharedValue(0);
  const band = width * 0.55;
  const light = isDark ? colors.ink : colors.surface;

  useEffect(() => {
    sweep.set(
      withRepeat(
        reduced
          ? withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
          : withTiming(1, { duration: durations.shimmer, easing: Easing.inOut(Easing.quad) }),
        -1,
        reduced,
      ),
    );
  }, [reduced, sweep]);

  const style = useAnimatedStyle(() => {
    const p = sweep.get();
    if (reduced) return { opacity: 0.25 + 0.35 * p, transform: [{ translateX: (width - band) / 2 }] };
    return { opacity: 1, transform: [{ translateX: interpolate(p, [0, 1], [-band * 1.4, width + band * 0.4]) }] };
  });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View style={[{ position: 'absolute', top: -height * 0.3, width: band, height: height * 1.6 }, style]}>
        <View style={{ flex: 1, transform: [{ rotate: '15deg' }] }}>
          <Canvas style={{ flex: 1 }}>
            <Rect x={0} y={0} width={band} height={height * 1.6}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(band, 0)}
                colors={[withAlpha(light, 0), withAlpha(light, 0.42), withAlpha(light, 0)]}
              />
            </Rect>
          </Canvas>
        </View>
      </Animated.View>
    </View>
  );
}

export type MagicCutoutStageProps = {
  width: number;
  height: number;
  photo: Photo | null;
  cutout: CutoutResult | null;
  /** Still working (preparing the model or segmenting). */
  scanning: boolean;
  /** Show the photo as it is instead of the cutout. */
  keepOriginal: boolean;
  /** The status pill, bottom-left. */
  status: ReactNode;
};

/**
 * DESIGN.md #3, the magic cutout: while segmenting, a shimmer sweeps the
 * photo; when the mask is ready the background blurs and dissolves, a
 * checkerboard flashes, and the garment lifts off where it stood and settles
 * in the middle. "Keep original" plays it backwards. Reduce Motion fades.
 */
export function MagicCutoutStage({
  width,
  height,
  photo,
  cutout,
  scanning,
  keepOriginal,
  status,
}: MagicCutoutStageProps) {
  const reduced = useMotionReduced();
  const image = useCutoutImage(cutout?.cutoutUri);
  const reveal = useSharedValue(0);
  const settle = useSharedValue(0);
  const lift = useSharedValue(0);
  const showCutout = !!cutout && !keepOriginal;

  useEffect(() => {
    const to = showCutout ? 1 : 0;
    const duration = reduced ? durations.reducedFade : DISSOLVE_MS;
    reveal.set(withTiming(to, { duration, easing: DISSOLVE_EASING }));
    if (reduced) {
      settle.set(to);
      lift.set(to);
      return;
    }
    settle.set(showCutout ? withDelay(260, withSpring(1, springs.gentle)) : withTiming(0, { duration: 260 }));
    lift.set(showCutout ? withDelay(180, withSpring(1, springs.bouncy)) : withTiming(0, { duration: 200 }));
  }, [lift, reduced, reveal, settle, showCutout]);

  // Where the photo sits (cover) and where the garment stood in it.
  const cover = photo ? Math.max(width / photo.width, height / photo.height) : 1;
  const shown = photo ? { w: photo.width * cover, h: photo.height * cover } : { w: width, h: height };
  const origin = { x: (width - shown.w) / 2, y: (height - shown.h) / 2 };
  const aspect = image
    ? image.width() / image.height()
    : cutout && cutout.height > 0
      ? cutout.width / cutout.height
      : 0.83;
  const present: Box = (() => {
    const maxW = width - PRESENT_PADDING * 2;
    const maxH = height - PRESENT_PADDING * 2 - 24;
    const w = Math.min(maxW, maxH * aspect);
    const h = w / aspect;
    return { x: (width - w) / 2, y: (height - 24 - h) / 2, width: w, height: h };
  })();
  const stood: Box = cutout?.bounds
    ? {
        x: origin.x + cutout.bounds.x * shown.w,
        y: origin.y + cutout.bounds.y * shown.h,
        width: cutout.bounds.width * shown.w,
        height: cutout.bounds.height * shown.h,
      }
    : present;
  const start = heroPose(stood, present, aspect);

  const photoStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    return { opacity: 1 - r, transform: [{ scale: reduced ? 1 : 1 + 0.06 * r }] };
  });
  const blurStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    return {
      opacity: reduced ? 0 : interpolate(r, [0, 0.35, 1], [0, 0.9, 0]),
      transform: [{ scale: 1 + 0.06 * r }],
    };
  });
  const checkerStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(reveal.get(), [0, 0.12, 0.82, 1], [0, 1, 1, 0]),
  }));
  const cutoutStyle = useAnimatedStyle(() => {
    const pose = poseAt(start, settle.get());
    const l = lift.get();
    return {
      opacity: interpolate(reveal.get(), [0, 0.25], [0, 1], 'clamp'),
      transform: [
        { translateX: pose.translateX },
        { translateY: pose.translateY - 8 * l },
        { scale: pose.scale * (1 + 0.02 * l) },
      ],
    };
  });

  return (
    <View className="overflow-hidden rounded-[30px] border border-line bg-surface-tinted" style={{ width, height }}>
      <Animated.View style={[StyleSheet.absoluteFill, checkerStyle]}>
        <Checkerboard width={width} height={height} />
      </Animated.View>
      {photo ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blurStyle]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={10} />
          </Animated.View>
        </>
      ) : null}
      {cutout ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: present.x, top: present.y }, cutoutStyle]}
        >
          <Cutout uri={cutout.cutoutUri} width={present.width} height={present.height} shadow="lifted" />
        </Animated.View>
      ) : null}
      {scanning ? <Shimmer width={width} height={height} /> : null}
      <View className="absolute bottom-3.5 left-3.5 right-3.5 flex-row">{status}</View>
    </View>
  );
}

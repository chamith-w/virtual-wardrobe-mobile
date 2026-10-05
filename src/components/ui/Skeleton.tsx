import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations } from '@/theme/tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
};

/**
 * Loading placeholder with a soft shimmer sweep (never a spinner). With Reduce
 * Motion the sweep becomes a slow opacity breathe.
 */
export function Skeleton({ width = '100%', height = 16, radius = 12, className }: SkeletonProps) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    progress.set(0);
    progress.set(
      withRepeat(
        withTiming(1, {
          duration: reduced ? 1600 : durations.shimmer,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        reduced,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, reduced]);

  const sweepStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduced) return { opacity: 0 };
    return { transform: [{ translateX: interpolate(p, [0, 1], [-size.w, size.w]) }] };
  });

  const breatheStyle = useAnimatedStyle(() => {
    if (!reduced) return { opacity: 1 };
    return { opacity: interpolate(progress.get(), [0, 1], [1, 0.55]) };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize({ w, h });
  };

  const highlight = withAlpha('#FFFFFF', isDark ? 0.07 : 0.55);

  return (
    <View className={className}>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={onLayout}
        style={[
          { width, height, borderRadius: radius, backgroundColor: colors.surfaceTinted, overflow: 'hidden' },
          breatheStyle,
        ]}
      >
        {size.w > 0 ? (
          <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
            <Canvas style={{ width: size.w, height: size.h }}>
              <Rect x={0} y={0} width={size.w} height={size.h}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(size.w, size.h * 0.35)}
                  positions={[0.3, 0.5, 0.7]}
                  colors={['rgba(255,255,255,0)', highlight, 'rgba(255,255,255,0)']}
                />
              </Rect>
            </Canvas>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

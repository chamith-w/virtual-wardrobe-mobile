import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { durations, springs } from '@/theme/tokens';

/**
 * Pops its children in on mount with the bouncy spring (the prototypes'
 * popA/popB): from `from` scale, optionally turned `tilt` degrees. Give it a
 * new `key` to pop again. Under Reduce Motion it fades.
 */
export function PopIn({
  children,
  from = 0.7,
  tilt = 0,
  delay = 0,
  style,
}: {
  children: ReactNode;
  from?: number;
  tilt?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useMotionReduced();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(
      reduced ? withTiming(1, { duration: durations.reducedFade }) : withDelay(delay, withSpring(1, springs.bouncy)),
    );
  }, [p, reduced, delay]);
  const animated = useAnimatedStyle(() => {
    const v = p.get();
    if (reduced) return { opacity: v };
    const settled = Math.min(1, v);
    return {
      opacity: Math.min(1, v * 1.6),
      transform: [{ scale: from + (1 - from) * v }, { rotate: `${tilt * (1 - settled)}deg` }],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

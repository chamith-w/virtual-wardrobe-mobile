import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptics, type HapticName } from '@/lib/haptics';
import { useMotionReduced } from '@/theme/motion';
import { durations, layout, springs } from '@/theme/tokens';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressableBase, { className: 'style' });

export type AnimatedPressableProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Scale at full press. 0.96 for buttons, ~0.98 for large cards. */
  scaleTo?: number;
  /** Haptic fired on press; `'none'` to opt out. */
  haptic?: HapticName | 'none';
};

/** Expands small targets so every control meets the 44pt minimum. */
function touchSlop(hitSlop: PressableProps['hitSlop']) {
  return hitSlop ?? { top: 6, bottom: 6, left: 6, right: 6 };
}

/**
 * The base of every tappable thing: spring scale on press-in, a bouncy release
 * and a haptic on press. With Reduce Motion it dims instead of scaling.
 */
export function AnimatedPressable({
  scaleTo = 0.96,
  haptic = 'tap',
  onPressIn,
  onPressOut,
  onPress,
  style,
  hitSlop,
  accessibilityRole = 'button',
  ...rest
}: AnimatedPressableProps) {
  const reduced = useMotionReduced();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const p = pressed.get();
    if (reduced) return { opacity: 1 - p * 0.22 };
    return { transform: [{ scale: 1 - (1 - scaleTo) * p }] };
  });

  const handlePressIn = (e: GestureResponderEvent) => {
    pressed.set(reduced ? withTiming(1, { duration: 90 }) : withSpring(1, springs.snappy));
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    pressed.set(reduced ? withTiming(0, { duration: durations.reducedFade }) : withSpring(0, springs.bouncy));
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic !== 'none') haptics[haptic]();
    onPress?.(e);
  };

  return (
    <AnimatedPressableBase
      accessibilityRole={accessibilityRole}
      hitSlop={touchSlop(hitSlop)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, animatedStyle]}
      {...rest}
    />
  );
}

export const MIN_TOUCH = layout.minTouch;

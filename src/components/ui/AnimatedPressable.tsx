import { cssInterop } from 'nativewind';
import type { ComponentProps, ReactNode } from 'react';
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

type PressableShellProps = Omit<PressableProps, 'style'> & {
  className?: string;
  style?: StyleProp<ViewStyle>;
  animatedStyle: ComponentProps<typeof AnimatedPressableBase>['style'];
};

/**
 * NativeWind flattens `className` and `style` into one object. Reanimated's
 * style handle has to stay a separate array entry: merged into that object,
 * its `viewDescriptors` key makes Reanimated treat the whole style as animated
 * and drop every static value (background, size, padding, flex).
 */
function PressableShell({ style, animatedStyle, ...rest }: PressableShellProps) {
  return <AnimatedPressableBase style={[style, animatedStyle]} {...rest} />;
}
cssInterop(PressableShell, { className: 'style' });

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
    <PressableShell
      accessibilityRole={accessibilityRole}
      hitSlop={touchSlop(hitSlop)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={style}
      animatedStyle={animatedStyle}
      {...rest}
    />
  );
}

export const MIN_TOUCH = layout.minTouch;

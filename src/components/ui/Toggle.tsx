import { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { AnimatedPressable } from './AnimatedPressable';

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const TRACK_W = 50;
const TRACK_H = 30;
const THUMB = 24;

/** Custom switch (not the platform default) with a springy thumb. */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.set(
      reduced
        ? withTiming(value ? 1 : 0, { duration: durations.reducedFade })
        : withSpring(value ? 1 : 0, springs.snappy),
    );
  }, [on, reduced, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [colors.faint, colors.accentSecondary]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: on.get() * (TRACK_W - THUMB - 6) }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      scaleTo={0.94}
      className={disabled ? 'opacity-40' : ''}
    >
      <Animated.View style={[{ width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: 3 }, trackStyle]}>
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </AnimatedPressable>
  );
}

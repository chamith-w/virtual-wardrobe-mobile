import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, radii, springs } from '@/theme/tokens';

import { AnimatedPressable } from './AnimatedPressable';
import { Text } from './Text';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  size?: 'md' | 'sm';
};

/** Pill segmented control with a spring-sliding thumb (Closet / Grid / Outfits, theme, units…). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  size = 'md',
}: SegmentedProps<T>) {
  const reduced = useMotionReduced();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const x = useSharedValue(index);

  useEffect(() => {
    x.set(reduced ? withTiming(index, { duration: durations.reducedFade }) : withSpring(index, springs.snappy));
  }, [index, reduced, x]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: x.get() * segment }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const height = size === 'md' ? 'h-11' : 'h-9';

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      className={['flex-row rounded-pill bg-surface-tinted p-1', height].join(' ')}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
              shadowOpacity: 0.12,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <AnimatedPressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            scaleTo={0.97}
            className="flex-1 items-center justify-center rounded-pill"
          >
            <Text variant={size === 'md' ? 'bodySm' : 'caption'} weight="semibold" tone={selected ? 'ink' : 'muted'}>
              {o.label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

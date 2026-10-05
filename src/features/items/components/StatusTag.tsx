import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import type { ItemStatus } from '@/features/items/catalog';
import { STATUS_TONE, statusTagLabel } from '@/features/items/status';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';


export type StatusTagProps = {
  status: ItemStatus;
  lentTo?: string | null;
  /** Pop in with a spring when it first appears (empty hangers). */
  pop?: boolean;
};

/** The small status pill on an empty hanger: a coloured dot and "Laundry", "Lent · Nadia"… */
export function StatusTag({ status, lentTo, pop = true }: StatusTagProps) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const shown = useSharedValue(pop ? 0 : 1);

  useEffect(() => {
    shown.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.bouncy));
  }, [reduced, shown]);

  const style = useAnimatedStyle(() => {
    const p = shown.get();
    if (reduced) return { opacity: p };
    return { opacity: Math.min(1, p * 1.5), transform: [{ scale: 0.6 + 0.4 * p }] };
  });

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          height: 22,
          paddingHorizontal: 9,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: withAlpha(colors.ink, 0.09),
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      <View className="h-1.5 w-1.5 rounded-pill" style={{ backgroundColor: colors[STATUS_TONE[status]] }} />
      <Text variant="caption" weight="semibold" tone="ink" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
        {statusTagLabel(status, lentTo)}
      </Text>
    </Animated.View>
  );
}

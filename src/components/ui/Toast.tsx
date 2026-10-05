import { Check, Info } from 'lucide-react-native';
import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '@/store/toast';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { Text } from './Text';

const VISIBLE_MS = 2300;

/**
 * Top-of-screen confirmation pill ("Moved to Storage", "Logged for today").
 * Mounted once in the root layout; trigger it with `toast()` from
 * `@/store/toast`. Drops in on a spring, or fades under Reduce Motion.
 */
export function ToastHost() {
  const current = useToastStore((s) => s.current);
  const visible = useToastStore((s) => s.visible);
  const hide = useToastStore((s) => s.hide);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const shown = useSharedValue(0);

  useEffect(() => {
    if (!current || !visible) return;
    AccessibilityInfo.announceForAccessibility(current.message);
    const timer = setTimeout(() => hide(current.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current, visible, hide]);

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduced) shown.set(withTiming(target, { duration: durations.reducedFade }));
    else shown.set(withSpring(target, visible ? springs.bouncy : springs.gentle));
  }, [visible, reduced, shown, current?.id]);

  const style = useAnimatedStyle(() => {
    const p = shown.get();
    if (reduced) return { opacity: p };
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [{ translateY: interpolate(p, [0, 1], [-(insets.top + 72), 0]) }],
    };
  });

  if (!current) return null;
  const Icon = current.tone === 'info' ? Info : Check;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 8, alignItems: 'center', zIndex: 100 }}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            maxWidth: '88%',
            paddingVertical: 10,
            paddingLeft: 12,
            paddingRight: 16,
            borderRadius: 999,
            backgroundColor: colors.inverse,
            shadowColor: colors.shadow,
            shadowOpacity: 0.24,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 12 },
            elevation: 10,
          },
          style,
        ]}
      >
        <View
          className="h-[22px] w-[22px] items-center justify-center rounded-pill"
          style={{ backgroundColor: current.tone === 'info' ? colors.faint : colors.success }}
        >
          <Icon size={14} color={colors.background} strokeWidth={2.8} />
        </View>
        <Text variant="bodySm" weight="medium" tone="onInverse" numberOfLines={2} style={{ flexShrink: 1 }}>
          {current.message}
        </Text>
      </Animated.View>
    </View>
  );
}

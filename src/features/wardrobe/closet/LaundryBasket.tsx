import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { BasketIcon } from '@/components/illustrations/Glyphs';
import { AnimatedPressable, Text } from '@/components/ui';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { useClosetDrag } from './ClosetDrag';

const SIZE = 60;
/** Prototype squash keyframes (Closet.dc.html `bumpA`): 0.65s with overshoot. */
const SQUASH_X = [1.25, 0.9, 1.05];
const SQUASH_Y = [0.84, 1.12, 0.97];
const STEP = 150;
const SQUASH_EASING = Easing.bezier(0.3, 1.4, 0.5, 1);

function squash(frames: number[]) {
  'worklet';
  return withSequence(
    ...frames.map((v) => withTiming(v, { duration: STEP, easing: SQUASH_EASING })),
    withSpring(1, springs.bouncy),
  );
}

/**
 * The floating laundry basket on the closet (DESIGN.md #6). Drag a piece onto
 * it to send it to the wash: it swells and glows while the piece hovers, then
 * squashes and bounces as the piece drops in. Tap it to open the laundry.
 */
export function LaundryBasket({ count }: { count: number }) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const tabInset = useTabBarInset();
  const { registerBasket, hoverBasket, basketDrops } = useClosetDrag();
  const ref = useRef<View>(null);

  useEffect(() => {
    registerBasket(ref.current);
    return () => registerBasket(null);
  }, [registerBasket]);

  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  useAnimatedReaction(
    () => basketDrops.get(),
    (drops, previous) => {
      if (previous === null || drops === previous) return;
      if (reduced) {
        sx.set(withSequence(withTiming(0.94, { duration: 90 }), withTiming(1, { duration: 110 })));
        sy.set(withSequence(withTiming(0.94, { duration: 90 }), withTiming(1, { duration: 110 })));
        return;
      }
      sx.set(squash(SQUASH_X));
      sy.set(squash(SQUASH_Y));
    },
  );

  const bodyStyle = useAnimatedStyle(() => {
    const hot = hoverBasket.get();
    const scale = reduced ? 1 : withSpring(hot ? 1.22 : 1, springs.bouncy);
    return { transform: [{ scale }, { scaleX: sx.get() }, { scaleY: sy.get() }] };
  });
  const ringStyle = useAnimatedStyle(() => ({
    opacity: withTiming(hoverBasket.get(), { duration: reduced ? durations.reducedFade : 220 }),
  }));

  // The badge pops when the count changes (a piece went in, or wash done).
  const badge = useSharedValue(1);
  const lastCount = useRef(count);
  useEffect(() => {
    if (count === lastCount.current) return;
    lastCount.current = count;
    if (reduced) return;
    badge.set(withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, springs.bouncy)));
  }, [badge, count, reduced]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.get() }] }));

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom: tabInset + 14 }]}>
      <Animated.View style={bodyStyle}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { borderColor: colors.accentSecondarySoft, backgroundColor: withAlpha(colors.accentSecondary, 0.12) },
            ringStyle,
          ]}
        />
        <View ref={ref} collapsable={false}>
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={`Laundry basket, ${count} ${count === 1 ? 'piece' : 'pieces'}`}
            accessibilityHint="Opens the laundry. Drag a piece here to send it to the wash."
            onPress={() => router.push('/laundry')}
            scaleTo={0.92}
            style={[
              styles.button,
              {
                backgroundColor: colors.surface,
                borderColor: withAlpha(colors.ink, 0.09),
                shadowColor: colors.shadow,
                shadowOpacity: isDark ? 0.62 : 0.24,
              },
            ]}
          >
            <BasketIcon size={26} color={colors.ink} />
          </AnimatedPressable>
        </View>
        {count > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.badge, badgeStyle]} className="bg-accent-strong">
            <Text variant="caption" weight="bold" tone="onAccent" style={{ fontSize: 12, lineHeight: 15 }}>
              {count}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 18, width: SIZE, height: SIZE },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  ring: { position: 'absolute', left: -7, top: -7, right: -7, bottom: -7, borderRadius: SIZE, borderWidth: 7 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

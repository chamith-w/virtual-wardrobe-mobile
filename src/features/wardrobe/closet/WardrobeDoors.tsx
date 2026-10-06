import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations } from '@/theme/tokens';

/** Timings from docs/design/Closet.dc.html. */
const DOOR_EASING = Easing.bezier(0.45, 0.05, 0.25, 1);
const REVEAL_EASING = Easing.bezier(0.2, 0.9, 0.25, 1);
const REVEAL_MS = 1500;
const ANGLE_STOPS = [0, 0.14, 0.72, 0.86, 1];
const ANGLES = [0, 7, 106, 96, 100];

function Door({ side, progress }: { side: 'left' | 'right'; progress: SharedValue<number> }) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const { height } = useWindowDimensions();
  const sign = side === 'left' ? -1 : 1;

  const doorStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduced) return { opacity: 1 - p };
    return {
      opacity: interpolate(p, [0.86, 1], [1, 0], 'clamp'),
      transform: [{ perspective: 1400 }, { rotateY: `${sign * interpolate(p, ANGLE_STOPS, ANGLES)}deg` }],
    };
  });
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(progress.get(), [0, 0.7, 1], [0, 0.35, 0.35]),
  }));

  // Panel and pull positions scale from the 844pt-tall artboard.
  const at = (y: number) => (y / 844) * height;
  const panel = {
    position: 'absolute' as const,
    left: 22,
    right: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: withAlpha(colors.ink, 0.17),
  };

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          backgroundColor: colors.surfaceTintedStrong,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: withAlpha(colors.ink, 0.09),
          transformOrigin: side,
        },
        doorStyle,
      ]}
    >
      <View style={[panel, { top: at(96), height: at(300) }]} />
      <View style={[panel, { top: at(418), height: at(330) }]} />
      <View
        style={{
          position: 'absolute',
          top: at(388),
          [side === 'left' ? 'right' : 'left']: 12,
          width: 6,
          height: 76,
          borderRadius: 3,
          backgroundColor: colors.rail,
        }}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, shadeStyle]} />
    </Animated.View>
  );
}

/**
 * Signature moment #1: the first time the Wardrobe opens in a session, two
 * doors unlatch, swing open in 3D and fade, while the closet behind scales
 * up. Under Reduce Motion the doors simply fade. Bump `playKey` to replay.
 */
export function WardrobeDoors({
  playKey,
  reveal,
  onDone,
}: {
  playKey: number;
  reveal: SharedValue<number>;
  onDone: () => void;
}) {
  const reduced = useMotionReduced();
  const progress = useSharedValue(0);

  useEffect(() => {
    const lead = playKey > 0 ? 320 : 450;
    progress.set(0);
    if (reduced) {
      reveal.set(1);
      progress.set(
        withDelay(lead / 2, withTiming(1, { duration: durations.reducedFade }, (done) => {
          if (done) scheduleOnRN(onDone);
        })),
      );
      return;
    }
    reveal.set(0);
    reveal.set(withDelay(lead, withTiming(1, { duration: REVEAL_MS, easing: REVEAL_EASING })));
    progress.set(
      withDelay(
        lead,
        withTiming(1, { duration: durations.doors, easing: DOOR_EASING }, (done) => {
          if (done) scheduleOnRN(onDone);
        }),
      ),
    );
    // Replays are keyed by playKey; onDone is read when the animation finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, reduced]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: 'row', zIndex: 30 }]}>
      <Door side="left" progress={progress} />
      <Door side="right" progress={progress} />
    </View>
  );
}

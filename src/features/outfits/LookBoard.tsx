import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { durations, springs } from '@/theme/tokens';

import { contentFrame } from './canvas';
import { fit, LiveScene } from './OutfitThumb';
import type { OutfitPiece } from './useOutfits';

/**
 * A look drawn as a little board, fitted inside `width` × `height`. When
 * `popKey` changes (a shuffle), the new look pops in (prototype popA/popB:
 * from 0.55 and ±8° with an overshoot); under Reduce Motion it fades.
 */
export function LookBoard({
  pieces,
  width,
  height,
  popKey,
}: {
  pieces: OutfitPiece[];
  width: number;
  height: number;
  popKey?: string;
}) {
  const reduced = useMotionReduced();
  const frame = contentFrame(pieces);
  const art = fit(frame, width, height);
  const pop = useSharedValue(1);
  const turn = useSharedValue(1);

  useEffect(() => {
    if (!popKey) return;
    pop.set(0);
    turn.set(turn.get() > 0 ? -1 : 1);
    pop.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.bouncy));
  }, [popKey, pop, turn, reduced]);

  const style = useAnimatedStyle(() => {
    const p = pop.get();
    if (reduced) return { opacity: p };
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [{ scale: 0.55 + 0.45 * p }, { rotate: `${8 * turn.get() * (1 - Math.min(1, p))}deg` }],
    };
  });

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: art.left, top: art.top }, style]}>
        <LiveScene pieces={pieces} frame={frame} width={art.width} height={art.height} />
      </Animated.View>
    </View>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable, Cutout } from '@/components/ui';
import { StatusTag } from '@/features/items/components/StatusTag';
import { isOut, statusTagLabel } from '@/features/items/status';
import type { ClosetItem } from '@/features/wardrobe/useWardrobeData';
import { useMotionReduced } from '@/theme/motion';
import { durations, springs } from '@/theme/tokens';

import { useClosetDrag, useLongPressDrag } from './ClosetDrag';

export type ClosetPieceProps = {
  item: ClosetItem;
  width: number;
  height: number;
  /** Doesn't match the current search or filters: fades and greys out. */
  dimmed: boolean;
  onPress: (item: ClosetItem) => void;
  /** Drawn in the empty spot when the piece is out (dashed outline). */
  outArt?: ReactNode;
  /** Where the status tag sits, from the top of the slot. */
  tagTop?: number;
  /** Position along the zone, for the staggered pop-in. */
  index?: number;
};

/** Prototype `.pop`: each garment springs 0.6 → ~1.05 → 1 as it appears, 45ms after its neighbour. */
const POP_STAGGER = 45;

function PopIn({ index, children }: { index: number; children: ReactNode }) {
  const reduced = useMotionReduced();
  const shown = useSharedValue(0);
  const [delay] = useState(index * POP_STAGGER);

  useEffect(() => {
    shown.set(
      withDelay(delay, reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.snappy)),
    );
  }, [delay, reduced, shown]);

  const style = useAnimatedStyle(() => {
    const p = shown.get();
    if (reduced) return { opacity: p };
    return { opacity: Math.min(1, p * 1.6), transform: [{ scale: 0.6 + 0.4 * p }] };
  });

  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/**
 * One piece in the closet. Tap opens its quick sheet; long-press lifts it to
 * drag to another zone. When it's out (worn, laundry, lent…) only an outline
 * and a status tag remain.
 */
export function ClosetPiece({ item, width, height, dimmed, onPress, outArt, tagTop = 8, index = 0 }: ClosetPieceProps) {
  const reduced = useMotionReduced();
  const { draggingId } = useClosetDrag();
  const out = isOut(item.status);
  const drag = useLongPressDrag(
    { id: item.id, name: item.name, thumbUri: item.thumbUri, zoneId: item.zoneId, width, height },
    !out,
  );

  // Worklets copy what they capture: take the id, not the row (its Dates can't cross threads).
  const itemId = item.id;
  const fadeStyle = useAnimatedStyle(() => {
    const lifting = draggingId.get() === itemId;
    const target = lifting ? 0.22 : dimmed ? 0.16 : 1;
    return { opacity: withTiming(target, { duration: reduced ? durations.reducedFade : 350 }) };
  });

  const label = out ? `${item.name}, ${statusTagLabel(item.status, item.lentTo)}` : item.name;

  return (
    <GestureDetector gesture={drag}>
      <AnimatedPressable
        accessibilityLabel={label}
        accessibilityHint={out ? 'Opens its status' : 'Opens its status. Long press to move it to another zone.'}
        onPress={() => onPress(item)}
        scaleTo={0.94}
        style={{ width, height }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
          {out ? (
            <View style={StyleSheet.absoluteFill}>
              {outArt ? <View style={[StyleSheet.absoluteFill, styles.outArt]}>{outArt}</View> : null}
              <View style={[styles.tag, { top: tagTop }]}>
                <StatusTag status={item.status} lentTo={item.lentTo} />
              </View>
            </View>
          ) : (
            <PopIn index={index}>
              <Cutout uri={item.thumbUri} width={width} height={height} desaturate={dimmed ? 0.8 : 0} />
            </PopIn>
          )}
        </Animated.View>
      </AnimatedPressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  outArt: { alignItems: 'center', justifyContent: 'flex-end' },
  tag: { position: 'absolute', left: -14, right: -14, alignItems: 'center' },
});

import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HangerGlyph } from '@/components/illustrations/Glyphs';
import { Button, Cutout, Text } from '@/components/ui';
import type { ZoneType } from '@/features/items/catalog';
import { useItem } from '@/features/items/useItem';
import { useActiveWardrobe, useWardrobeItems, useZones } from '@/features/wardrobe/useWardrobeData';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import type { SavedPiece } from '../flow';
import { reviewStageFrame } from '../review/layout';
import { savedBody, savedHeadline } from '../savedCopy';

/** DESIGN.md #4 keyframes: lift at 18%, overshoot the slot at 70%, settle at 1.35s. */
const FLY_STOPS = [0, 0.18, 0.7, 1];
const FLY_EASING = Easing.bezier(0.45, 0.05, 0.25, 1);
const SLOT = { width: 64, height: 77 };
const SLOTS = 4;
const CARD_HEIGHT = 214;
const RAIL_Y = 52;

/** A neighbour already in the zone: swings a little when the new piece lands. */
function Neighbour({
  uri,
  hanging,
  nudge,
  index,
}: {
  uri: string | null;
  hanging: boolean;
  nudge: SharedValue<number>;
  index: number;
}) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${nudge.get() * (index % 2 ? -1 : 1)}deg` }] }));
  return (
    <Animated.View style={[{ width: SLOT.width, height: SLOT.height + 15, transformOrigin: 'top' }, style]}>
      {hanging ? (
        <View className="absolute left-2 top-0">
          <HangerGlyph width={48} color={colors.faint} />
        </View>
      ) : null}
      <View className="absolute top-[15px]">
        <Cutout uri={uri} width={SLOT.width} height={SLOT.height} />
      </View>
    </Animated.View>
  );
}

export type SavedViewProps = {
  piece: SavedPiece;
  /** Photos still waiting in the batch. */
  remaining: number;
  batchLabel: string | null;
  onNext: () => void;
  onDone: () => void;
  onAddAnother: () => void;
  onViewWardrobe: () => void;
};

/**
 * Step 4 (AddItem.dc.html, saved) and signature moment #4, the fly-in: the
 * new cutout leaves the review stage at ~3.1×, lifts, overshoots its slot in
 * a miniature of its zone, then settles; its hanger swings and a ring
 * pulses. Reduce Motion fades it into place.
 */
export function SavedView({
  piece,
  remaining,
  batchLabel,
  onNext,
  onDone,
  onAddAnother,
  onViewWardrobe,
}: SavedViewProps) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const { item } = useItem(piece.id);
  const { wardrobes } = useActiveWardrobe();
  const { data: allZones } = useZones();
  const { data: wardrobeItems } = useWardrobeItems(piece.wardrobeId);
  const zone = allZones.find((z) => z.id === piece.zoneId);
  const wardrobe = wardrobes.find((w) => w.id === piece.wardrobeId);
  const zoneType: ZoneType | null = zone?.type ?? null;
  const hanging = zoneType === 'rail';
  const neighbours = wardrobeItems
    .filter((i) => i.zoneId === piece.zoneId && i.id !== piece.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, SLOTS - 1);

  // The card and its slots.
  const cardW = screenW - 40;
  const cardTop = Math.max(insets.top + 250, screenH * 0.47);
  const gap = (cardW - SLOTS * SLOT.width) / (SLOTS + 1);
  const slotLeft = (i: number) => 20 + gap + i * (SLOT.width + gap);
  const slotTop = cardTop + RAIL_Y - 4 + (hanging ? 15 : 40);
  const landed = { x: slotLeft(SLOTS - 1), y: slotTop };

  // The flight starts where the review stage showed the cutout, ~3.1× the slot.
  const stage = reviewStageFrame(screenW, screenH, insets.top);
  const startScale = 3.1;
  const dx = stage.x + stage.width / 2 - (landed.x + SLOT.width / 2);
  const dy = stage.y + stage.height / 2 - (landed.y + (SLOT.height * startScale) / 2);

  const fly = useSharedValue(reduced ? 1 : 0);
  const fade = useSharedValue(0);
  const hanger = useSharedValue(0);
  const ring = useSharedValue(0);
  const swing = useSharedValue(0);
  const nudge = useSharedValue(0);
  const copy = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      fade.set(withTiming(1, { duration: durations.reducedFade }));
      hanger.set(withTiming(1, { duration: durations.reducedFade }));
      copy.set(withDelay(120, withTiming(1, { duration: durations.reducedFade })));
      return;
    }
    fade.set(1);
    fly.set(withTiming(1, { duration: durations.flyIn, easing: FLY_EASING }));
    hanger.set(withDelay(1050, withSpring(1, springs.bouncy)));
    ring.set(withDelay(durations.flyIn, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })));
    swing.set(
      withDelay(
        durations.flyIn,
        withSequence(
          withTiming(-5, { duration: 320, easing: Easing.inOut(Easing.quad) }),
          withTiming(3.5, { duration: 380, easing: Easing.inOut(Easing.quad) }),
          withTiming(-1.5, { duration: 320, easing: Easing.inOut(Easing.quad) }),
          withSpring(0, springs.sway),
        ),
      ),
    );
    nudge.set(
      withDelay(
        durations.flyIn + 80,
        withSequence(withTiming(2, { duration: 260, easing: Easing.inOut(Easing.quad) }), withSpring(0, springs.sway)),
      ),
    );
    copy.set(withDelay(1450, withSpring(1, springs.gentle)));
  }, [copy, fade, fly, hanger, nudge, reduced, ring, swing]);

  const pieceStyle = useAnimatedStyle(() => {
    const p = fly.get();
    return {
      opacity: fade.get(),
      transform: [
        { translateX: interpolate(p, FLY_STOPS, [dx, dx, 0, 0]) },
        { translateY: interpolate(p, FLY_STOPS, [dy, dy - 21, 10, 0]) },
        { scale: interpolate(p, FLY_STOPS, [startScale, 3.3, 0.9, 1]) },
        { rotate: `${interpolate(p, FLY_STOPS, [0, -2, 5, 0]) + swing.get()}deg` },
      ],
    };
  });
  const hangerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, hanger.get() * 1.5),
    transform: [{ scale: 0.4 + 0.6 * hanger.get() }, { rotate: `${swing.get()}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => {
    const r = ring.get();
    return { opacity: r === 0 ? 0 : 0.7 * (1 - r), transform: [{ scale: 0.6 + r }] };
  });
  const copyStyle = useAnimatedStyle(() => {
    const c = copy.get();
    return reduced ? { opacity: c } : { opacity: c, transform: [{ translateY: (1 - c) * 14 }] };
  });

  const name = item?.name ?? piece.name;
  const body = item
    ? savedBody({ name, wardrobeName: wardrobe?.name ?? 'Home', category: item.category, seasons: item.seasons })
    : `${name} is in your wardrobe.`;

  return (
    <View className="flex-1 bg-background">
      <Animated.View className="absolute left-6 right-6" style={[{ top: insets.top + 70 }, copyStyle]}>
        <Text variant="eyebrow" tone="success">
          Saved{batchLabel ? ` · ${batchLabel}` : ''}
        </Text>
        <Text variant="display2" accessibilityRole="header" className="mt-2">
          {savedHeadline(zoneType)}
        </Text>
        <Text variant="body" tone="muted" className="mt-2.5">
          {body}
        </Text>
      </Animated.View>

      <View
        className="absolute left-5 overflow-hidden rounded-lg bg-surface-tinted"
        style={{ top: cardTop, width: cardW, height: CARD_HEIGHT }}
      >
        <Text variant="eyebrow" className="absolute left-[18px] top-4">
          {wardrobe?.name ?? 'Home'} · {zone?.name ?? 'Wardrobe'}
        </Text>
        {hanging ? (
          <View className="absolute left-0 right-0 h-[3px]" style={{ top: RAIL_Y, backgroundColor: colors.rail }} />
        ) : (
          <View className="absolute bottom-0 left-0 right-0 h-10 bg-surface-tinted-strong" />
        )}
      </View>

      {neighbours.map((n, i) => (
        <View
          key={n.id}
          className="absolute"
          style={{ left: slotLeft(i), top: slotTop - (hanging ? 15 : 0) }}
          pointerEvents="none"
        >
          <Neighbour uri={n.thumbUri} hanging={hanging} nudge={nudge} index={i} />
        </View>
      ))}

      <Animated.View
        pointerEvents="none"
        className="absolute h-[70px] w-[70px] rounded-pill border-2"
        style={[
          {
            left: landed.x + SLOT.width / 2 - 35,
            top: landed.y + SLOT.height / 2 - 35,
            borderColor: colors.accent,
            backgroundColor: withAlpha(colors.accent, 0.08),
          },
          ringStyle,
        ]}
      />
      {hanging ? (
        <Animated.View
          pointerEvents="none"
          className="absolute"
          style={[{ left: landed.x + 8, top: landed.y - 15, transformOrigin: [24, 2, 0] }, hangerStyle]}
        >
          <HangerGlyph width={48} color={colors.faint} />
        </Animated.View>
      ) : null}
      <Animated.View
        pointerEvents="none"
        className="absolute"
        style={[
          { left: landed.x, top: landed.y, width: SLOT.width, height: SLOT.height, transformOrigin: 'top', zIndex: 5 },
          pieceStyle,
        ]}
      >
        <Cutout uri={piece.thumbUri} width={SLOT.width} height={SLOT.height} />
      </Animated.View>

      <Animated.View
        className="absolute left-5 right-5 flex-row gap-2.5"
        style={[{ bottom: insets.bottom + 24 }, copyStyle]}
      >
        {remaining > 0 ? (
          <>
            <Button label="Done" variant="secondary" className="flex-1" onPress={onDone} />
            <Button label={`Next photo · ${remaining} left`} className="flex-1" onPress={onNext} />
          </>
        ) : (
          <>
            <Button label="Add another" variant="secondary" className="flex-1" onPress={onAddAnother} />
            <Button label="View in wardrobe" className="flex-1" onPress={onViewWardrobe} />
          </>
        )}
      </Animated.View>
    </View>
  );
}

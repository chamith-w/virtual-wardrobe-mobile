import { router } from 'expo-router';
import { Droplets } from 'lucide-react-native';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { WickerBasket } from '@/components/illustrations/Glyphs';
import { AnimatedPressable, Button, Cutout, Text } from '@/components/ui';
import { sendToLaundry, washDone } from '@/features/items/actions';
import { haptics } from '@/lib/haptics';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { pileLine } from './copy';
import { BASKET_BOX, PILE_VISIBLE, pileLayout, WASH_FLIGHT, washDelay, washDuration, type PileSlot } from './pile';
import type { OutPiece } from './useOutPieces';

const WORN_SIZE = { width: 86, height: 104 };
const BASKET_ART_TOP = 28;
/** Over-the-rim slack: a piece held just above the basket counts as over it. */
const BASKET_REACH = 30;
/** Prototype `bumpA` on the Laundry screen: gentler than the closet basket. */
const BUMP_X = [1.08, 0.97, 1.02];
const BUMP_Y = [0.92, 1.05, 0.99];
const BUMP_EASING = Easing.bezier(0.3, 1.4, 0.5, 1);
const FLY_EASING = Easing.bezier(0.5, 0, 0.3, 1);
/** The new piece falls in with a bounce (prototype `dropIn`, 0.9s). */
const FALL_SPRING = { damping: 9, stiffness: 150, mass: 0.9 };

type Rect = { x: number; y: number; w: number; h: number };

// ------------------------------------------------------------------ pile --

function PilePiece({
  item,
  slot,
  fresh,
  flightDelay,
}: {
  item: OutPiece;
  slot: PileSlot;
  /** Just dropped: falls in from above. */
  fresh: boolean;
  /** Wash done: flies out after this many ms. */
  flightDelay: number | null;
}) {
  const reduced = useMotionReduced();
  const fall = useSharedValue(fresh ? 0 : 1);
  const fly = useSharedValue(0);

  useEffect(() => {
    if (!fresh) return;
    fall.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, FALL_SPRING));
    // Mount only: a piece falls in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flightDelay === null) return;
    fly.set(
      reduced
        ? withTiming(1, { duration: durations.reducedFade })
        : withDelay(flightDelay, withTiming(1, { duration: WASH_FLIGHT, easing: FLY_EASING })),
    );
  }, [flightDelay, fly, reduced]);

  const style = useAnimatedStyle(() => {
    const f = fall.get();
    const k = fly.get();
    if (reduced) return { opacity: Math.min(1, f) * (1 - k), transform: [{ rotate: `${slot.rotate}deg` }] };
    // Prototype `flyout`: up, then away to the top right, shrinking to a quarter.
    const tx = interpolate(k, [0, 0.3, 1], [0, 0, 150]);
    const ty = interpolate(k, [0, 0.3, 1], [0, -70, -430]);
    const spin = interpolate(k, [0, 0.3, 1], [0, -6, 18]);
    const shrink = interpolate(k, [0, 0.3, 1], [1, 1, 0.25]);
    const fade = interpolate(k, [0, 0.3, 1], [1, 1, 0]);
    return {
      opacity: Math.min(1, f * 2.5) * fade,
      transform: [
        { translateX: tx },
        { translateY: (1 - f) * -150 + ty },
        { rotate: `${slot.rotate + (1 - f) * (-14 - slot.rotate) + spin}deg` },
        { scale: (0.9 + 0.1 * Math.min(1, f)) * shrink },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: slot.x, top: slot.y, width: slot.width, height: slot.height }, style]}
    >
      <Cutout uri={item.thumbUri} width={slot.width} height={slot.height} />
    </Animated.View>
  );
}

function bump(frames: number[]) {
  'worklet';
  return withSequence(
    ...frames.map((v) => withTiming(v, { duration: 160, easing: BUMP_EASING })),
    withSpring(1, springs.bouncy),
  );
}

function Basket({
  pile,
  fresh,
  washing,
  hot,
  drops,
  basketRef,
}: {
  pile: OutPiece[];
  fresh: string | null;
  washing: boolean;
  hot: SharedValue<number>;
  drops: SharedValue<number>;
  basketRef: RefObject<View | null>;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const slots = pileLayout(pile.map((p) => p.category));

  useAnimatedReaction(
    () => drops.get(),
    (now, before) => {
      if (before === null || now === before || reduced) return;
      sx.set(bump(BUMP_X));
      sy.set(bump(BUMP_Y));
    },
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: reduced ? 1 : withSpring(hot.get() ? 1.07 : 1, springs.bouncy) },
      { scaleX: sx.get() },
      { scaleY: sy.get() },
    ],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: withTiming(hot.get() * 0.45, { duration: 260 }) }));

  return (
    // A plain view for measuring; the animated one inside swells and bumps.
    <View ref={basketRef} collapsable={false}>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Laundry basket with ${pile.length} ${pile.length === 1 ? 'piece' : 'pieces'}`}
        style={[{ width: BASKET_BOX.width, height: BASKET_BOX.height }, style]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { backgroundColor: colors.accentSecondary, shadowColor: colors.accentSecondary }, glow]}
        />
        {pile.slice(0, slots.length).map((p, i) => (
          <PilePiece
            key={p.id}
            item={p}
            slot={slots[i]!}
            fresh={p.id === fresh}
            flightDelay={washing ? washDelay(i, slots.length) : null}
          />
        ))}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: BASKET_ART_TOP }}>
          <WickerBasket
            width={BASKET_BOX.width}
            body={colors.wicker}
            weave={colors.wickerShade}
            handle={colors.wickerDeep}
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ------------------------------------------------------------- just worn --

function WornPiece({
  item,
  draggingId,
  onTap,
  onBegin,
  onPointer,
  onEnd,
  onCancel,
}: {
  item: OutPiece;
  draggingId: SharedValue<string>;
  onTap: (id: string) => void;
  onBegin: (id: string) => void;
  onPointer: (x: number, y: number) => void;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const reduced = useMotionReduced();
  const id = item.id;
  // A downward drag lifts the piece; a sideways swipe scrolls the strip instead.
  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-14, 14])
    .onStart((e) => {
      draggingId.set(id);
      onPointer(e.absoluteX, e.absoluteY);
      scheduleOnRN(onBegin, id);
    })
    .onUpdate((e) => onPointer(e.absoluteX, e.absoluteY))
    .onEnd(() => scheduleOnRN(onEnd))
    .onFinalize((_e, success) => {
      if (!success) scheduleOnRN(onCancel);
    });
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(draggingId.get() === id ? 0.2 : 1, { duration: reduced ? durations.reducedFade : 180 }),
  }));

  return (
    <GestureDetector gesture={pan}>
      <AnimatedPressable
        accessibilityLabel={`Send ${item.name} to the laundry`}
        accessibilityHint="Or drag it down into the basket"
        haptic="none"
        onPress={() => onTap(id)}
        scaleTo={0.92}
        style={WORN_SIZE}
      >
        <Animated.View style={fade}>
          <Cutout uri={item.thumbUri} width={WORN_SIZE.width} height={WORN_SIZE.height} />
        </Animated.View>
      </AnimatedPressable>
    </GestureDetector>
  );
}

function Ghost({
  item,
  px,
  py,
  origin,
  lift,
}: {
  item: OutPiece;
  px: SharedValue<number>;
  py: SharedValue<number>;
  origin: SharedValue<{ x: number; y: number }>;
  lift: SharedValue<number>;
}) {
  const reduced = useMotionReduced();
  const w = WORN_SIZE.width * 1.1;
  const h = WORN_SIZE.height * 1.1;
  const style = useAnimatedStyle(() => {
    const l = lift.get();
    const at = [
      { translateX: px.get() - origin.get().x - w / 2 },
      { translateY: py.get() - origin.get().y - h * 0.45 },
    ];
    if (reduced) return { opacity: l, transform: at };
    return {
      opacity: Math.min(1, l * 1.4),
      transform: [...at, { rotate: `${-8 * l}deg` }, { scale: 0.92 + 0.18 * l }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, style]}>
      <Cutout uri={item.thumbUri} width={w} height={h} shadow="lifted" />
    </Animated.View>
  );
}

// ------------------------------------------------------------------- tab --

/**
 * The laundry (Laundry.dc.html, DESIGN.md #6): a strip of just-worn pieces to
 * tap or drag into the basket, the basket's heap, and Wash done, which sends
 * everything back to the wardrobe 90ms apart in one database update.
 */
export function LaundryTab({ worn, pile }: { worn: OutPiece[]; pile: OutPiece[] }) {
  const reduced = useMotionReduced();
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const basketRef = useRef<View>(null);

  const [ghost, setGhost] = useState<OutPiece | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [washing, setWashing] = useState<OutPiece[] | null>(null);

  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const origin = useSharedValue({ x: 0, y: 0 });
  const lift = useSharedValue(0);
  const basketRect = useSharedValue<Rect | null>(null);
  const hot = useSharedValue(0);
  const drops = useSharedValue(0);
  const draggingId = useSharedValue('');

  const wornRef = useRef(worn);
  useLayoutEffect(() => {
    wornRef.current = worn;
  });

  const washTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (washTimer.current) clearTimeout(washTimer.current);
    },
    [],
  );

  const drop = (id: string, how: 'drop' | 'tap') => {
    const item = wornRef.current.find((p) => p.id === id);
    if (!item || washing) return;
    if (!sendToLaundry(item, how)) return;
    setFresh(id);
    drops.set(drops.get() + 1);
  };

  const pointer = (x: number, y: number) => {
    'worklet';
    px.set(x);
    py.set(y);
    const b = basketRect.get();
    const over = !!b && x >= b.x && x <= b.x + b.w && y >= b.y - BASKET_REACH && y <= b.y + b.h;
    if (over !== (hot.get() === 1)) {
      hot.set(over ? 1 : 0);
      if (over) scheduleOnRN(haptics.tap);
    }
  };

  const begin = (id: string) => {
    const item = wornRef.current.find((p) => p.id === id);
    if (!item) return;
    haptics.press();
    setGhost(item);
    lift.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.bouncy));
    rootRef.current?.measureInWindow((x, y) => origin.set({ x, y }));
    basketRef.current?.measureInWindow((x, y, w, h) => basketRect.set({ x, y, w, h }));
  };

  const finish = (commit: boolean) => {
    const id = draggingId.get();
    const over = hot.get() === 1;
    draggingId.set('');
    hot.set(0);
    lift.set(withTiming(0, { duration: durations.reducedFade }));
    setTimeout(() => setGhost(null), durations.reducedFade + 20);
    if (commit && over && id) drop(id, 'drop');
  };

  const onWashDone = () => {
    if (washing || pile.length === 0) return;
    const snapshot = pile;
    setFresh(null);
    setWashing(snapshot);
    washDone(snapshot);
    washTimer.current = setTimeout(
      () => setWashing(null),
      (reduced ? durations.reducedFade : washDuration(Math.min(snapshot.length, PILE_VISIBLE))) + 60,
    );
  };

  const shown = washing ?? pile;
  const empty = shown.length === 0;

  return (
    <View ref={rootRef} collapsable={false} className="flex-1">
      <GHScrollView
        scrollEnabled={!ghost}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 28 }}
      >
        <View className="overflow-hidden rounded-[24px] bg-surface-tinted pt-3">
          <View className="flex-row items-center justify-between px-3.5">
            <Text variant="eyebrow">Just worn</Text>
            {worn.length > 0 ? (
              <Text variant="caption" weight="semibold" tone="muted">
                Tap or drag into the basket
              </Text>
            ) : null}
          </View>
          {worn.length > 0 ? (
            <GHScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 6, gap: 4, alignItems: 'flex-end' }}
              style={{ height: 118 }}
            >
              {worn.map((p) => (
                <WornPiece
                  key={p.id}
                  item={p}
                  draggingId={draggingId}
                  onTap={(id) => drop(id, 'tap')}
                  onBegin={begin}
                  onPointer={pointer}
                  onEnd={() => finish(true)}
                  onCancel={() => finish(false)}
                />
              ))}
            </GHScrollView>
          ) : (
            <View className="h-[118px] justify-center px-4">
              <Text variant="bodySm" tone="muted">
                All caught up — nothing waiting.
              </Text>
            </View>
          )}
          <View className="h-2 bg-surface-tinted-strong" />
        </View>

        <View className="mt-5 items-center">
          <View>
            <Basket
              pile={shown}
              fresh={fresh}
              washing={washing !== null}
              hot={hot}
              drops={drops}
              basketRef={basketRef}
            />
            {empty ? (
              <View pointerEvents="none" className="absolute left-0 right-0 top-1 items-center">
                <Text variant="display3" style={{ fontSize: 20, lineHeight: 25 }}>
                  Basket’s empty
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="mt-4 items-center gap-1 px-5">
          <Text variant="bodySm" weight="semibold" className="text-center" accessibilityLiveRegion="polite">
            {pileLine(washing ? 0 : pile.length)}
          </Text>
          <Text variant="caption" tone="muted" className="text-center">
            {empty
              ? 'Pieces you wear land in Just worn, ready for the basket.'
              : 'Wash done puts everything back where it lives.'}
          </Text>
        </View>

        <View className="mt-6">
          {pile.length > 0 || washing ? (
            <Button
              label="Wash done"
              variant="accent"
              icon={Droplets}
              fullWidth
              disabled={washing !== null}
              accessibilityHint="Returns every piece in the basket to your wardrobe"
              onPress={onWashDone}
            />
          ) : (
            <Button label="Back to the wardrobe" fullWidth onPress={() => router.navigate('/wardrobe')} />
          )}
        </View>
      </GHScrollView>

      {ghost ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Ghost item={ghost} px={px} py={py} origin={origin} lift={lift} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: -6,
    height: 30,
    borderRadius: 999,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
});

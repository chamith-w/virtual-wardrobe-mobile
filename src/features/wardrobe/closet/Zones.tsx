import { ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { GhostFoldGlyph, GhostShoeGlyph, HangerGlyph } from '@/components/illustrations/Glyphs';
import { AnimatedPressable, Text } from '@/components/ui';
import type { Zone } from '@/db/schema';
import type { ClosetItem } from '@/features/wardrobe/useWardrobeData';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { swayFactor, trayTilt, zoneMeta } from '../closet';
import { DropZone } from './ClosetDrag';
import { ClosetPiece } from './ClosetPiece';

const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);

type ZoneProps = {
  zone: Zone;
  pieces: ClosetItem[];
  isDimmed: (item: ClosetItem) => boolean;
  onPressPiece: (item: ClosetItem) => void;
  /** Show the zone's own name (when a section holds several zones of one type). */
  labelled?: boolean;
};

// ------------------------------------------------------------ hanging rail --

/** Prototype physics: a = −k(x − target) − c·v, settling below these thresholds. */
const SWAY_K = 170;
const SWAY_C = 9;
const MAX_TILT = 12;
const DOORS_IMPULSE = 108;

const RAIL_SLOT = { width: 86, height: 138 };
const RAIL_CUTOUT = { width: 92, height: 110, left: -3, top: 19 };

function RailHanger({
  item,
  index,
  sway,
  dimmed,
  onPress,
}: {
  item: ClosetItem;
  index: number;
  sway: SharedValue<number>;
  dimmed: boolean;
  onPress: (item: ClosetItem) => void;
}) {
  const { colors } = useTheme();
  const k = swayFactor(item);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.get() * k}deg` }] }));

  return (
    <Animated.View style={[{ ...RAIL_SLOT, transformOrigin: [RAIL_SLOT.width / 2, 4, 0] }, style]}>
      <View style={{ position: 'absolute', left: 15, top: 0 }}>
        <HangerGlyph width={56} color={colors.faint} />
      </View>
      <View style={{ position: 'absolute', left: RAIL_CUTOUT.left, top: RAIL_CUTOUT.top }}>
        <ClosetPiece
          item={item}
          width={RAIL_CUTOUT.width}
          height={RAIL_CUTOUT.height}
          dimmed={dimmed}
          onPress={onPress}
          tagTop={11}
          index={index}
        />
      </View>
    </Animated.View>
  );
}

/**
 * The hanging rail. Garments pivot at their hooks and tilt with scroll speed
 * (`sway × k`, heavier pieces swing less), then settle on a spring. The doors
 * give it a push when they finish opening.
 */
export function HangingRail({
  zone,
  pieces,
  isDimmed,
  onPressPiece,
  labelled,
  impulse,
}: ZoneProps & { impulse: SharedValue<number> }) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const sway = useSharedValue(0);
  const velocity = useSharedValue(0);
  const target = useSharedValue(0);
  const lastX = useSharedValue(0);
  const lastT = useSharedValue(0);
  const running = useSharedValue(false);

  const stopPhysics = () => physics.setActive(false);
  const physics = useFrameCallback((frame) => {
    const dt = Math.min(0.032, Math.max(0.001, (frame.timeSincePreviousFrame ?? 16) / 1000));
    // No scroll events for a moment: the finger is holding still, let it settle.
    if (target.get() !== 0 && Date.now() - lastT.get() > 90) target.set(0);
    const x = sway.get();
    const v = velocity.get();
    const t = target.get();
    const nv = v + (-SWAY_K * (x - t) - SWAY_C * v) * dt;
    const nx = x + nv * dt;
    if (Math.abs(nx) < 0.03 && Math.abs(nv) < 0.05 && t === 0) {
      sway.set(0);
      velocity.set(0);
      running.set(false);
      scheduleOnRN(stopPhysics);
      return;
    }
    velocity.set(nv);
    sway.set(nx);
  }, false);
  const startPhysics = () => physics.setActive(true);

  const kick = () => {
    'worklet';
    if (running.get()) return;
    running.set(true);
    scheduleOnRN(startPhysics);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      if (reduced) return;
      const now = Date.now();
      const x = e.contentOffset.x;
      const dt = now - lastT.get();
      if (dt > 0 && dt < 120) {
        const v = (x - lastX.get()) / Math.max(8, dt);
        target.set(Math.max(-MAX_TILT, Math.min(MAX_TILT, -v * 7)));
      }
      lastT.set(now);
      lastX.set(x);
      kick();
    },
    onMomentumEnd: () => {
      target.set(0);
      kick();
    },
  });

  useAnimatedReaction(
    () => impulse.get(),
    (current, previous) => {
      if (previous === null || current === previous || reduced) return;
      velocity.set(velocity.get() + DOORS_IMPULSE);
      kick();
    },
  );

  return (
    <View>
      {labelled ? (
        <Text variant="eyebrow" className="px-5 pb-2">
          {zone.name}
        </Text>
      ) : null}
      <DropZone zoneId={zone.id} radius={20}>
        {pieces.length === 0 ? (
          <View className="mx-5 flex-row items-center gap-3.5 rounded-md border-[1.5px] border-dashed border-line-strong p-4">
            <HangerGlyph width={52} color={colors.faint} />
            <View className="flex-1">
              <Text variant="bodySm" weight="semibold">
                The rail is bare
              </Text>
              <Text variant="caption" className="mt-0.5">
                Add a piece, or long-press one and drag it here.
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <View
              className="absolute left-0 right-0 top-1 h-[3px] rounded-pill"
              style={{ backgroundColor: colors.rail }}
            />
            <AnimatedGHScrollView
              horizontal
              onScroll={onScroll}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 8 }}
            >
              {pieces.map((p, i) => (
                <RailHanger key={p.id} item={p} index={i} sway={sway} dimmed={isDimmed(p)} onPress={onPressPiece} />
              ))}
            </AnimatedGHScrollView>
          </View>
        )}
      </DropZone>
    </View>
  );
}

// ----------------------------------------------------------------- shelves --

/** A shelf: a tinted band with its pieces standing on a deeper lip. */
export function ShelfBand({ zone, pieces, isDimmed, onPressPiece }: ZoneProps) {
  const { colors } = useTheme();
  return (
    <DropZone zoneId={zone.id} radius={18} className="overflow-hidden rounded-[18px] bg-surface-tinted">
      <Text variant="eyebrow" className="px-3.5 pt-3">
        {zone.name}
      </Text>
      <GHScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 98 }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 6, gap: 4, alignItems: 'flex-end' }}
      >
        {pieces.length === 0 ? (
          <Text variant="caption" className="px-1 pb-3">
            Empty shelf · long-press a piece to move it here
          </Text>
        ) : (
          pieces.map((p, i) => (
            <ClosetPiece
              key={p.id}
              item={p}
              width={72}
              height={86}
              dimmed={isDimmed(p)}
              onPress={onPressPiece}
              tagTop={26}
              index={i}
              outArt={<GhostFoldGlyph width={64} color={withAlpha(colors.ink, 0.22)} />}
            />
          ))
        )}
      </GHScrollView>
      <View className="h-2.5 bg-surface-tinted-strong" />
    </DropZone>
  );
}

// ----------------------------------------------------------------- drawers --

function Drawer({
  zone,
  pieces,
  isDimmed,
  onPressPiece,
  open,
  onToggle,
}: ZoneProps & { open: boolean; onToggle: () => void }) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    const to = open ? 1 : 0;
    progress.set(reduced ? withTiming(to, { duration: durations.reducedFade }) : withSpring(to, springs.drawer));
  }, [open, progress, reduced]);

  const interiorStyle = useAnimatedStyle(() => ({
    height: Math.max(0, progress.get()) * 96,
    opacity: Math.min(1, Math.max(0, progress.get()) * 1.4),
  }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.get() * 180}deg` }] }));

  const meta = pieces.length === 0 ? 'Empty' : zoneMeta(pieces);

  return (
    <DropZone zoneId={zone.id} radius={16}>
      <Animated.View
        style={[
          { overflow: 'hidden', marginHorizontal: 10, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
          { backgroundColor: colors.surfaceTinted },
          interiorStyle,
        ]}
      >
        <GHScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 6,
            paddingHorizontal: 14,
            paddingTop: 14,
            paddingBottom: 8,
            alignItems: 'flex-end',
          }}
        >
          {pieces.length === 0 ? (
            <Text variant="caption" className="pb-6">
              Nothing folded away here yet.
            </Text>
          ) : (
            pieces.map((p, i) => (
              <ClosetPiece
                key={p.id}
                item={p}
                width={58}
                height={70}
                dimmed={isDimmed(p)}
                onPress={onPressPiece}
                tagTop={22}
                index={i}
                outArt={<GhostFoldGlyph width={52} color={withAlpha(colors.ink, 0.22)} />}
              />
            ))
          )}
        </GHScrollView>
      </Animated.View>
      <AnimatedPressable
        accessibilityLabel={`${zone.name} drawer, ${meta}`}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Closes the drawer' : 'Slides the drawer open'}
        onPress={onToggle}
        scaleTo={0.98}
        className="h-[60px] flex-row items-center justify-between rounded-[16px] border border-line bg-surface px-4"
        style={{
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 7,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <View className="gap-0.5">
          <Text variant="bodySm" weight="semibold">
            {zone.name}
          </Text>
          <Text variant="caption">{meta}</Text>
        </View>
        <View
          pointerEvents="none"
          className="absolute left-1/2 top-1/2 -ml-[22px] -mt-[2.5px] h-[5px] w-11 rounded-pill"
          style={{ backgroundColor: withAlpha(colors.ink, 0.17) }}
        />
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={colors.muted} strokeWidth={1.9} />
        </Animated.View>
      </AnimatedPressable>
    </DropZone>
  );
}

/** A stack of drawers; tapping one slides it open (one at a time). */
export function DrawerStack({
  zones,
  piecesOf,
  isDimmed,
  onPressPiece,
}: {
  zones: Zone[];
  piecesOf: (zoneId: string) => ClosetItem[];
  isDimmed: (item: ClosetItem) => boolean;
  onPressPiece: (item: ClosetItem) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <View className="mx-4 gap-2">
      {zones.map((z) => (
        <Drawer
          key={z.id}
          zone={z}
          pieces={piecesOf(z.id)}
          isDimmed={isDimmed}
          onPressPiece={onPressPiece}
          open={openId === z.id}
          onToggle={() => setOpenId((id) => (id === z.id ? null : z.id))}
        />
      ))}
    </View>
  );
}

// --------------------------------------------------------------- shoe rack --

/** Shoes standing on two thin bars. */
export function ShoeRack({ zone, pieces, isDimmed, onPressPiece, labelled }: ZoneProps) {
  const { colors } = useTheme();
  return (
    <DropZone zoneId={zone.id} radius={18} className="overflow-hidden rounded-[18px] bg-surface-tinted pt-2.5">
      {labelled ? (
        <Text variant="eyebrow" className="px-3.5 pb-1">
          {zone.name}
        </Text>
      ) : null}
      <GHScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 66 }}
        contentContainerStyle={{ paddingHorizontal: 8, gap: 2, alignItems: 'flex-end' }}
      >
        {pieces.length === 0 ? (
          <Text variant="caption" className="px-2 pb-4">
            No shoes on the rack yet
          </Text>
        ) : (
          pieces.map((p, i) => (
            <ClosetPiece
              key={p.id}
              item={p}
              width={94}
              height={66}
              dimmed={isDimmed(p)}
              onPress={onPressPiece}
              tagTop={8}
              index={i}
              outArt={<GhostShoeGlyph width={86} color={withAlpha(colors.ink, 0.22)} />}
            />
          ))
        )}
      </GHScrollView>
      {/* The rack bars overlap the transparent foot of each cutout so shoes sit on them. */}
      <View className="mb-2.5 h-1" style={{ marginTop: -8, backgroundColor: colors.rail }} />
      <View className="h-1" style={{ backgroundColor: colors.rail, opacity: 0.45 }} />
    </DropZone>
  );
}

// --------------------------------------------------------- accessories tray --

/** A shallow inset tray with pieces scattered at slight angles. */
export function AccessoryTray({ zone, pieces, isDimmed, onPressPiece, labelled }: ZoneProps) {
  const { colors, isDark } = useTheme();
  return (
    <DropZone
      zoneId={zone.id}
      radius={24}
      className="rounded-[24px] bg-surface-tinted p-2"
      style={{ boxShadow: `inset 0 3px 8px ${withAlpha(colors.shadow, isDark ? 0.4 : 0.12)}` }}
    >
      {labelled ? (
        <Text variant="eyebrow" className="px-2 pt-1">
          {zone.name}
        </Text>
      ) : null}
      <GHScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 100 }}
        contentContainerStyle={{ paddingHorizontal: 6, gap: 6, alignItems: 'center' }}
      >
        {pieces.length === 0 ? (
          <Text variant="caption" className="px-2">
            The tray is empty
          </Text>
        ) : (
          pieces.map((p, i) => (
            <View key={p.id} style={{ transform: [{ rotate: `${trayTilt(p.id)}deg` }] }}>
              <ClosetPiece
                item={p}
                width={72}
                height={80}
                dimmed={isDimmed(p)}
                onPress={onPressPiece}
                tagTop={28}
                index={i}
                outArt={<GhostFoldGlyph width={60} color={withAlpha(colors.ink, 0.22)} />}
              />
            </View>
          ))
        )}
      </GHScrollView>
    </DropZone>
  );
}

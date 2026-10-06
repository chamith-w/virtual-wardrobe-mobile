import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, Repeat2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedPressable, Cutout, IconButton, Text } from '@/components/ui';
import { formatShortDay } from '@/lib/dates';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

const ZOOM_STEP = 1.65;
const ZOOM_MAX = 3;
const DISC_RATIO = 300 / 260;
/** Stage height ÷ width (260 × 312 in ItemDetail.dc.html). */
export const STAGE_ASPECT = 1.2;
/** Tint cross-fade when paging (DESIGN.md #5). */
const TINT_MS = 800;
const TINT_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export type StagePager = { position: number; total: number; onStep: (step: 1 | -1) => void };

export type DetailStageProps = {
  item: {
    id: string;
    name: string;
    cutoutUri: string | null;
    thumbUri: string | null;
    originalUri: string | null;
    createdAt: Date;
  };
  width: number;
  discColor: string;
  /** +1 / −1 when the item just changed by paging, for the slide-in. */
  direction: number;
  pager: StagePager | null;
  /** Bumped by the header's zoom button. */
  zoomKey: number;
  /** While the hero flies in or out, the stage's own cutout stays hidden beneath it. */
  cutoutHidden?: boolean;
  onZoomedChange: (zoomed: boolean) => void;
  onFlippedChange?: (flipped: boolean) => void;
};

/**
 * The hero of item detail: the full-size cutout on a tinted disc. Pinch or
 * double-tap to zoom (pan while zoomed), swipe sideways to page, and flip in
 * 3D to see the original photo when there is one. Reduce Motion swaps
 * physics for fades.
 */
export function DetailStage({
  item,
  width,
  discColor,
  direction,
  pager,
  zoomKey,
  cutoutHidden = false,
  onZoomedChange,
  onFlippedChange,
}: DetailStageProps) {
  const reduced = useMotionReduced();
  const height = width * STAGE_ASPECT;
  const [flipped, setFlipped] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const hasOriginal = !!item.originalUri;

  const flip = useSharedValue(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const swipe = useSharedValue(0);
  const swap = useSharedValue(0);
  const disc = useSharedValue(discColor);

  const spring = (to: number, config: (typeof springs)[keyof typeof springs] = springs.gentle) =>
    reduced ? withTiming(to, { duration: durations.reducedFade }) : withSpring(to, config);

  const reportZoom = (z: boolean) => {
    setZoomed(z);
    onZoomedChange(z);
  };
  const changeFlipped = (f: boolean) => {
    setFlipped(f);
    onFlippedChange?.(f);
  };

  useEffect(() => {
    disc.set(withTiming(discColor, { duration: reduced ? durations.reducedFade : TINT_MS, easing: TINT_EASING }));
  }, [disc, discColor, reduced]);

  // New item (paging): reset flip and zoom, slide the new cutout in.
  const lastId = useRef(item.id);
  useEffect(() => {
    if (lastId.current === item.id) return;
    lastId.current = item.id;
    changeFlipped(false);
    flip.set(0);
    scale.set(1);
    tx.set(0);
    ty.set(0);
    reportZoom(false);
    swap.set(direction || 1);
    swap.set(spring(0, springs.gentle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    flip.set(spring(flipped ? 1 : 0, springs.flip));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, reduced]);

  const toggleZoom = () => {
    const zoomIn = scale.get() < 1.05;
    changeFlipped(false);
    scale.set(spring(zoomIn ? ZOOM_STEP : 1, springs.bouncy));
    tx.set(spring(0));
    ty.set(spring(0));
    reportZoom(zoomIn);
  };

  const firstZoomKey = useRef(zoomKey);
  useEffect(() => {
    if (zoomKey !== firstZoomKey.current) toggleZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomKey]);

  const limitX = (width * (ZOOM_MAX - 1)) / 2;
  const limitY = (height * (ZOOM_MAX - 1)) / 2;
  const onSwipe = (step: 1 | -1) => pager?.onStep(step);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      baseScale.set(scale.get());
    })
    .onUpdate((e) => {
      scale.set(Math.min(ZOOM_MAX, Math.max(1, baseScale.get() * e.scale)));
    })
    .onEnd(() => {
      const z = scale.get() > 1.05;
      if (!z) {
        scale.set(withSpring(1, springs.gentle));
        tx.set(withSpring(0, springs.gentle));
        ty.set(withSpring(0, springs.gentle));
      }
      scheduleOnRN(reportZoom, z);
    });

  // Zoomed: pan the garment any way. Otherwise only a sideways swipe (to page)
  // claims the touch, so vertical drags still scroll the page.
  const pan = (zoomed ? Gesture.Pan().minDistance(4) : Gesture.Pan().activeOffsetX([-16, 16]).failOffsetY([-14, 14]))
    .onStart(() => {
      startX.set(tx.get());
      startY.set(ty.get());
    })
    .onUpdate((e) => {
      if (scale.get() > 1.05) {
        tx.set(Math.max(-limitX, Math.min(limitX, startX.get() + e.translationX)));
        ty.set(Math.max(-limitY, Math.min(limitY, startY.get() + e.translationY)));
      } else {
        swipe.set(e.translationX * 0.35);
      }
    })
    .onEnd((e) => {
      if (scale.get() > 1.05) return;
      swipe.set(withSpring(0, springs.gentle));
      if (Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 650) {
        scheduleOnRN(onSwipe, e.translationX < 0 ? 1 : -1);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scheduleOnRN(toggleZoom);
    });

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() + swipe.get() + swap.get() * 46 },
      { translateY: ty.get() },
      { scale: scale.get() * (1 - Math.abs(swap.get()) * 0.12) },
    ],
    opacity: 1 - Math.min(1, Math.abs(swap.get())),
  }));
  const frontStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - flip.get() }
      : { transform: [{ perspective: 1300 }, { rotateY: `${flip.get() * 180}deg` }] },
  );
  const backStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: flip.get() }
      : { transform: [{ perspective: 1300 }, { rotateY: `${flip.get() * 180 - 180}deg` }] },
  );
  const discStyle = useAnimatedStyle(() => ({ backgroundColor: disc.get() }));

  const discSize = width * DISC_RATIO;
  const face = { ...StyleSheet.absoluteFill, backfaceVisibility: 'hidden' as const };
  const hint = ['Pinch or double tap to zoom.', pager && pager.total > 1 ? 'Swipe sideways for the next piece.' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <View>
      <View style={{ width, height, alignSelf: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: discSize,
              height: discSize,
              borderRadius: discSize / 2,
              left: (width - discSize) / 2,
              top: height * 0.15,
              opacity: 0.55,
            },
            discStyle,
          ]}
        />
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} accessibilityHint={hint}>
            <Animated.View style={[face, frontStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
                <View style={[StyleSheet.absoluteFill, { opacity: cutoutHidden ? 0 : 1 }]}>
                  <Cutout
                    uri={item.cutoutUri ?? item.thumbUri}
                    width={width}
                    height={height}
                    shadow="lifted"
                    accessibilityLabel={`${item.name} cutout`}
                  />
                </View>
              </Animated.View>
            </Animated.View>
            {item.originalUri ? (
              <Animated.View style={[face, { borderRadius: 26, overflow: 'hidden' }, backStyle]}>
                <Image
                  source={{ uri: item.originalUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityLabel={`Original photo of ${item.name}`}
                />
                <View
                  className="absolute bottom-3 left-3 h-7 justify-center rounded-pill px-3"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                  <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
                    Original photo · {formatShortDay(item.createdAt)}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
      </View>

      <StageControls
        hasOriginal={hasOriginal}
        flipped={flipped}
        pager={pager}
        onFlip={() => {
          if (zoomed) toggleZoom();
          changeFlipped(!flipped);
        }}
      />
    </View>
  );
}

/** Flip to the original photo (when there is one) and the previous / next pager. */
function StageControls({
  hasOriginal,
  flipped,
  pager,
  onFlip,
}: {
  hasOriginal: boolean;
  flipped: boolean;
  pager: StagePager | null;
  onFlip: () => void;
}) {
  const { colors } = useTheme();
  const paging = pager !== null && pager.total > 1;
  if (!hasOriginal && !paging) return <View className="h-4" />;
  return (
    <View className="mt-4 h-11 flex-row items-center justify-between px-5">
      {hasOriginal ? (
        <AnimatedPressable
          accessibilityLabel={flipped ? 'Show cutout' : 'Show original photo'}
          accessibilityState={{ selected: flipped }}
          onPress={onFlip}
          className="h-11 flex-row items-center gap-2 rounded-pill border border-line bg-surface/80 pl-3 pr-4"
        >
          <Repeat2 size={18} color={colors.ink} strokeWidth={1.9} />
          <Text variant="bodySm" weight="semibold">
            {flipped ? 'Show cutout' : 'Original photo'}
          </Text>
        </AnimatedPressable>
      ) : (
        <View />
      )}
      {paging ? (
        <View className="flex-row items-center gap-1">
          <IconButton
            icon={ChevronLeft}
            variant="glass"
            iconSize={18}
            accessibilityLabel="Previous piece"
            onPress={() => pager.onStep(-1)}
          />
          <Text variant="caption" weight="bold" tone="ink" className="min-w-[44px] text-center">
            {pager.position} / {pager.total}
          </Text>
          <IconButton
            icon={ChevronRight}
            variant="glass"
            iconSize={18}
            accessibilityLabel="Next piece"
            onPress={() => pager.onStep(1)}
          />
        </View>
      ) : null}
    </View>
  );
}

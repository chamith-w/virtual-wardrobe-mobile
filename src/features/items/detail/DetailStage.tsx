import { Image } from 'expo-image';
import { Camera, ChevronLeft, ChevronRight, Repeat2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedPressable, Cutout, IconButton, Text } from '@/components/ui';
import { formatShortDay } from '@/lib/dates';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

const ZOOM_STEP = 1.65;
const ZOOM_MAX = 3;
const DISC_RATIO = 300 / 260;

export type StagePager = { position: number; total: number; onStep: (step: 1 | -1) => void };

export type DetailStageProps = {
  item: { id: string; name: string; cutoutUri: string | null; thumbUri: string | null; originalUri: string | null; createdAt: Date };
  width: number;
  discColor: string;
  /** +1 / −1 when the item just changed by paging, for the slide-in. */
  direction: number;
  pager: StagePager | null;
  /** Bumped by the header's zoom button. */
  zoomKey: number;
  onZoomedChange: (zoomed: boolean) => void;
};

/**
 * The hero of item detail: the full-size cutout on a tinted disc. Pinch or
 * double-tap to zoom (pan while zoomed), swipe sideways to page, and flip in
 * 3D to see the original photo. Reduce Motion swaps physics for fades.
 */
export function DetailStage({ item, width, discColor, direction, pager, zoomKey, onZoomedChange }: DetailStageProps) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const height = width * 1.2;
  const [flipped, setFlipped] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const flip = useSharedValue(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const swipe = useSharedValue(0);
  const swap = useSharedValue(0);

  const spring = (to: number, config: (typeof springs)[keyof typeof springs] = springs.gentle) =>
    reduced ? withTiming(to, { duration: durations.reducedFade }) : withSpring(to, config);

  const reportZoom = (z: boolean) => {
    setZoomed(z);
    onZoomedChange(z);
  };

  // New item (paging): reset flip and zoom, slide the new cutout in.
  const lastId = useRef(item.id);
  useEffect(() => {
    if (lastId.current === item.id) return;
    lastId.current = item.id;
    setFlipped(false);
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
    setFlipped(false);
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

  const pan = Gesture.Pan()
    .minDistance(8)
    .activeOffsetX(zoomed ? [-4, 4] : [-16, 16])
    .failOffsetY(zoomed ? [-1000, 1000] : [-14, 14])
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

  const disc = width * DISC_RATIO;
  const face = { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' as const };

  return (
    <View>
      <View style={{ width, height, alignSelf: 'center' }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            left: (width - disc) / 2,
            top: height * 0.15,
            backgroundColor: discColor,
            opacity: 0.55,
          }}
        />
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} accessibilityHint="Pinch or double tap to zoom. Swipe to see the next piece.">
            <Animated.View style={[face, frontStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
                <Cutout
                  uri={item.cutoutUri ?? item.thumbUri}
                  width={width}
                  height={height}
                  shadow="lifted"
                  accessibilityLabel={`${item.name} cutout`}
                />
              </Animated.View>
            </Animated.View>
            <Animated.View style={[face, { borderRadius: 26, overflow: 'hidden' }, backStyle]}>
              {item.originalUri ? (
                <>
                  <Image
                    source={{ uri: item.originalUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    accessibilityLabel={`Original photo of ${item.name}`}
                  />
                  <View className="absolute bottom-3 left-3 h-7 justify-center rounded-pill px-3" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
                      Original photo · {formatShortDay(item.createdAt)}
                    </Text>
                  </View>
                </>
              ) : (
                <View className="flex-1 items-center justify-center gap-2.5 bg-surface px-8">
                  <View className="h-14 w-14 items-center justify-center rounded-pill bg-surface-tinted">
                    <Camera size={24} color={colors.muted} strokeWidth={1.7} />
                  </View>
                  <Text variant="display3" className="text-center" style={{ fontSize: 22, lineHeight: 27 }}>
                    Cutout only
                  </Text>
                  <Text variant="bodySm" tone="muted" className="text-center">
                    This piece was added without its original photo.
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>
        </GestureDetector>
      </View>

      <View className="mt-4 flex-row items-center justify-between px-5">
        <AnimatedPressable
          accessibilityLabel={flipped ? 'Show cutout' : 'Show original photo'}
          accessibilityState={{ selected: flipped }}
          onPress={() => {
            if (zoomed) toggleZoom();
            setFlipped((f) => !f);
          }}
          className="h-11 flex-row items-center gap-2 rounded-pill border border-line bg-surface/80 pl-3 pr-4"
        >
          <Repeat2 size={18} color={colors.ink} strokeWidth={1.9} />
          <Text variant="bodySm" weight="semibold">
            {flipped ? 'Show cutout' : 'Original photo'}
          </Text>
        </AnimatedPressable>
        {pager && pager.total > 1 ? (
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
    </View>
  );
}

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Heart, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { AnimatedPressable, Cutout, IconButton, useCutoutImage, type SheetRef } from '@/components/ui';
import { ARCHIVE_REASON_LABEL } from '@/features/items/catalog';
import { archiveItem, setFavorite } from '@/features/items/mutations';
import { useItem } from '@/features/items/useItem';
import { useActiveWardrobe, useWardrobeCounts } from '@/features/wardrobe/useWardrobeData';
import { mixHex } from '@/lib/color';
import { haptics } from '@/lib/haptics';
import { useItemTransition, type HeroOrigin } from '@/store/itemTransition';
import { toast } from '@/store/toast';
import { useWardrobeView } from '@/store/wardrobeView';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { DetailBody } from './DetailBody';
import { AddToOutfitSheet, ArchiveSheet, EditSheet, MoveSheet } from './DetailSheets';
import { DetailStage, STAGE_ASPECT } from './DetailStage';
import { heroPose, IDENTITY_POSE, poseAt, type Rect } from './hero';

/** The stage starts below the floating header: 104 − 48 on the 390 × 844 artboard. */
const HEADER_SPACE = 56;
const STAGE_SHARE = 260 / 390;
const STAGE_MAX = 320;
/** Pull the page down this far (iOS overscroll) to close. */
const PULL_TO_CLOSE = 96;
/** Flying home: no bounce past the thumbnail, so the hand-off is clean. */
const EXIT_SPRING = { damping: 24, stiffness: 260, mass: 0.9, overshootClamping: true };
const FADE_EASING = Easing.bezier(0.4, 0, 0.2, 1);
/** Background tint strength (DESIGN.md #5): mix(garment, background, t). */
const TINT = { light: 0.76, dark: 0.72 };
const DISC = { light: 0.55, dark: 0.5 };

type HeroMode = 'in' | 'landed' | 'out' | 'off';

/** Item detail behind its own sheet host: it's a native modal, so sheets must portal inside it. */
export function ItemDetailScreen({ id }: { id: string }) {
  return (
    <BottomSheetModalProvider>
      <ItemDetail initialId={id} />
    </BottomSheetModalProvider>
  );
}

function FavouriteButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  return (
    <AnimatedPressable
      accessibilityLabel="Favourite"
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={() => {
        if (!reduced) pop.set(withSequence(withSpring(1.28, springs.snappy), withSpring(1, springs.bouncy)));
        onPress();
      }}
      className="h-11 w-11 items-center justify-center rounded-pill border border-line bg-surface/80"
    >
      <Animated.View style={style}>
        <Heart
          size={21}
          strokeWidth={1.8}
          color={on ? colors.accent : colors.ink}
          fill={on ? colors.accent : 'transparent'}
        />
      </Animated.View>
    </AnimatedPressable>
  );
}

function ItemDetail({ initialId }: { initialId: string }) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const stageW = Math.min(STAGE_MAX, Math.round(screenW * STAGE_SHARE));
  const stageH = stageW * STAGE_ASPECT;
  const stageTop = insets.top + HEADER_SPACE;
  const stageRect: Rect = { x: (screenW - stageW) / 2, y: stageTop, width: stageW, height: stageH };

  // Where this detail was opened from, captured once: later opens don't disturb it.
  const [launch] = useState<HeroOrigin | null>(() => {
    const origin = useItemTransition.getState().origin;
    return origin && origin.itemId === initialId ? origin : null;
  });
  const setHidden = useItemTransition((s) => s.setHidden);
  const endTransition = useItemTransition((s) => s.end);
  const heroImage = useCutoutImage(launch?.uri);
  const heroAspect = heroImage ? heroImage.width() / heroImage.height() : null;

  const [heroMode, setHeroMode] = useState<HeroMode>(launch && !reduced ? 'in' : 'off');
  const [startPose] = useState(() =>
    heroMode === 'in' && launch ? heroPose(launch.from, stageRect, heroAspect) : IDENTITY_POSE,
  );

  const browseIds = useWardrobeView((s) => s.browseIds);
  const [view, setView] = useState({ id: initialId, direction: 0 });
  const { item, loaded } = useItem(view.id);
  const { wardrobes } = useActiveWardrobe();
  const counts = useWardrobeCounts();

  const [zoomKey, setZoomKey] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showMatches, setShowMatches] = useState(false);

  const addSheet = useRef<SheetRef>(null);
  const editSheet = useRef<SheetRef>(null);
  const moveSheet = useRef<SheetRef>(null);
  const archiveSheet = useRef<SheetRef>(null);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const progress = useSharedValue(0);
  const heroOpacity = useSharedValue(heroMode === 'in' ? 1 : 0);
  const poseX = useSharedValue(startPose.translateX);
  const poseY = useSharedValue(startPose.translateY);
  const poseS = useSharedValue(startPose.scale);

  // ------------------------------------------------------------- enter --
  const onLanded = () => {
    setHeroMode('landed');
    heroOpacity.set(withTiming(0, { duration: 180, easing: FADE_EASING }));
  };

  useEffect(() => {
    // No flight (Reduce Motion, or opened without a thumbnail): nothing to keep hidden.
    if (heroMode === 'off') endTransition();
    progress.set(
      reduced
        ? withTiming(1, { duration: durations.reducedFade })
        : withSpring(1, springs.gentle, (done) => {
            if (done && heroMode === 'in') scheduleOnRN(onLanded);
          }),
    );
    return () => endTransition();
    // Runs once: the entrance plays when the screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paging away from the piece that was tapped shows it again in its list.
  useEffect(() => {
    if (!launch || reduced) return;
    setHidden(view.id === launch.itemId ? launch.itemId : null);
  }, [launch, reduced, setHidden, view.id]);

  // ------------------------------------------------------------- close --
  const closing = useRef(false);
  const finish = () => {
    endTransition();
    requestAnimationFrame(() => (router.canGoBack() ? router.back() : router.replace('/wardrobe')));
  };

  const close = (how: 'auto' | 'fade' = 'auto') => {
    if (closing.current) return;
    closing.current = true;
    const back = launch?.back;
    const flyHome =
      how === 'auto' &&
      !reduced &&
      !!launch &&
      !!back &&
      !!item &&
      item.id === launch.itemId &&
      (launch.wardrobeId === null || item.wardrobeId === launch.wardrobeId) &&
      item.status !== 'archived' &&
      !zoomed &&
      !flipped;
    if (flyHome && back) {
      const pose = heroPose(back, stageRect, heroAspect);
      poseX.set(pose.translateX);
      poseY.set(pose.translateY);
      poseS.set(pose.scale);
      heroOpacity.set(1);
      setHeroMode('out');
      progress.set(
        withSpring(0, EXIT_SPRING, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
      return;
    }
    progress.set(
      withTiming(0, { duration: reduced ? durations.reducedFade : 260, easing: FADE_EASING }, (done) => {
        if (done) scheduleOnRN(finish);
      }),
    );
  };

  // Android back runs the same exit (only while this screen is on top).
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        closeRef.current();
        return true;
      });
      return () => sub.remove();
    }, []),
  );
  const requestClose = () => closeRef.current();

  // A piece that disappears (deleted elsewhere) closes its page.
  useEffect(() => {
    if (loaded && !item) closeRef.current('fade');
  }, [loaded, item]);

  // ------------------------------------------------------------ paging --
  const index = browseIds.indexOf(view.id);
  const goTo = (id: string, direction: 1 | -1) => {
    if (id === view.id) return;
    haptics.tap();
    setView({ id, direction });
    setShowMatches(false);
  };
  const pager =
    index >= 0 && browseIds.length > 1
      ? {
          position: index + 1,
          total: browseIds.length,
          onStep: (step: 1 | -1) => {
            const next = browseIds[(index + step + browseIds.length) % browseIds.length];
            if (next) goTo(next, step);
          },
        }
      : null;

  const openMatch = (id: string) => {
    goTo(id, 1);
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, 0, true);
    });
  };

  // -------------------------------------------------------------- tint --
  const garmentHex = item?.colors[0]?.hex;
  const scheme = isDark ? 'dark' : 'light';
  const tint = garmentHex ? mixHex(garmentHex, colors.background, TINT[scheme]) : colors.surfaceTinted;
  const disc = garmentHex ? mixHex(garmentHex, colors.background, DISC[scheme]) : colors.surfaceTintedStrong;
  const tintColor = useSharedValue(colors.background);
  const tinted = useRef(false);
  const hasItem = !!item;
  useEffect(() => {
    if (!hasItem) return;
    // The first tint appears with the page; later ones cross-fade as you page.
    if (!tinted.current) {
      tinted.current = true;
      tintColor.set(tint);
      return;
    }
    tintColor.set(withTiming(tint, { duration: reduced ? durations.reducedFade : 800, easing: FADE_EASING }));
  }, [hasItem, reduced, tint, tintColor]);

  // ------------------------------------------------------------ styles --
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => scrollY.set(e.contentOffset.y),
    onEndDrag: (e) => {
      if (e.contentOffset.y < -PULL_TO_CLOSE) scheduleOnRN(requestClose);
    },
  });

  const backdropStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    const pull = interpolate(scrollY.get(), [-180, 0], [0.55, 1], 'clamp');
    return { backgroundColor: tintColor.get(), opacity: p * pull };
  });
  const chromeStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) }));
  const stageStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    if (reduced || launch) return { opacity: p };
    return { opacity: p, transform: [{ scale: 0.92 + 0.08 * progress.get() }] };
  });
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduced) return { opacity: Math.min(1, Math.max(0, p)) };
    return {
      opacity: Math.min(1, Math.max(0, p * 1.4)),
      transform: [{ translateY: (1 - p) * 140 }],
    };
  });
  const heroStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const pose = poseAt({ translateX: poseX.get(), translateY: poseY.get(), scale: poseS.get() }, p);
    return {
      opacity: heroOpacity.get(),
      transform: [
        { translateX: pose.translateX },
        { translateY: pose.translateY - scrollY.get() * p },
        { scale: pose.scale },
      ],
    };
  });

  const heroVisible = heroMode !== 'off' && !!launch;

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backdropStyle]} />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={!zoomed}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: stageTop }}
      >
        {item ? (
          <>
            <Animated.View style={stageStyle}>
              <DetailStage
                item={item}
                width={stageW}
                discColor={disc}
                direction={view.direction}
                pager={pager}
                zoomKey={zoomKey}
                cutoutHidden={heroMode === 'in' || heroMode === 'out'}
                onZoomedChange={setZoomed}
                onFlippedChange={setFlipped}
              />
            </Animated.View>
            <Animated.View
              className="mt-3 rounded-t-[30px] bg-surface px-5 pt-6"
              style={[
                {
                  minHeight: screenH - stageTop - stageH,
                  paddingBottom: insets.bottom + 48,
                  shadowColor: colors.shadow,
                  shadowOpacity: isDark ? 0.4 : 0.12,
                  shadowRadius: 15,
                  shadowOffset: { width: 0, height: -10 },
                  elevation: 8,
                },
                cardStyle,
              ]}
            >
              <DetailBody
                item={item}
                showMatches={showMatches}
                onToggleMatches={() => setShowMatches((m) => !m)}
                onAddToOutfit={() => addSheet.current?.present()}
                onEdit={() => editSheet.current?.present()}
                onMove={() => moveSheet.current?.present()}
                onArchive={() => archiveSheet.current?.present()}
                onOpenItem={(m) => openMatch(m.id)}
                onOpenOutfit={(outfitId) => router.push({ pathname: '/outfit/[id]', params: { id: outfitId } })}
              />
              {/* Keeps the card's surface under an overscroll bounce at the bottom. */}
              <View pointerEvents="none" className="absolute -bottom-[600px] left-0 right-0 h-[600px] bg-surface" />
            </Animated.View>
          </>
        ) : null}
      </Animated.ScrollView>

      {heroVisible && launch ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: stageRect.x, top: stageRect.y, width: stageW, height: stageH },
            heroStyle,
          ]}
        >
          <Cutout uri={launch.uri} width={stageW} height={stageH} shadow="lifted" />
        </Animated.View>
      ) : null}

      <Animated.View
        style={[{ position: 'absolute', top: insets.top + 4, left: 16, right: 16 }, chromeStyle]}
        className="flex-row items-center justify-between"
      >
        <IconButton icon={ChevronLeft} variant="glass" accessibilityLabel="Back" onPress={() => close()} />
        {item ? (
          <View className="flex-row gap-2">
            <FavouriteButton on={item.isFavorite} onPress={() => setFavorite(item.id, !item.isFavorite)} />
            <IconButton
              icon={zoomed ? ZoomOut : ZoomIn}
              variant="glass"
              accessibilityLabel={zoomed ? 'Zoom out' : 'Zoom in'}
              onPress={() => setZoomKey((k) => k + 1)}
            />
          </View>
        ) : null}
      </Animated.View>

      {item ? (
        <>
          <AddToOutfitSheet ref={addSheet} item={item} />
          <EditSheet ref={editSheet} item={item} />
          <MoveSheet ref={moveSheet} item={item} wardrobeId={item.wardrobeId} wardrobes={wardrobes} counts={counts} />
          <ArchiveSheet
            ref={archiveSheet}
            onArchive={(reason, note) => {
              archiveItem(item.id, reason, note);
              haptics.statusChanged();
              toast(`Archived as ${ARCHIVE_REASON_LABEL[reason].toLowerCase()} · history kept`);
              archiveSheet.current?.dismiss();
              close('fade');
            }}
          />
        </>
      ) : null}
    </View>
  );
}

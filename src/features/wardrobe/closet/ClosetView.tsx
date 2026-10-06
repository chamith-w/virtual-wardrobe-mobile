import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView as RNScrollView, View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { SectionHeader, Skeleton, Text, type SheetRef } from '@/components/ui';
import type { Zone } from '@/db/schema';
import { moveToZone } from '@/features/items/actions';
import type { Rect } from '@/features/items/detail/hero';
import { measureRect, openItem } from '@/features/items/openItem';
import type { ClosetItem } from '@/features/wardrobe/useWardrobeData';

import { groupByZone, resolveDrop, ZONE_SECTION_TITLE, zoneMeta, zoneSections } from '../closet';
import { ClosetDragProvider, type DragPiece } from './ClosetDrag';
import { ItemQuickSheet } from './ItemQuickSheet';
import { AccessoryTray, DrawerStack, HangingRail, ShelfBand, ShoeRack } from './Zones';

const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);

export type ClosetViewProps = {
  header: ReactNode;
  /** Pieces of the active wardrobe, already sorted. */
  pieces: ClosetItem[];
  /** Zones of the active wardrobe. */
  zones: Zone[];
  /** Ids matching the search/filters, or null when nothing is filtered. */
  matchIds: Set<string> | null;
  loaded: boolean;
  /** Shown instead of the zones when the wardrobe has no pieces. */
  empty: ReactNode | null;
  /** 0 → 1 as the doors open (the closet scales up and brightens). */
  reveal: SharedValue<number>;
  /** Bumped when the doors finish, to give the rail a swing. */
  impulse: SharedValue<number>;
};

function ClosetSkeleton() {
  return (
    <View className="gap-3 px-5 pt-6" accessibilityLabel="Loading your wardrobe">
      <Skeleton width="45%" height={20} />
      <View className="flex-row gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={78} height={120} radius={16} />
        ))}
      </View>
      <Skeleton width="30%" height={20} className="mt-5" />
      <Skeleton height={110} radius={18} />
      <Skeleton height={110} radius={18} />
    </View>
  );
}

/**
 * The stylised closet (direction A): zones stacked vertically, each scrolling
 * horizontally. Pieces that don't match the search fade back rather than
 * disappearing, so the closet keeps its shape.
 */
export function ClosetView({ header, pieces, zones, matchIds, loaded, empty, reveal, impulse }: ClosetViewProps) {
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const scrollRef = useAnimatedRef<RNScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => scrollY.set(e.contentOffset.y) });
  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheetRef = useRef<SheetRef>(null);

  const byZone = groupByZone(pieces, zones);
  const piecesOf = (zoneId: string) => byZone.get(zoneId) ?? [];
  const isDimmed = (p: ClosetItem) => matchIds !== null && !matchIds.has(p.id);
  const sections = zoneSections(zones);
  // Detail pages through the closet in the order it reads: zone by zone, left to right.
  const browseIds = sections.flatMap((s) => s.zones.flatMap((z) => piecesOf(z.id).map((p) => p.id)));

  const selected = selectedId ? pieces.find((p) => p.id === selectedId) : undefined;
  useEffect(() => {
    // The piece left this wardrobe (e.g. sent to storage): close its sheet.
    if (selectedId && loaded && !selected) sheetRef.current?.dismiss();
  }, [selectedId, selected, loaded]);

  // Where the tapped piece sits, so its detail can fly back into the spot.
  const pieceRect = useRef<Rect | null>(null);
  const openPiece = (item: ClosetItem, view: View | null) => {
    pieceRect.current = null;
    measureRect(view).then((rect) => {
      pieceRect.current = rect;
    });
    setSelectedId(item.id);
    sheetRef.current?.present();
  };

  const openDetails = async (item: ClosetItem, sheetThumb: View | null) => {
    await openItem(item, { from: sheetThumb, back: pieceRect.current, browseIds });
    sheetRef.current?.dismiss();
  };

  const onDrop = (piece: DragPiece, zoneId: string) => {
    const zone = resolveDrop(piece.zoneId, zoneId, zones);
    if (zone) moveToZone(piece, zone);
  };

  const revealStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    return {
      opacity: interpolate(r, [0, 0.3, 1], [0.4, 0.65, 1]),
      transform: [{ scale: interpolate(r, [0, 0.3, 1], [0.94, 0.95, 1]) }],
    };
  });

  return (
    <ClosetDragProvider scrollRef={scrollRef} scrollY={scrollY} onDrop={onDrop} onDraggingChange={setDragging}>
      <AnimatedGHScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={!dragging}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: tabInset + 28 }}
      >
        <Animated.View style={revealStyle}>
          {header}
          {!loaded ? (
            <ClosetSkeleton />
          ) : empty ? (
            <View className="px-5 pt-6">{empty}</View>
          ) : (
            <>
              {sections.map((section) => {
                const sectionPieces = section.zones.flatMap((z) => piecesOf(z.id));
                const many = section.zones.length > 1;
                const zoneProps = (z: Zone) => ({
                  zone: z,
                  pieces: piecesOf(z.id),
                  isDimmed,
                  onPressPiece: openPiece,
                  labelled: many,
                });
                return (
                  <View key={section.type}>
                    <View className="px-5">
                      <SectionHeader
                        size="sm"
                        title={ZONE_SECTION_TITLE[section.type]}
                        meta={zoneMeta(sectionPieces)}
                      />
                    </View>
                    {section.type === 'rail' ? (
                      <View className="gap-4">
                        {section.zones.map((z) => (
                          <HangingRail key={z.id} {...zoneProps(z)} impulse={impulse} />
                        ))}
                      </View>
                    ) : section.type === 'drawer' ? (
                      <DrawerStack
                        zones={section.zones}
                        piecesOf={piecesOf}
                        isDimmed={isDimmed}
                        onPressPiece={openPiece}
                      />
                    ) : (
                      <View className="mx-4 gap-2.5">
                        {section.zones.map((z) =>
                          section.type === 'shelf' ? (
                            <ShelfBand key={z.id} {...zoneProps(z)} />
                          ) : section.type === 'shoes' ? (
                            <ShoeRack key={z.id} {...zoneProps(z)} />
                          ) : (
                            <AccessoryTray key={z.id} {...zoneProps(z)} />
                          ),
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
              <Text variant="caption" className="px-10 pt-6 text-center">
                Tip: press and hold any piece to move it to another zone.
              </Text>
            </>
          )}
        </Animated.View>
      </AnimatedGHScrollView>
      <ItemQuickSheet
        ref={sheetRef}
        item={selected}
        zones={zones}
        onDismiss={() => setSelectedId(null)}
        onOpenDetails={openDetails}
      />
    </ClosetDragProvider>
  );
}

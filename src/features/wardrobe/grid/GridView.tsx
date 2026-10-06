import { FlashList } from '@shopify/flash-list';
import { memo, useEffect, useRef, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { AnimatedPressable, Cutout, Skeleton, Text } from '@/components/ui';
import { CATEGORY_DEFAULT_ZONE } from '@/features/items/catalog';
import { StatusTag } from '@/features/items/components/StatusTag';
import { isOut, statusTagLabel } from '@/features/items/status';
import type { ClosetItem } from '@/features/wardrobe/useWardrobeData';
import { useMotionReduced } from '@/theme/motion';
import { useHiddenForHero } from '@/store/itemTransition';
import { durations, springs } from '@/theme/tokens';

import { gridTileHeight } from '../closet';
import { sortSubtitle, type SortKey } from '../filters';

const LIST_PADDING = 14;
const CARD_GUTTER = 6;
/** Card chrome around the image well: p-1.5 plus the hairline border, each side. */
const CARD_INSET = 7;
/** Cards that rise in on first render; the rest just appear. */
const RISE_COUNT = 10;

type CardProps = {
  item: ClosetItem;
  index: number;
  sort: SortKey;
  columnWidth: number;
  /** `view` is the cutout's box, measured for the detail transition. */
  onPress: (item: ClosetItem, view: View | null) => void;
};

/** The cutout's box inside the well, by kind of piece (proportions from Grid.dc.html). */
function imageBox(item: ClosetItem, wellWidth: number, wellHeight: number) {
  const zone = CATEGORY_DEFAULT_ZONE[item.category];
  if (zone === 'shoes') return { width: wellWidth * 0.82, height: wellHeight * 0.76 };
  if (zone === 'accessories' || zone === 'drawer') return { width: wellWidth * 0.62, height: wellHeight * 0.79 };
  return { width: wellWidth * 0.72, height: wellHeight * 0.76 };
}

const GridCard = memo(function GridCard({ item, index, sort, columnWidth, onPress }: CardProps) {
  const reduced = useMotionReduced();
  const rise = useSharedValue(index < RISE_COUNT ? 0 : 1);
  const cutoutBox = useRef<View>(null);
  const hidden = useHiddenForHero(item.id);

  useEffect(() => {
    if (rise.get() === 1) return;
    rise.set(
      reduced
        ? withTiming(1, { duration: durations.reducedFade })
        : withDelay(index * 40, withSpring(1, springs.gentle)),
    );
    // Only the first render of the first cards rises; recycled cells don't replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riseStyle = useAnimatedStyle(() => {
    const r = rise.get();
    if (reduced) return { opacity: r };
    return { opacity: Math.min(1, r * 1.3), transform: [{ translateY: (1 - r) * 18 }] };
  });

  const out = isOut(item.status);
  const wellWidth = columnWidth - CARD_GUTTER * 2 - CARD_INSET * 2;
  const wellHeight = gridTileHeight(item.category);
  const box = imageBox(item, wellWidth, wellHeight);
  const subtitle = sortSubtitle(item, sort);

  return (
    <Animated.View style={[{ paddingHorizontal: CARD_GUTTER, paddingBottom: 12 }, riseStyle]}>
      <AnimatedPressable
        accessibilityLabel={out ? `${item.name}, ${statusTagLabel(item.status, item.lentTo)}` : item.name}
        accessibilityHint={subtitle}
        onPress={() => onPress(item, cutoutBox.current)}
        scaleTo={0.97}
        className="rounded-[22px] border border-line bg-surface p-1.5"
      >
        <View className="items-center justify-center rounded-[16px] bg-surface-tinted" style={{ height: wellHeight }}>
          <View ref={cutoutBox} collapsable={false} style={{ opacity: hidden ? 0 : 1 }}>
            <Cutout
              uri={item.thumbUri}
              width={box.width}
              height={box.height}
              desaturate={out ? 0.6 : 0}
              style={out ? { opacity: 0.32 } : undefined}
            />
          </View>
          {out ? (
            <View className="absolute left-2 top-2">
              <StatusTag status={item.status} lentTo={item.lentTo} pop={false} />
            </View>
          ) : null}
        </View>
        <View className="px-1.5 pb-1 pt-2.5">
          <Text variant="bodySm" weight="semibold" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="caption" numberOfLines={1} className="mt-0.5">
            {subtitle}
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
});

function GridSkeleton() {
  return (
    <View className="flex-row gap-3 px-5" accessibilityLabel="Loading your wardrobe">
      {[0, 1].map((col) => (
        <View key={col} className="flex-1 gap-3">
          <Skeleton height={col === 0 ? 228 : 186} radius={22} />
          <Skeleton height={col === 0 ? 186 : 228} radius={22} />
        </View>
      ))}
    </View>
  );
}

export type GridViewProps = {
  header: ReactNode;
  /** Filtered and sorted pieces. */
  pieces: ClosetItem[];
  sort: SortKey;
  loaded: boolean;
  /** Shown when nothing matches (or the wardrobe is empty). */
  empty: ReactNode;
  onOpenItem: (item: ClosetItem, view: View | null) => void;
};

/** Masonry grid of cutouts (FlashList v2), two columns, tall tiles for garments and short for shoes. */
export function GridView({ header, pieces, sort, loaded, empty, onOpenItem }: GridViewProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const columnWidth = (width - LIST_PADDING * 2) / 2;

  return (
    <FlashList
      data={loaded ? pieces : []}
      masonry
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <GridCard item={item} index={index} sort={sort} columnWidth={columnWidth} onPress={onOpenItem} />
      )}
      extraData={sort}
      ListHeaderComponent={<View style={{ marginHorizontal: -LIST_PADDING }}>{header}</View>}
      ListEmptyComponent={
        loaded ? (
          <View className="px-1.5 pt-4">{empty}</View>
        ) : (
          <View className="-mx-3.5 pt-2">
            <GridSkeleton />
          </View>
        )
      }
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: tabInset + 28,
        paddingHorizontal: LIST_PADDING,
      }}
    />
  );
}

import { FlashList } from '@shopify/flash-list';
import { Check } from 'lucide-react-native';
import { memo, useEffect, useRef, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { AnimatedPressable, Cutout, Skeleton, Text } from '@/components/ui';
import { pieceActions, runPieceAction } from '@/features/items/a11y';
import { CATEGORY_DEFAULT_ZONE } from '@/features/items/catalog';
import { StatusTag } from '@/features/items/components/StatusTag';
import { isOut, statusTagLabel } from '@/features/items/status';
import type { ClosetItem } from '@/features/wardrobe/useWardrobeData';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
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
  /** Multi-select is on: taps toggle instead of opening. */
  selecting: boolean;
  selected: boolean;
  /** `view` is the cutout's box, measured for the detail transition. */
  onPress: (item: ClosetItem, view: View | null) => void;
  onLongPress: (item: ClosetItem) => void;
};

function SelectMark({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  if (selected) {
    return (
      <View className="h-7 w-7 items-center justify-center rounded-pill bg-inverse">
        <Check size={16} color={colors.onInverse} strokeWidth={2.6} />
      </View>
    );
  }
  return (
    <View
      className="h-7 w-7 rounded-pill border-[1.5px] border-line-strong"
      style={{ backgroundColor: withAlpha(colors.surface, 0.85) }}
    />
  );
}

/** The cutout's box inside the well, by kind of piece (proportions from Grid.dc.html). */
function imageBox(item: ClosetItem, wellWidth: number, wellHeight: number) {
  const zone = CATEGORY_DEFAULT_ZONE[item.category];
  if (zone === 'shoes') return { width: wellWidth * 0.82, height: wellHeight * 0.76 };
  if (zone === 'accessories' || zone === 'drawer') return { width: wellWidth * 0.62, height: wellHeight * 0.79 };
  return { width: wellWidth * 0.72, height: wellHeight * 0.76 };
}

const GridCard = memo(function GridCard({
  item,
  index,
  sort,
  columnWidth,
  selecting,
  selected,
  onPress,
  onLongPress,
}: CardProps) {
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
  const pickStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : withSpring(selected ? 0.95 : 1, springs.snappy) }],
  }));

  const out = isOut(item.status);
  const wellWidth = columnWidth - CARD_GUTTER * 2 - CARD_INSET * 2;
  const wellHeight = gridTileHeight(item.category);
  const box = imageBox(item, wellWidth, wellHeight);
  const subtitle = sortSubtitle(item, sort);
  const label = out ? `${item.name}, ${statusTagLabel(item.status, item.lentTo)}` : item.name;

  return (
    <Animated.View style={[{ paddingHorizontal: CARD_GUTTER, paddingBottom: 12 }, riseStyle]}>
      <Animated.View style={pickStyle}>
        <AnimatedPressable
          accessibilityRole={selecting ? 'checkbox' : 'button'}
          accessibilityState={selecting ? { checked: selected } : undefined}
          accessibilityLabel={label}
          accessibilityHint={selecting ? undefined : `${subtitle}. Long press to select several.`}
          accessibilityActions={selecting ? undefined : pieceActions(item)}
          onAccessibilityAction={(e) => runPieceAction(item, e.nativeEvent.actionName, () => onLongPress(item))}
          onPress={() => onPress(item, cutoutBox.current)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={320}
          scaleTo={0.97}
          className={['rounded-[22px] bg-surface p-1.5', selected ? 'border-2 border-ink' : 'border border-line'].join(
            ' ',
          )}
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
            {selecting ? (
              <View className="absolute right-2 top-2" pointerEvents="none">
                <SelectMark selected={selected} />
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
  /** Ids picked in multi-select, or null when not selecting. */
  selection: ReadonlySet<string> | null;
  onOpenItem: (item: ClosetItem, view: View | null) => void;
  /** Long press: starts multi-select with this piece (or toggles it). */
  onSelectItem: (item: ClosetItem) => void;
};

/** Masonry grid of cutouts (FlashList v2), two columns, tall tiles for garments and short for shoes. */
export function GridView({ header, pieces, sort, loaded, empty, selection, onOpenItem, onSelectItem }: GridViewProps) {
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
        <GridCard
          item={item}
          index={index}
          sort={sort}
          columnWidth={columnWidth}
          selecting={selection !== null}
          selected={selection?.has(item.id) ?? false}
          onPress={selection ? (picked) => onSelectItem(picked) : onOpenItem}
          onLongPress={onSelectItem}
        />
      )}
      extraData={[sort, selection]}
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
        // Room for the selection bar when it's up.
        paddingBottom: tabInset + (selection ? 96 : 28),
        paddingHorizontal: LIST_PADDING,
      }}
    />
  );
}

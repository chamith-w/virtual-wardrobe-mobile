import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Heart, Sparkles } from 'lucide-react-native';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { AnimatedPressable, Chip, EmptyState, Skeleton, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { filterOutfits, outfitFilterOptions, outfitMeta, outfitTileHeight, type OutfitFilter } from './list';
import { setOutfitFavorite } from './mutations';
import { OutfitPreview } from './OutfitPreview';
import { useOutfitList, type OutfitSummary } from './useOutfits';

const LIST_PADDING = 14;
const CARD_GUTTER = 6;
const RISE_COUNT = 8;

const OutfitCard = memo(function OutfitCard({
  outfit,
  index,
  columnWidth,
}: {
  outfit: OutfitSummary;
  index: number;
  columnWidth: number;
}) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const rise = useSharedValue(index < RISE_COUNT ? 0 : 1);

  useEffect(() => {
    if (rise.get() === 1) return;
    rise.set(
      reduced
        ? withTiming(1, { duration: durations.reducedFade })
        : withDelay(index * 50, withSpring(1, springs.gentle)),
    );
    // Only the first render of the first cards rises; recycled cells don't replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riseStyle = useAnimatedStyle(() => {
    const r = rise.get();
    if (reduced) return { opacity: r };
    return { opacity: Math.min(1, r * 1.3), transform: [{ translateY: (1 - r) * 18 }] };
  });

  const width = columnWidth - CARD_GUTTER * 2;
  const meta = outfitMeta({ occasion: outfit.occasion, seasons: outfit.seasons, pieceCount: outfit.pieces.length });

  return (
    <Animated.View style={[{ paddingHorizontal: CARD_GUTTER, paddingBottom: 14 }, riseStyle]}>
      <AnimatedPressable
        accessibilityLabel={`${outfit.name}. ${meta}`}
        accessibilityHint="Opens the outfit"
        onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: outfit.id } })}
        scaleTo={0.97}
      >
        <OutfitPreview pieces={outfit.pieces} width={width} height={outfitTileHeight(outfit.pieces.length)} />
        <View className="px-1.5 pb-1 pt-2.5">
          <Text variant="display3" numberOfLines={1} style={{ fontSize: 18, lineHeight: 21, letterSpacing: -0.3 }}>
            {outfit.name}
          </Text>
          <Text variant="caption" numberOfLines={2} className="mt-0.5">
            {meta}
          </Text>
        </View>
      </AnimatedPressable>
      <AnimatedPressable
        accessibilityLabel={`Favourite ${outfit.name}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: outfit.isFavorite }}
        haptic="none"
        onPress={() => {
          haptics.tap();
          setOutfitFavorite(outfit.id, !outfit.isFavorite);
        }}
        scaleTo={0.85}
        className="absolute right-3 top-1.5 h-11 w-11 items-center justify-center"
      >
        <View
          className="h-8 w-8 items-center justify-center rounded-pill bg-surface"
          style={{
            shadowColor: colors.shadow,
            shadowOpacity: isDark ? 0.4 : 0.12,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <Heart
            size={17}
            strokeWidth={1.9}
            color={outfit.isFavorite ? colors.accent : colors.ink}
            fill={outfit.isFavorite ? colors.accent : 'transparent'}
          />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
});

function OutfitsSkeleton() {
  return (
    <View className="flex-row gap-3 px-5 pt-3" accessibilityLabel="Loading outfits">
      {[0, 1].map((col) => (
        <View key={col} className="flex-1 gap-3">
          <Skeleton height={col === 0 ? 220 : 256} radius={18} />
          <Skeleton height={col === 0 ? 256 : 220} radius={18} />
        </View>
      ))}
    </View>
  );
}

/** The Outfits segment: saved outfits as a masonry of little boards, filterable by occasion or favourites. */
export function OutfitsView({ header }: { header: ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const { outfits, loaded } = useOutfitList();
  const [filter, setFilter] = useState<OutfitFilter>('all');

  const options = outfitFilterOptions(outfits);
  const active = options.some((o) => o.value === filter) ? filter : 'all';
  const shown = filterOutfits(outfits, active);
  const columnWidth = (width - LIST_PADDING * 2) / 2;
  const line =
    active === 'favorites'
      ? `${shown.length} ${shown.length === 1 ? 'favourite' : 'favourites'}`
      : `${shown.length} ${shown.length === 1 ? 'outfit' : 'outfits'} · tap the heart to favourite`;

  const empty =
    outfits.length === 0 ? (
      <EmptyState
        title="No outfits yet"
        body="Put pieces together on a board and save the looks you love."
        illustration="hanger"
        actionLabel="New outfit"
        actionIcon={Sparkles}
        onAction={() => router.push('/outfit/new')}
      />
    ) : active === 'favorites' ? (
      <EmptyState
        title="No favourites yet"
        body="Tap the heart on any outfit to keep it here."
        illustration={<Heart size={44} color={colors.faint} strokeWidth={1.4} />}
      />
    ) : (
      <EmptyState
        title="Nothing for this occasion"
        body="Try another filter."
        illustration="shelf"
        actionLabel="Show all"
        onAction={() => setFilter('all')}
      />
    );

  return (
    <FlashList
      data={loaded ? shown : []}
      masonry
      numColumns={2}
      keyExtractor={(o) => o.id}
      renderItem={({ item, index }) => <OutfitCard outfit={item} index={index} columnWidth={columnWidth} />}
      ListHeaderComponent={
        <View style={{ marginHorizontal: -LIST_PADDING }}>
          {header}
          {outfits.length > 0 ? (
            <>
              <GHScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 8 }}
              >
                {options.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    selected={o.value === active}
                    onPress={() => setFilter(o.value)}
                  />
                ))}
              </GHScrollView>
              <Text variant="caption" weight="semibold" className="px-5 pb-2.5 pt-3">
                {line}
              </Text>
            </>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loaded ? (
          <View className="px-1.5 pt-4">{empty}</View>
        ) : (
          <View className="-mx-3.5">
            <OutfitsSkeleton />
          </View>
        )
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: tabInset + 28,
        paddingHorizontal: LIST_PADDING,
      }}
    />
  );
}

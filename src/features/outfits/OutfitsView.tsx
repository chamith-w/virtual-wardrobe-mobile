import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Heart, Sparkles } from 'lucide-react-native';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { AnimatedPressable, Chip, EmptyState, Skeleton, Text, type SheetRef } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import {
  chipSelected,
  filterOutfits,
  isFiltering,
  NO_OUTFIT_FILTERS,
  outfitChips,
  outfitCountLine,
  outfitMeta,
  pruneFilters,
  toggleChip,
  type OutfitFilters,
} from './list';
import { deleteOutfit, duplicateOutfit, setOutfitFavorite } from './mutations';
import { OutfitMenuSheet, PlanOutfitSheet, type OutfitMenuTarget } from './OutfitSheets';
import { OutfitThumb } from './OutfitThumb';
import { useOutfitList, type OutfitSummary } from './useOutfits';

const LIST_PADDING = 14;
const CARD_GUTTER = 6;
const RISE_COUNT = 8;

const openOutfit = (id: string) => router.push({ pathname: '/outfit/[id]', params: { id } });

const OutfitCard = memo(function OutfitCard({
  outfit,
  index,
  columnWidth,
  onMenu,
}: {
  outfit: OutfitSummary;
  index: number;
  columnWidth: number;
  onMenu: (outfit: OutfitSummary) => void;
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
        accessibilityHint="Opens the outfit. Hold for more options"
        accessibilityActions={[{ name: 'longpress', label: 'Plan, duplicate or delete' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onMenu(outfit);
        }}
        onPress={() => openOutfit(outfit.id)}
        onLongPress={() => {
          haptics.press();
          onMenu(outfit);
        }}
        delayLongPress={350}
        scaleTo={0.97}
      >
        <OutfitThumb outfit={outfit} width={width} />
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

/**
 * The Outfits segment (Grid.dc.html): saved boards as a masonry of
 * snapshots, filterable by favourites, occasion and season. Hold a card for
 * plan, duplicate and delete.
 */
export function OutfitsView({ header }: { header: ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const { outfits, loaded } = useOutfitList();
  const [picked, setPicked] = useState<OutfitFilters>(NO_OUTFIT_FILTERS);
  const [target, setTarget] = useState<OutfitMenuTarget | null>(null);
  const menuRef = useRef<SheetRef>(null);
  const planRef = useRef<SheetRef>(null);

  const chips = outfitChips(outfits);
  const filters = pruneFilters(picked, chips);
  const shown = filterOutfits(outfits, filters);
  const columnWidth = (width - LIST_PADDING * 2) / 2;

  const showMenu = (o: OutfitSummary) => {
    setTarget({
      id: o.id,
      name: o.name,
      meta: outfitMeta({ occasion: o.occasion, seasons: o.seasons, pieceCount: o.pieces.length }),
    });
    menuRef.current?.present();
  };

  const empty =
    outfits.length === 0 ? (
      <EmptyState
        title="No outfits yet"
        body="Put pieces together on a board and save the looks you love."
        illustration="hanger"
        actionLabel="New outfit"
        actionIcon={Sparkles}
        onAction={() => openOutfit('new')}
      />
    ) : filters.favorites && !filters.occasion && !filters.season ? (
      <EmptyState
        title="No favourites yet"
        body="Tap the heart on any outfit to keep it here."
        illustration={<Heart size={44} color={colors.faint} strokeWidth={1.4} />}
      />
    ) : (
      <EmptyState
        title="Nothing matches"
        body="No outfit fits all of those. Try fewer filters."
        illustration="shelf"
        actionLabel="Show all"
        onAction={() => setPicked(NO_OUTFIT_FILTERS)}
      />
    );

  return (
    <>
      <FlashList
        data={loaded ? shown : []}
        masonry
        numColumns={2}
        keyExtractor={(o) => o.id}
        renderItem={({ item, index }) => (
          <OutfitCard outfit={item} index={index} columnWidth={columnWidth} onMenu={showMenu} />
        )}
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
                  {chips.map((c) => (
                    <Chip
                      key={c.kind === 'occasion' || c.kind === 'season' ? `${c.kind}-${c.value}` : c.kind}
                      label={c.label}
                      icon={c.kind === 'favorites' ? Heart : undefined}
                      selected={chipSelected(c, filters)}
                      onPress={() => setPicked(toggleChip(c, filters))}
                    />
                  ))}
                </GHScrollView>
                <Text variant="caption" weight="semibold" className="px-5 pb-2.5 pt-3">
                  {outfitCountLine(shown.length, filters)}
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

      <OutfitMenuSheet
        ref={menuRef}
        outfit={target}
        onEdit={() => {
          menuRef.current?.dismiss();
          if (target) openOutfit(target.id);
        }}
        onPlan={() => {
          menuRef.current?.dismiss();
          planRef.current?.present();
        }}
        onDuplicate={() => {
          menuRef.current?.dismiss();
          const copy = target ? duplicateOutfit(target.id) : null;
          if (!copy) return;
          haptics.outfitSaved();
          if (isFiltering(filters)) setPicked(NO_OUTFIT_FILTERS);
          toast(`Duplicated as ${copy.name}`);
        }}
        onDelete={() => {
          menuRef.current?.dismiss();
          if (!target) return;
          deleteOutfit(target.id);
          haptics.statusChanged();
          toast(`Deleted ${target.name}`, 'info');
        }}
      />
      <PlanOutfitSheet ref={planRef} outfit={target} />
    </>
  );
}

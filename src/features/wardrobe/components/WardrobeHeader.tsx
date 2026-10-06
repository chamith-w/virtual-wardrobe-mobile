import { router } from 'expo-router';
import {
  Archive,
  ChevronDown,
  DoorOpen,
  House,
  Plus,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';

import { AnimatedPressable, Button, Chip, IconButton, SearchField, Segmented, Swatch, Text } from '@/components/ui';
import type { Wardrobe } from '@/db/schema';
import { GROUP_LABEL } from '@/features/items/catalog';
import { activeFilterCount, sortLabel, toggleIn, type Facets } from '@/features/wardrobe/filters';
import { useWardrobeView, type WardrobeMode } from '@/store/wardrobeView';
import { useTheme } from '@/theme/ThemeProvider';

/** A wardrobe's glyph: a house for wardrobes, an archive box for storage. */
export function WardrobeIcon({ icon, size, color }: { icon: string | undefined; size: number; color: string }) {
  const Glyph: LucideIcon = icon === 'archive' ? Archive : House;
  return <Glyph size={size} color={color} strokeWidth={1.9} />;
}

function QuickFilters({ facets }: { facets: Facets }) {
  const { colors } = useTheme();
  const filters = useWardrobeView((s) => s.filters);
  const setFilters = useWardrobeView((s) => s.setFilters);

  return (
    <GHScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-5 mt-3"
      contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 4, gap: 8, alignItems: 'center' }}
    >
      <Chip
        label="All"
        selected={filters.groups.length === 0}
        onPress={() => setFilters((f) => ({ ...f, groups: [] }))}
      />
      {facets.groups.map((g) => (
        <Chip
          key={g.value}
          label={GROUP_LABEL[g.value]}
          selected={filters.groups.includes(g.value)}
          onPress={() => setFilters((f) => ({ ...f, groups: toggleIn(f.groups, g.value) }))}
        />
      ))}
      {facets.colors.length > 0 ? (
        <View className="mx-1 h-6 w-px" style={{ backgroundColor: colors.faint, opacity: 0.4 }} />
      ) : null}
      {facets.colors.slice(0, 8).map((c) => (
        <Swatch
          key={c.value}
          hex={c.hex}
          name={`Filter by ${c.value}`}
          size={22}
          selected={filters.colors.includes(c.value)}
          onPress={() => setFilters((f) => ({ ...f, colors: toggleIn(f.colors, c.value) }))}
        />
      ))}
    </GHScrollView>
  );
}

export type WardrobeHeaderProps = {
  wardrobe: Wardrobe | undefined;
  total: number;
  matching: number;
  /** Saved outfits, for the title in the Outfits segment. */
  outfitCount: number;
  facets: Facets;
  onOpenWardrobes: () => void;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onReplayDoors: () => void;
};

/** Wardrobe switcher, title, Closet/Grid/Outfits, search and quick filters. */
export function WardrobeHeader({
  wardrobe,
  total,
  matching,
  outfitCount,
  facets,
  onOpenWardrobes,
  onOpenFilters,
  onOpenSort,
  onReplayDoors,
}: WardrobeHeaderProps) {
  const { colors } = useTheme();
  const mode = useWardrobeView((s) => s.mode);
  const setMode = useWardrobeView((s) => s.setMode);
  const query = useWardrobeView((s) => s.query);
  const setQuery = useWardrobeView((s) => s.setQuery);
  const filters = useWardrobeView((s) => s.filters);
  const sort = useWardrobeView((s) => s.sort);
  const clearAll = useWardrobeView((s) => s.clearAll);

  const activeCount = activeFilterCount(filters);
  const filtering = activeCount > 0 || query.trim().length > 0;
  const name = wardrobe?.name ?? 'Home';

  return (
    <View className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <AnimatedPressable
          accessibilityLabel={`${name} wardrobe`}
          accessibilityHint="Switch to another wardrobe"
          onPress={onOpenWardrobes}
          scaleTo={0.96}
          className="h-11 flex-row items-center gap-1.5"
        >
          <WardrobeIcon icon={wardrobe?.icon} size={16} color={colors.muted} />
          <Text variant="eyebrow" style={{ fontSize: 12, letterSpacing: 1.6 }}>
            {name} wardrobe
          </Text>
          <ChevronDown size={15} color={colors.muted} strokeWidth={1.9} />
        </AnimatedPressable>
        {mode === 'outfits' ? (
          <Button
            label="New outfit"
            variant="accent"
            size="sm"
            icon={Sparkles}
            onPress={() => router.push('/outfit/new')}
          />
        ) : (
          <View className="flex-row gap-2">
            {mode === 'closet' ? (
              <IconButton icon={DoorOpen} accessibilityLabel="Replay the opening doors" onPress={onReplayDoors} />
            ) : null}
            <IconButton icon={Plus} accessibilityLabel="Add a piece" onPress={() => router.push('/add')} />
          </View>
        )}
      </View>

      <View className="mt-0.5 flex-row items-baseline gap-2.5">
        <Text variant="display1" accessibilityRole="header">
          {mode === 'outfits' ? 'Outfits' : 'Wardrobe'}
        </Text>
        <Text variant="display3" tone="muted" style={{ fontSize: 22 }}>
          {mode === 'outfits' ? outfitCount : total}
        </Text>
      </View>

      <View className="mt-3.5">
        <Segmented<WardrobeMode>
          accessibilityLabel="Wardrobe view"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'closet', label: 'Closet' },
            { value: 'grid', label: 'Grid' },
            { value: 'outfits', label: 'Outfits' },
          ]}
        />
      </View>

      {mode === 'outfits' ? null : (
        <>
          <View className="mt-3 flex-row gap-2">
            <SearchField
              className="flex-1"
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${total} ${total === 1 ? 'piece' : 'pieces'}`}
              accessibilityLabel="Search wardrobe"
            />
            <View>
              <IconButton
                icon={SlidersHorizontal}
                accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
                onPress={onOpenFilters}
              />
              {activeCount > 0 ? (
                <View
                  pointerEvents="none"
                  className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-pill bg-accent-strong px-1.5"
                >
                  <Text variant="caption" weight="bold" tone="onAccent" style={{ fontSize: 11, lineHeight: 14 }}>
                    {activeCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <QuickFilters facets={facets} />

          <View className="flex-row items-center justify-between pb-2.5 pt-2">
            <Text variant="caption" weight="semibold">
              {filtering
                ? `${matching} of ${total} ${mode === 'closet' ? 'pieces match' : 'pieces'}`
                : `${total} ${total === 1 ? 'piece' : 'pieces'}`}
            </Text>
            <View className="flex-row items-center gap-1">
              {filtering ? <Button label="Clear" variant="ghost" size="sm" onPress={clearAll} /> : null}
              <AnimatedPressable
                accessibilityLabel={`Sort: ${sortLabel(sort)}`}
                accessibilityHint="Changes the order"
                onPress={onOpenSort}
                className="h-11 flex-row items-center gap-1"
              >
                <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
                  {sortLabel(sort)}
                </Text>
                <ChevronDown size={15} color={colors.ink} strokeWidth={1.9} />
              </AnimatedPressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

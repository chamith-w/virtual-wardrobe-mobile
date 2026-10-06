import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { EmptyState, type SheetRef } from '@/components/ui';
import { ClosetView } from '@/features/wardrobe/closet/ClosetView';
import { WardrobeDoors } from '@/features/wardrobe/closet/WardrobeDoors';
import { WardrobeHeader } from '@/features/wardrobe/components/WardrobeHeader';
import { FilterSheet, SortSheet, WardrobeSheet } from '@/features/wardrobe/components/WardrobeSheets';
import { activeFilterCount, facetsOf, matchesAll, sortItems } from '@/features/wardrobe/filters';
import { GridView } from '@/features/wardrobe/grid/GridView';
import {
  useActiveWardrobe,
  useWardrobeCounts,
  useWardrobeItems,
  useZones,
  type ClosetItem,
} from '@/features/wardrobe/useWardrobeData';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { useWardrobeView } from '@/store/wardrobeView';

/** Outfits list placeholder until phase 5. */
function OutfitsPlaceholder({ header }: { header: ReactNode }) {
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: tabInset + 28 }}
    >
      {header}
      <View className="px-5 pt-6">
        <EmptyState title="Saved outfits" body="The outfit list and builder arrive in phase 5." illustration="shelf" />
      </View>
    </ScrollView>
  );
}

/**
 * The Wardrobe tab: the stylised closet (direction A, docs/design/Closet.dc.html)
 * behind opening doors, the masonry grid, and the outfits list, sharing one
 * header with the wardrobe switcher, search and filters.
 */
export default function WardrobeScreen() {
  const mode = useWardrobeView((s) => s.mode);
  const query = useWardrobeView((s) => s.query);
  const filters = useWardrobeView((s) => s.filters);
  const sort = useWardrobeView((s) => s.sort);
  const clearAll = useWardrobeView((s) => s.clearAll);
  const clearFilters = useWardrobeView((s) => s.clearFilters);

  const { wardrobes, active, setActive } = useActiveWardrobe();
  const { data: allZones } = useZones();
  const { data: pieces, loaded } = useWardrobeItems(active?.id);
  const counts = useWardrobeCounts();

  const wardrobeSheet = useRef<SheetRef>(null);
  const filterSheet = useRef<SheetRef>(null);
  const sortSheet = useRef<SheetRef>(null);

  // Doors play on the first visit of the session; the header button replays them.
  const doorsPlayed = useSession((s) => s.wardrobeDoorsPlayed);
  const markDoorsPlayed = useSession((s) => s.markWardrobeDoorsPlayed);
  const [doors, setDoors] = useState({ on: !doorsPlayed, key: 0 });
  const reveal = useSharedValue(doorsPlayed ? 1 : 0);
  const impulse = useSharedValue(0);

  const zones = allZones.filter((z) => z.wardrobeId === active?.id);
  const facets = facetsOf(pieces);
  const filtering = query.trim().length > 0 || activeFilterCount(filters) > 0;
  const matching = filtering ? pieces.filter((p) => matchesAll(p, query, filters)) : pieces;
  const matchIds = filtering ? new Set(matching.map((p) => p.id)) : null;

  const openItem = (item: ClosetItem) => {
    // The item detail screen isn't routed yet.
    toast(`Details for ${item.name} arrive with the item screen`, 'info');
  };

  const header = (
    <WardrobeHeader
      wardrobe={active}
      total={pieces.length}
      matching={matching.length}
      facets={facets}
      onOpenWardrobes={() => wardrobeSheet.current?.present()}
      onOpenFilters={() => filterSheet.current?.present()}
      onOpenSort={() => sortSheet.current?.present()}
      onReplayDoors={() => setDoors((d) => ({ on: true, key: d.key + 1 }))}
    />
  );

  const emptyWardrobe = (
    <EmptyState
      title={`Nothing in ${active?.name ?? 'this wardrobe'} yet`}
      body="Photograph a piece and it’s hung here, background removed."
      actionLabel="Add a piece"
      actionIcon={Plus}
      onAction={() => router.push('/add')}
    />
  );

  return (
    <View className="flex-1 bg-background">
      {mode === 'closet' ? (
        <ClosetView
          header={header}
          pieces={pieces}
          zones={zones}
          matchIds={matchIds}
          loaded={loaded}
          empty={pieces.length === 0 ? emptyWardrobe : null}
          reveal={reveal}
          impulse={impulse}
          onOpenDetails={openItem}
        />
      ) : mode === 'grid' ? (
        <GridView
          header={header}
          pieces={sortItems(matching, sort)}
          sort={sort}
          loaded={loaded}
          empty={
            pieces.length === 0 ? (
              emptyWardrobe
            ) : (
              <EmptyState
                title="Nothing matches"
                body="Try fewer filters or a different word."
                illustration="shelf"
                actionLabel="Clear search and filters"
                onAction={clearAll}
              />
            )
          }
          onOpenItem={openItem}
        />
      ) : (
        <OutfitsPlaceholder header={header} />
      )}

      {mode === 'closet' && doors.on ? (
        <WardrobeDoors
          playKey={doors.key}
          reveal={reveal}
          onDone={() => {
            setDoors((d) => ({ ...d, on: false }));
            markDoorsPlayed();
            impulse.set(impulse.get() + 1);
          }}
        />
      ) : null}

      <WardrobeSheet
        ref={wardrobeSheet}
        wardrobes={wardrobes}
        zones={allZones}
        counts={counts}
        activeId={active?.id}
        onPick={(w) => {
          setActive(w.id);
          clearFilters();
          wardrobeSheet.current?.dismiss();
        }}
      />
      <FilterSheet ref={filterSheet} facets={facets} matching={matching.length} />
      <SortSheet ref={sortSheet} />
    </View>
  );
}

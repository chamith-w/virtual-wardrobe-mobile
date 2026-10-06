import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { EmptyState, type SheetRef } from '@/components/ui';
import { openItem } from '@/features/items/openItem';
import { OutfitsView } from '@/features/outfits/OutfitsView';
import { useOutfitPicker } from '@/features/outfits/useOutfits';
import { ClosetView } from '@/features/wardrobe/closet/ClosetView';
import { WardrobeDoors } from '@/features/wardrobe/closet/WardrobeDoors';
import { WardrobeHeader } from '@/features/wardrobe/components/WardrobeHeader';
import { FilterSheet, NewWardrobeSheet, SortSheet, WardrobeSheet } from '@/features/wardrobe/components/WardrobeSheets';
import { activeFilterCount, facetsOf, matchesAll, sortItems } from '@/features/wardrobe/filters';
import { GridView } from '@/features/wardrobe/grid/GridView';
import { useActiveWardrobe, useWardrobeCounts, useWardrobeItems, useZones } from '@/features/wardrobe/useWardrobeData';
import { useSession } from '@/store/session';
import { useWardrobeView } from '@/store/wardrobeView';

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
  const { data: outfits } = useOutfitPicker();

  const wardrobeSheet = useRef<SheetRef>(null);
  const newWardrobeSheet = useRef<SheetRef>(null);
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
  // One sort for both views: the closet orders each zone by it, the grid the whole list.
  const sorted = sortItems(pieces, sort);
  const matching = filtering ? sorted.filter((p) => matchesAll(p, query, filters)) : sorted;
  const matchIds = filtering ? new Set(matching.map((p) => p.id)) : null;

  const header = (
    <WardrobeHeader
      wardrobe={active}
      total={pieces.length}
      matching={matching.length}
      outfitCount={outfits.length}
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
          pieces={sorted}
          zones={zones}
          matchIds={matchIds}
          loaded={loaded}
          empty={pieces.length === 0 ? emptyWardrobe : null}
          reveal={reveal}
          impulse={impulse}
        />
      ) : mode === 'grid' ? (
        <GridView
          header={header}
          pieces={matching}
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
          onOpenItem={(item, view) => openItem(item, { from: view, browseIds: matching.map((p) => p.id) })}
        />
      ) : (
        <OutfitsView header={header} />
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
        onNew={() => {
          wardrobeSheet.current?.dismiss();
          newWardrobeSheet.current?.present();
        }}
      />
      <NewWardrobeSheet
        ref={newWardrobeSheet}
        wardrobes={wardrobes}
        onCreated={(id) => {
          setActive(id);
          clearFilters();
        }}
      />
      <FilterSheet ref={filterSheet} facets={facets} matching={matching.length} />
      <SortSheet ref={sortSheet} />
    </View>
  );
}

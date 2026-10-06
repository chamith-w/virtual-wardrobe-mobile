import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { EmptyState, type SheetRef } from '@/components/ui';
import { sendManyToLaundry } from '@/features/items/actions';
import { MoveSheet } from '@/features/items/detail/DetailSheets';
import { openItem } from '@/features/items/openItem';
import { OutfitsView } from '@/features/outfits/OutfitsView';
import { useOutfitPicker } from '@/features/outfits/useOutfits';
import { ClosetView } from '@/features/wardrobe/closet/ClosetView';
import { WardrobeDoors } from '@/features/wardrobe/closet/WardrobeDoors';
import { WardrobeHeader } from '@/features/wardrobe/components/WardrobeHeader';
import { FilterSheet, NewWardrobeSheet, SortSheet, WardrobeSheet } from '@/features/wardrobe/components/WardrobeSheets';
import { activeFilterCount, facetsOf, matchesAll, sortItems } from '@/features/wardrobe/filters';
import { GridView } from '@/features/wardrobe/grid/GridView';
import { SelectionBar } from '@/features/wardrobe/grid/SelectionBar';
import { useActiveWardrobe, useWardrobeCounts, useWardrobeItems, useZones } from '@/features/wardrobe/useWardrobeData';
import { haptics } from '@/lib/haptics';
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
  const moveSheet = useRef<SheetRef>(null);

  // Grid multi-select: long-press a card to start, tap to add or remove. A
  // selection belongs to one view of one wardrobe; switching either drops it.
  const activeId = active?.id;
  const selectionKey = `${mode}:${activeId ?? ''}`;
  const [picked, setPicked] = useState<{ key: string; ids: ReadonlySet<string> } | null>(null);
  const selection = picked?.key === selectionKey ? picked.ids : null;
  const setSelection = (ids: ReadonlySet<string> | null) => setPicked(ids ? { key: selectionKey, ids } : null);
  useEffect(() => {
    if (!selection) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPicked(null);
      return true;
    });
    return () => sub.remove();
  }, [selection]);
  const toggleSelected = (id: string) => {
    if (!selection) haptics.press();
    const next = new Set(selection ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next.size > 0 ? next : null);
  };

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
          selection={selection}
          onOpenItem={(item, view) => openItem(item, { from: view, browseIds: matching.map((p) => p.id) })}
          onSelectItem={(item) => toggleSelected(item.id)}
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
        onManage={() => {
          wardrobeSheet.current?.dismiss();
          router.push('/wardrobes');
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
      {mode === 'grid' && selection ? (
        <SelectionBar
          count={selection.size}
          onDone={() => setSelection(null)}
          onLaundry={() => {
            sendManyToLaundry(pieces.filter((p) => selection.has(p.id)));
            setSelection(null);
          }}
          onMove={() => moveSheet.current?.present()}
        />
      ) : null}
      <MoveSheet
        ref={moveSheet}
        items={selection ? pieces.filter((p) => selection.has(p.id)) : []}
        wardrobeId={activeId ?? null}
        wardrobes={wardrobes}
        counts={counts}
        onMoved={() => setSelection(null)}
      />
      <FilterSheet ref={filterSheet} facets={facets} matching={matching.length} />
      <SortSheet ref={sortSheet} />
    </View>
  );
}

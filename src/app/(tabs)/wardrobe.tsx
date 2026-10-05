import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { HangerGlyph } from '@/components/illustrations/Glyphs';
import { Chip, EmptyState, IconButton, Screen, Segmented, Text } from '@/components/ui';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { db } from '@/db/client';
import { items } from '@/db/schema';
import { OUT_STATUSES, STATUS_LABEL, type ItemStatus } from '@/features/items/catalog';
import { useWardrobes, useZoneSummary } from '@/features/wardrobe/useWardrobeSummary';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

type View_ = 'closet' | 'grid' | 'outfits';

function useWardrobeItems(wardrobeId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select({ id: items.id, name: items.name, zoneId: items.zoneId, thumbUri: items.thumbUri, status: items.status })
      .from(items)
      .where(and(eq(items.wardrobeId, wardrobeId ?? ''), isNull(items.deletedAt)))
      .orderBy(asc(items.createdAt)),
    [wardrobeId],
  );
  return data;
}

function Thumb({ uri, name, status }: { uri: string | null; name: string; status: ItemStatus }) {
  const { colors } = useTheme();
  const out = OUT_STATUSES.includes(status);
  return (
    <View
      accessible
      accessibilityLabel={out ? `${name}, ${STATUS_LABEL[status]}` : name}
      className="h-24 w-[78px] items-center justify-center rounded-sm bg-surface-tinted"
    >
      {out ? (
        <View className="items-center gap-1.5">
          <HangerGlyph width={40} color={colors.faint} />
          <Text variant="caption" weight="semibold" style={{ fontSize: 10 }}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
      ) : uri ? (
        <Image source={{ uri }} style={{ width: 64, height: 76 }} contentFit="contain" transition={180} />
      ) : null}
    </View>
  );
}

/**
 * Phase 1 preview of the Wardrobe: real zones and items from SQLite. The
 * stylised closet (rail, shelves, drawers, doors, swaying hangers) is phase 2.
 */
export default function WardrobeScreen() {
  const [view, setView] = useState<View_>('closet');
  const allWardrobes = useWardrobes();
  const activeId = useSession((s) => s.activeWardrobeId);
  const setActive = useSession((s) => s.setActiveWardrobe);
  const wardrobe = allWardrobes.find((w) => w.id === activeId) ?? allWardrobes[0];
  const zoneRows = useZoneSummary(wardrobe?.id);
  const pieces = useWardrobeItems(wardrobe?.id);
  const total = pieces.length;

  return (
    <Screen className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <View className="flex-row gap-2">
          {allWardrobes.map((w) => (
            <Chip key={w.id} label={w.name} selected={w.id === wardrobe?.id} onPress={() => setActive(w.id)} />
          ))}
        </View>
        <IconButton icon={Plus} accessibilityLabel="Add a piece" onPress={() => router.push('/add')} />
      </View>
      <View className="mt-2 flex-row items-baseline gap-2.5">
        <Text variant="display1" accessibilityRole="header">
          Wardrobe
        </Text>
        <Text variant="display3" tone="muted" style={{ fontSize: 22 }}>
          {total}
        </Text>
      </View>

      <View className="mt-4">
        <Segmented
          accessibilityLabel="Wardrobe view"
          value={view}
          onChange={setView}
          options={[
            { value: 'closet', label: 'Closet' },
            { value: 'grid', label: 'Grid' },
            { value: 'outfits', label: 'Outfits' },
          ]}
        />
      </View>

      {view !== 'closet' ? (
        <View className="mt-6">
          <EmptyState
            title={view === 'grid' ? 'Masonry grid' : 'Saved outfits'}
            body={
              view === 'grid'
                ? 'The grid, search, filters and sorting arrive in phase 2.'
                : 'The outfit list and builder arrive in phase 5.'
            }
            illustration="shelf"
          />
        </View>
      ) : (
        zoneRows.map((zone) => {
          const zonePieces = pieces.filter((p) => p.zoneId === zone.id);
          return (
            <View key={zone.id}>
              <SectionHeader title={zone.name} meta={`${zone.n} ${zone.n === 1 ? 'piece' : 'pieces'}`} />
              {zonePieces.length === 0 ? (
                <EmptyState
                  outlined
                  illustration={zone.type === 'drawer' || zone.type === 'shelf' ? 'shelf' : 'hanger'}
                  title="Nothing here yet"
                  body="Add a piece, or move one here once drag-to-zone lands."
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 px-5"
                  className="-mx-5"
                >
                  {zonePieces.map((p) => (
                    <Thumb key={p.id} uri={p.thumbUri} name={p.name} status={p.status} />
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })
      )}
    </Screen>
  );
}

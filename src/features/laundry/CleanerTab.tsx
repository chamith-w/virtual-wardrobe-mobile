import { useRef } from 'react';
import { View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, Cutout, EmptyState, Text } from '@/components/ui';
import { backInWardrobe } from '@/features/items/actions';
import type { ZoneType } from '@/features/items/catalog';
import { CleanerDetails } from '@/features/items/components/CleanerDetails';
import { openItem } from '@/features/items/openItem';

import { useListMotion } from './listMotion';
import type { OutPiece } from './useOutPieces';

function CleanerCard({
  item,
  index,
  browseIds,
  zoneType,
}: {
  item: OutPiece;
  index: number;
  browseIds: string[];
  zoneType: ZoneType | undefined;
}) {
  const motion = useListMotion();
  const tile = useRef<View>(null);
  return (
    <Animated.View
      entering={motion.entering(index)}
      exiting={motion.exiting}
      layout={motion.layout}
      className="gap-3 rounded-[24px] border border-line bg-surface p-3"
    >
      <View className="flex-row gap-3.5">
        <AnimatedPressable
          accessibilityLabel={`Open ${item.name}`}
          onPress={() => openItem(item, { from: tile.current, browseIds })}
          scaleTo={0.95}
          className="h-[100px] w-[84px] items-center justify-center rounded-[18px] bg-surface-tinted"
        >
          <View ref={tile} collapsable={false}>
            <Cutout uri={item.thumbUri} width={68} height={84} />
          </View>
        </AnimatedPressable>
        <View className="flex-1 gap-2">
          <Text variant="display3" style={{ fontSize: 21, lineHeight: 24 }} numberOfLines={2}>
            {item.name}
          </Text>
          <CleanerDetails item={item} />
        </View>
      </View>
      <Button
        label="Picked up"
        size="sm"
        fullWidth
        accessibilityHint="Puts it back in your wardrobe"
        onPress={() => backInWardrobe(item, zoneType)}
      />
    </Animated.View>
  );
}

/** Pieces at the dry cleaner: when they went, when they're ready, and "Picked up". */
export function CleanerTab({
  cleaner,
  zoneTypeOf,
}: {
  cleaner: OutPiece[];
  zoneTypeOf: (zoneId: string | null) => ZoneType | undefined;
}) {
  const insets = useSafeAreaInsets();
  const browseIds = cleaner.map((p) => p.id);
  return (
    <GHScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 40, gap: 12 }}
    >
      {cleaner.length === 0 ? (
        <EmptyState
          title="Nothing at the cleaner"
          body="Set a piece to Dry cleaner and it waits here, with its ready day, until you pick it up."
        />
      ) : (
        cleaner.map((p, i) => (
          <CleanerCard key={p.id} item={p} index={i} browseIds={browseIds} zoneType={zoneTypeOf(p.zoneId)} />
        ))
      )}
    </GHScrollView>
  );
}

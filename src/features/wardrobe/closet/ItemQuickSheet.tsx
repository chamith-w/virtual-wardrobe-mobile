import { Check } from 'lucide-react-native';
import { useRef, type Ref } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Chip, Cutout, Sheet, Text, type SheetRef } from '@/components/ui';
import type { Zone } from '@/db/schema';
import { changeItemStatus, moveToZone, toggleWearToday } from '@/features/items/actions';
import { CATEGORY_LABEL } from '@/features/items/catalog';
import { LentCard } from '@/features/items/components/LentCard';
import { StatusSwitcher } from '@/features/items/components/StatusSwitcher';
import { isOut } from '@/features/items/status';
import { useWornToday } from '@/features/planner/wearLog';
import type { ClosetItem } from '@/features/wardrobe/useWardrobeData';
import { formatRelativeDay } from '@/lib/dates';
import { useHiddenForHero } from '@/store/itemTransition';

export function wearLine(item: { wearCount: number; lastWornAt: Date | null }): string {
  if (item.wearCount === 0) return 'Not worn yet';
  return `Worn ${item.wearCount}× · last worn ${formatRelativeDay(item.lastWornAt).toLowerCase()}`;
}

function QuickSheetBody({
  item,
  zones,
  onOpenDetails,
}: {
  item: ClosetItem;
  zones: Zone[];
  onOpenDetails: (item: ClosetItem, thumb: View | null) => void;
}) {
  const wornToday = useWornToday(item.id);
  const thumb = useRef<View>(null);
  const hidden = useHiddenForHero(item.id);
  const zone = zones.find((z) => z.id === item.zoneId);
  const otherZones = zones.filter((z) => z.wardrobeId === item.wardrobeId);

  return (
    <View>
      <View className="flex-row items-center gap-4">
        <View className="h-28 w-24 items-center justify-center rounded-[22px] bg-surface-tinted">
          <View ref={thumb} collapsable={false} style={{ opacity: hidden ? 0 : 1 }}>
            <Cutout uri={item.thumbUri} width={72} height={88} />
          </View>
        </View>
        <View className="flex-1">
          <Text variant="eyebrow">{zone?.name ?? CATEGORY_LABEL[item.category]}</Text>
          <Text variant="display3" className="mt-1" style={{ fontSize: 26, lineHeight: 29 }}>
            {item.name}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            {wearLine(item)}
          </Text>
        </View>
      </View>

      <Text variant="eyebrow" className="mb-2.5 mt-5">
        Status
      </Text>
      <StatusSwitcher status={item.status} onChange={(s) => changeItemStatus(item, s)} />
      {item.status === 'lent' ? <LentCard key={item.id} item={item} inSheet /> : null}

      {otherZones.length > 1 && !isOut(item.status) ? (
        <>
          <Text variant="eyebrow" className="mb-2.5 mt-5">
            Zone
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-5"
            contentContainerClassName="gap-2 px-5"
          >
            {otherZones.map((z) => (
              <Chip
                key={z.id}
                label={z.name}
                selected={z.id === item.zoneId}
                onPress={() => {
                  if (z.id !== item.zoneId) moveToZone(item, z);
                }}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View className="mt-6 flex-row gap-2.5">
        <Button label="Open details" className="flex-1" onPress={() => onOpenDetails(item, thumb.current)} />
        <Button
          label={wornToday ? 'Worn today' : 'Wear today'}
          variant="secondary"
          icon={wornToday ? Check : undefined}
          className="flex-1"
          accessibilityHint={wornToday ? 'Takes it off today’s log' : 'Logs it as worn today'}
          onPress={() => toggleWearToday(item, wornToday)}
        />
      </View>
    </View>
  );
}

/** Tapping a piece in the closet: status, zone and the two most common actions. */
export function ItemQuickSheet({
  ref,
  item,
  zones,
  onOpenDetails,
  onDismiss,
}: {
  ref: Ref<SheetRef>;
  item: ClosetItem | undefined;
  zones: Zone[];
  onOpenDetails: (item: ClosetItem, thumb: View | null) => void;
  onDismiss: () => void;
}) {
  return (
    <Sheet ref={ref} onDismiss={onDismiss}>
      {item ? <QuickSheetBody item={item} zones={zones} onOpenDetails={onOpenDetails} /> : <View className="h-24" />}
    </Sheet>
  );
}

import { Undo2, WashingMachine } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui';
import { backInWardrobe, sendToLaundry } from '@/features/items/actions';
import type { ItemStatus, ZoneType } from '@/features/items/catalog';
import { isOut } from '@/features/items/status';

type OutItem = { id: string; name: string; status: ItemStatus; lentTo: string | null };

const BACK_HINT: Partial<Record<ItemStatus, string>> = {
  worn: 'Hangs it back up, clean',
  laundry: 'Takes it out of the basket, washed',
  dry_cleaner: 'Marks it as picked up',
  lent: 'Marks it as returned',
};

/**
 * The one-tap way home for a piece that's out: "Back in wardrobe", plus
 * "Send to laundry" for something just worn. Renders nothing when it's in.
 */
export function OutActions({
  item,
  zoneType,
  className,
}: {
  item: OutItem;
  zoneType: ZoneType | null | undefined;
  className?: string;
}) {
  if (!isOut(item.status)) return null;
  return (
    <View className={['flex-row gap-2.5', className].filter(Boolean).join(' ')}>
      <Button
        label="Back in wardrobe"
        icon={Undo2}
        className="flex-1"
        accessibilityHint={BACK_HINT[item.status]}
        onPress={() => backInWardrobe(item, zoneType)}
      />
      {item.status === 'worn' ? (
        <Button
          label="Send to laundry"
          variant="secondary"
          icon={WashingMachine}
          className="flex-1"
          onPress={() => sendToLaundry(item)}
        />
      ) : null}
    </View>
  );
}

import type { Ref } from 'react';
import { View } from 'react-native';

import { AnimatedPressable, Sheet, Text, type SheetRef } from '@/components/ui';
import {
  CATEGORIES,
  CATEGORY_GROUP,
  CATEGORY_GROUPS,
  CATEGORY_LABEL,
  GROUP_LABEL,
  type Category,
} from '@/features/items/catalog';

/**
 * The fallback when `classifyGarment` has no confident answer (always, for
 * now): big category tiles grouped like the wardrobe filters. A weak guess is
 * pre-highlighted.
 */
export function CategoryPickSheet({
  ref,
  suggested,
  onPick,
}: {
  ref: Ref<SheetRef>;
  suggested: Category | null;
  onPick: (category: Category) => void;
}) {
  return (
    <Sheet ref={ref} title="What is it?" eyebrow="Category" snapPoints={['82%']} scrollable>
      {CATEGORY_GROUPS.map((group) => {
        const members = CATEGORIES.filter((c) => CATEGORY_GROUP[c] === group);
        return (
          <View key={group} className="mb-4">
            <Text variant="eyebrow" className="mb-2">
              {GROUP_LABEL[group]}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {members.map((c) => {
                const on = c === suggested;
                return (
                  <AnimatedPressable
                    key={c}
                    accessibilityLabel={on ? `${CATEGORY_LABEL[c]}, suggested` : CATEGORY_LABEL[c]}
                    onPress={() => onPick(c)}
                    scaleTo={0.94}
                    className={[
                      'h-14 min-w-[30%] flex-grow items-center justify-center rounded-md px-4',
                      on ? 'bg-inverse' : 'bg-surface-tinted',
                    ].join(' ')}
                  >
                    <Text variant="body" weight="semibold" tone={on ? 'onInverse' : 'ink'}>
                      {CATEGORY_LABEL[c]}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </Sheet>
  );
}

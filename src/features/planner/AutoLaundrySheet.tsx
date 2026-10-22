import { Minus, Plus, RotateCcw } from 'lucide-react-native';
import type { RefObject } from 'react';
import { View } from 'react-native';

import { Button, IconButton, Sheet, Text, type SheetRef } from '@/components/ui';
import { CATEGORIES, CATEGORY_LABEL, type Category } from '@/features/items/catalog';
import { usePreferences } from '@/store/preferences';

import { AUTO_LAUNDRY_DEFAULTS, AUTO_LAUNDRY_STEPS, laundryAfter, laundryAfterLabel } from './autoLaundry';

function Stepper({ category }: { category: Category }) {
  const overrides = usePreferences((s) => s.autoLaundry);
  const set = usePreferences((s) => s.setAutoLaundry);
  const value = laundryAfter(category, overrides);
  const at = AUTO_LAUNDRY_STEPS.indexOf(value);
  const step = (by: number) => {
    const next = AUTO_LAUNDRY_STEPS[Math.max(0, Math.min(AUTO_LAUNDRY_STEPS.length - 1, (at < 0 ? 0 : at) + by))];
    if (next !== undefined) set(category, next);
  };
  const changed = value !== AUTO_LAUNDRY_DEFAULTS[category];
  return (
    <View
      className="min-h-[56px] flex-row items-center gap-2 border-b border-line py-1.5"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={CATEGORY_LABEL[category]}
      accessibilityValue={{ text: laundryAfterLabel(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <View className="flex-1">
        <Text variant="body" weight="medium">
          {CATEGORY_LABEL[category]}
        </Text>
        <Text variant="caption" tone={changed ? 'accent' : 'muted'}>
          {laundryAfterLabel(value)}
          {changed ? ' · changed' : ''}
        </Text>
      </View>
      <IconButton
        icon={Minus}
        variant="tinted"
        accessibilityLabel={`Fewer wears for ${CATEGORY_LABEL[category]}`}
        disabled={at <= 0}
        style={{ opacity: at <= 0 ? 0.35 : 1 }}
        onPress={() => step(-1)}
      />
      <IconButton
        icon={Plus}
        variant="tinted"
        accessibilityLabel={`More wears for ${CATEGORY_LABEL[category]}`}
        disabled={at >= AUTO_LAUNDRY_STEPS.length - 1}
        style={{ opacity: at >= AUTO_LAUNDRY_STEPS.length - 1 ? 0.35 : 1 }}
        onPress={() => step(1)}
      />
    </View>
  );
}

/**
 * Me → Settings → Auto-laundry: per category, after how many wears a logged
 * piece goes straight to the basket ("Never" keeps it on the hanger).
 */
export function AutoLaundrySheet({ ref }: { ref: RefObject<SheetRef | null> }) {
  const reset = usePreferences((s) => s.resetAutoLaundry);
  return (
    <Sheet ref={ref} eyebrow="Settings" title="Auto-laundry" snapPoints={['85%']} scrollable>
      <Text variant="bodySm" tone="muted">
        When you log a wear, a piece that’s been worn this many times since its last wash goes straight to the basket.
      </Text>
      <View className="mt-3">
        {CATEGORIES.map((c) => (
          <Stepper key={c} category={c} />
        ))}
      </View>
      <Button
        label="Back to the defaults"
        icon={RotateCcw}
        variant="secondary"
        fullWidth
        className="mt-5"
        onPress={reset}
      />
    </Sheet>
  );
}

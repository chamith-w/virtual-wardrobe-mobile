import { View } from 'react-native';

import { Chip } from '@/components/ui';
import { STATUS_LABEL, type ItemStatus } from '@/features/items/catalog';
import { STATUS_TONE, SWITCHABLE_STATUSES } from '@/features/items/status';
import { useTheme } from '@/theme/ThemeProvider';

/** Wrap of status chips: In wardrobe / Worn / In laundry / Dry cleaner / Lent / In storage. */
export function StatusSwitcher({ status, onChange }: { status: ItemStatus; onChange: (next: ItemStatus) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Status" className="flex-row flex-wrap gap-2">
      {SWITCHABLE_STATUSES.map((s) => (
        <Chip
          key={s}
          label={STATUS_LABEL[s]}
          dotColor={colors[STATUS_TONE[s]]}
          selected={s === status}
          accessibilityRole="radio"
          haptic="none"
          onPress={() => {
            if (s !== status) onChange(s);
          }}
        />
      ))}
    </View>
  );
}

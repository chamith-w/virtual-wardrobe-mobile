import { View } from 'react-native';

import { Chip } from '@/components/ui';
import { STATUS_LABEL, type ItemStatus } from '@/features/items/catalog';
import { STATUS_TONE, SWITCHABLE_STATUSES } from '@/features/items/status';
import { refusalMessage, transitionRefusal } from '@/features/items/transitions';
import { useTheme } from '@/theme/ThemeProvider';

type SwitchItem = { name: string; status: ItemStatus; lentTo: string | null };

/**
 * Wrap of status chips: In wardrobe / Worn / In laundry / Dry cleaner / Lent / In storage.
 * Moves the transition table refuses (wearing what's in the wash…) are dimmed;
 * tapping one still calls `onChange`, which explains why.
 */
export function StatusSwitcher({ item, onChange }: { item: SwitchItem; onChange: (next: ItemStatus) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Status" className="flex-row flex-wrap gap-2">
      {SWITCHABLE_STATUSES.map((s) => {
        const selected = s === item.status;
        const refusal = selected ? null : transitionRefusal(item.status, s);
        return (
          <Chip
            key={s}
            label={STATUS_LABEL[s]}
            dotColor={colors[STATUS_TONE[s]]}
            selected={selected}
            accessibilityRole="radio"
            accessibilityHint={refusal ? refusalMessage(refusal, item, s) : undefined}
            className={refusal ? 'opacity-40' : undefined}
            haptic="none"
            onPress={() => {
              if (!selected) onChange(s);
            }}
          />
        );
      })}
    </View>
  );
}

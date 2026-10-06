import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { setLentTo } from '@/features/items/mutations';
import { formatShortDay } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

/**
 * Who has a lent piece and since when. The name saves when the field loses
 * focus. Key it by item id so paging resets the draft.
 */
export function LentCard({
  item,
  inSheet = false,
}: {
  item: { id: string; lentTo: string | null; lentAt: Date | null };
  /** Inside a bottom sheet the field must be the sheet-aware input for keyboard handling. */
  inSheet?: boolean;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(item.lentTo ?? '');
  const Input = inSheet ? BottomSheetTextInput : TextInput;
  const save = () => {
    if (name.trim() !== (item.lentTo ?? '')) setLentTo(item.id, name);
  };

  return (
    <View className="mt-3 gap-2.5 rounded-md bg-accent-soft p-3.5">
      <View className="flex-row items-center gap-2.5">
        <Text variant="bodySm" weight="semibold">
          Lent to
        </Text>
        <Input
          value={name}
          onChangeText={setName}
          onBlur={save}
          onSubmitEditing={save}
          placeholder="Who has it?"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          returnKeyType="done"
          autoCapitalize="words"
          accessibilityLabel="Lent to"
          maxFontSizeMultiplier={1.5}
          style={{
            flex: 1,
            minWidth: 0,
            height: 44,
            borderRadius: 12,
            paddingHorizontal: 12,
            backgroundColor: colors.surface,
            fontFamily: fontFamily.sansMedium,
            fontSize: 15,
            color: colors.ink,
          }}
        />
      </View>
      <Text variant="caption" weight="semibold" tone="ink">
        Since {item.lentAt ? formatShortDay(item.lentAt) : 'today'}
      </Text>
    </View>
  );
}

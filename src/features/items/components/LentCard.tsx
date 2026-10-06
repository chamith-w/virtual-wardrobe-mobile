import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { renameBorrower } from '@/features/items/statusService';
import { LENT_TO_MAX } from '@/features/items/status';
import { lentAge } from '@/features/laundry/copy';
import { formatShortDay } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

import { LendReminderRow, type LentPiece } from './LendReminder';

/**
 * Who has a lent piece, since when, and the "ask for it back" reminder. The
 * name saves when the field loses focus. Key it by item id so paging resets
 * the draft.
 */
export function LentCard({
  item,
  inSheet = false,
}: {
  item: LentPiece;
  /** Inside a bottom sheet the field must be the sheet-aware input for keyboard handling. */
  inSheet?: boolean;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(item.lentTo ?? '');
  const Input = inSheet ? BottomSheetTextInput : TextInput;
  const save = () => {
    if (name.trim() !== (item.lentTo ?? '')) renameBorrower(item, name);
  };
  const age = lentAge(item.lentAt, null, new Date());

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
          maxLength={LENT_TO_MAX}
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
      <Text variant="caption" weight="semibold" tone={age.overdue ? 'accent' : 'ink'}>
        {item.lentAt && age.days > 0 ? `Since ${formatShortDay(item.lentAt)} · ${age.line}` : 'Since today'}
      </Text>
      <LendReminderRow item={item} onSurface />
    </View>
  );
}

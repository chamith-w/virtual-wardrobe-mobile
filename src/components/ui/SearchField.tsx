import { Search, X } from 'lucide-react-native';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

import { AnimatedPressable } from './AnimatedPressable';

export type SearchFieldProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  className?: string;
};

/** Pill search input with a leading magnifier and a clear button once there is text. */
export function SearchField({ value, onChangeText, accessibilityLabel, className, ...rest }: SearchFieldProps) {
  const { colors } = useTheme();
  return (
    <View
      className={['h-11 flex-row items-center gap-2 rounded-pill border border-line bg-surface pl-3.5', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Search size={18} color={colors.muted} strokeWidth={1.9} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={accessibilityLabel}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        maxFontSizeMultiplier={1.5}
        style={{ flex: 1, minWidth: 0, height: 44, fontFamily: fontFamily.sans, fontSize: 15, color: colors.ink }}
        {...rest}
      />
      {value.length > 0 ? (
        <AnimatedPressable
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          scaleTo={0.88}
          className="h-11 w-11 items-center justify-center"
        >
          <View className="h-5 w-5 items-center justify-center rounded-pill bg-faint">
            <X size={12} color={colors.surface} strokeWidth={3} />
          </View>
        </AnimatedPressable>
      ) : (
        <View className="w-2.5" />
      )}
    </View>
  );
}

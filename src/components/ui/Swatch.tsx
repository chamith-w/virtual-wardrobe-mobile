import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AnimatedPressable } from './AnimatedPressable';
import { Text } from './Text';

export type SwatchProps = {
  hex: string;
  /** Colour name — used as the accessible label and optional caption. */
  name: string;
  size?: number;
  selected?: boolean;
  showLabel?: boolean;
  onPress?: () => void;
};

/** A colour dot with a hairline edge so whites and creams read on any surface. */
export function Swatch({ hex, name, size = 28, selected = false, showLabel = false, onPress }: SwatchProps) {
  const { colors } = useTheme();
  const ring = size + 10;
  const dot = (
    <View
      className="items-center justify-center rounded-pill"
      style={{
        width: ring,
        height: ring,
        borderWidth: 2,
        borderColor: selected ? colors.ink : 'transparent',
      }}
    >
      <View
        className="rounded-pill border border-line-strong"
        style={{ width: size, height: size, backgroundColor: hex }}
      />
    </View>
  );

  const content = (
    <View className="items-center gap-1">
      {dot}
      {showLabel ? (
        <Text variant="caption" tone={selected ? 'ink' : 'muted'} weight="medium">
          {name}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={name}>
        {content}
      </View>
    );
  }

  return (
    <AnimatedPressable
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      scaleTo={0.9}
    >
      {content}
    </AnimatedPressable>
  );
}

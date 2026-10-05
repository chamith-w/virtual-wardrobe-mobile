import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AnimatedPressable, type AnimatedPressableProps } from './AnimatedPressable';
import { Text } from './Text';

export type ChipProps = Omit<AnimatedPressableProps, 'children'> & {
  label: string;
  selected?: boolean;
  /** Small colour dot, e.g. a status. */
  dotColor?: string;
  /** Larger colour swatch, e.g. a garment colour. */
  swatch?: string;
  icon?: LucideIcon;
  count?: number;
};

/** Pill chip for filters, tags and quick-pick forms. Selected chips invert to ink. */
export function Chip({ label, selected = false, dotColor, swatch, icon: Icon, count, className, ...rest }: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? colors.onInverse : colors.ink;
  return (
    <AnimatedPressable
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      className={[
        'h-9 flex-row items-center gap-1.5 self-start rounded-pill px-3.5',
        selected ? 'bg-inverse' : 'border border-line-strong bg-surface',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {swatch ? <View className="h-4 w-4 rounded-pill border border-line" style={{ backgroundColor: swatch }} /> : null}
      {dotColor ? <View className="h-2 w-2 rounded-pill" style={{ backgroundColor: dotColor }} /> : null}
      {Icon ? <Icon size={15} color={fg} strokeWidth={2} /> : null}
      <Text variant="bodySm" weight="medium" tone={selected ? 'onInverse' : 'ink'} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" weight="semibold" tone={selected ? 'onInverse' : 'muted'}>
          {count}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

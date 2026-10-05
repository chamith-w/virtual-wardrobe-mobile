import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from './Text';

/**
 * Section title row with an optional trailing action or meta text.
 * `size="sm"` is the tighter 18pt variant used between closet zones.
 */
export function SectionHeader({
  title,
  meta,
  action,
  size = 'md',
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  size?: 'md' | 'sm';
}) {
  return (
    <View
      className={['flex-row items-end justify-between', size === 'sm' ? 'pb-2.5 pt-[22px]' : 'pb-2.5 pt-7'].join(
        ' ',
      )}
    >
      <Text variant={size === 'sm' ? 'title2' : 'title1'} accessibilityRole="header">
        {title}
      </Text>
      {action ?? (meta ? <Text variant="caption">{meta}</Text> : null)}
    </View>
  );
}

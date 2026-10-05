import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { AnimatedPressable, type AnimatedPressableProps } from './AnimatedPressable';

export type CardTone = 'surface' | 'tinted' | 'inverse' | 'accentSoft' | 'secondary' | 'secondarySoft';

const toneClass: Record<CardTone, string> = {
  surface: 'bg-surface border border-line',
  tinted: 'bg-surface-tinted',
  inverse: 'bg-inverse',
  accentSoft: 'bg-accent-soft',
  secondary: 'bg-accent-secondary',
  secondarySoft: 'bg-accent-secondary-soft',
};

type BaseProps = {
  tone?: CardTone;
  radius?: 'md' | 'lg';
  padded?: boolean;
  className?: string;
  children?: ReactNode;
};

type StaticCardProps = BaseProps & Omit<ViewProps, 'children'> & { onPress?: undefined };
type PressableCardProps = BaseProps &
  Omit<AnimatedPressableProps, 'children'> & { onPress: AnimatedPressableProps['onPress'] };

function cardClass({ tone = 'surface', radius = 'md', padded = true, className }: BaseProps) {
  return [
    'overflow-hidden',
    radius === 'lg' ? 'rounded-lg' : 'rounded-md',
    toneClass[tone],
    padded ? 'p-4' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Rounded content container. Pass `onPress` to make the whole card tappable. */
export function Card(props: StaticCardProps | PressableCardProps) {
  if (props.onPress) {
    const { tone, radius, padded, className, ...rest } = props as PressableCardProps;
    return <AnimatedPressable scaleTo={0.98} className={cardClass({ tone, radius, padded, className })} {...rest} />;
  }
  const { tone, radius, padded, className, ...rest } = props as StaticCardProps;
  return <View className={cardClass({ tone, radius, padded, className })} {...rest} />;
}

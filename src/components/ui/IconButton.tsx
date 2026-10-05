import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorToken } from '@/theme/tokens';

import { AnimatedPressable, type AnimatedPressableProps } from './AnimatedPressable';

export type IconButtonVariant = 'surface' | 'tinted' | 'inverse' | 'accent' | 'ghost' | 'glass';

export type IconButtonProps = Omit<AnimatedPressableProps, 'children'> & {
  icon: LucideIcon;
  /** Required: icon-only controls must be named for VoiceOver/TalkBack. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: number;
  iconSize?: number;
};

const variantClass: Record<IconButtonVariant, string> = {
  surface: 'bg-surface border border-line',
  tinted: 'bg-surface-tinted',
  inverse: 'bg-inverse',
  accent: 'bg-accent-strong',
  ghost: 'bg-transparent',
  /** Translucent surface for controls floating over imagery (item detail). */
  glass: 'bg-surface/80 border border-line',
};

const iconColor: Record<IconButtonVariant, ColorToken> = {
  surface: 'ink',
  tinted: 'ink',
  inverse: 'onInverse',
  accent: 'onAccent',
  ghost: 'ink',
  glass: 'ink',
};

/** Circular icon button, 44pt by default. */
export function IconButton({
  icon: Icon,
  variant = 'surface',
  size = 44,
  iconSize = 20,
  className,
  style,
  ...rest
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      className={['items-center justify-center', variantClass[variant], className].filter(Boolean).join(' ')}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      {...rest}
    >
      <Icon size={iconSize} color={colors[iconColor[variant]]} strokeWidth={1.9} />
    </AnimatedPressable>
  );
}

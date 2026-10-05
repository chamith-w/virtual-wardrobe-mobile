import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorToken } from '@/theme/tokens';

import { AnimatedPressable, type AnimatedPressableProps } from './AnimatedPressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = Omit<AnimatedPressableProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'leading' | 'trailing';
  fullWidth?: boolean;
};

const containerClass: Record<ButtonVariant, string> = {
  primary: 'bg-inverse',
  accent: 'bg-accent-strong',
  secondary: 'bg-transparent border-[1.5px] border-line-strong',
  ghost: 'bg-transparent',
  danger: 'bg-danger-soft',
};

const labelTone = {
  primary: 'onInverse',
  accent: 'onAccent',
  secondary: 'ink',
  ghost: 'ink',
  danger: 'danger',
} as const;

const iconToken: Record<ButtonVariant, ColorToken> = {
  primary: 'onInverse',
  accent: 'onAccent',
  secondary: 'ink',
  ghost: 'ink',
  danger: 'danger',
};

/** Pill button. Primary (ink) is the default; accent is reserved for the one key action on a screen. */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'leading',
  fullWidth = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const height = size === 'md' ? 'h-[52px] px-6' : 'h-11 px-4';
  const iconSize = size === 'md' ? 19 : 17;
  const iconNode = Icon ? <Icon size={iconSize} color={colors[iconToken[variant]]} strokeWidth={2} /> : null;

  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      haptic={variant === 'ghost' ? 'tap' : 'press'}
      className={[
        'flex-row items-center justify-center gap-2 rounded-pill',
        height,
        containerClass[variant],
        fullWidth ? 'self-stretch' : 'self-start',
        disabled ? 'opacity-40' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {iconPosition === 'leading' ? iconNode : null}
      <Text variant={size === 'md' ? 'body' : 'bodySm'} weight="semibold" tone={labelTone[variant]}>
        {label}
      </Text>
      {iconPosition === 'trailing' ? iconNode : null}
    </AnimatedPressable>
  );
}

import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import type { TypeVariant } from '@/theme/tokens';

export type TextTone =
  | 'ink'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'accentSecondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'onAccent'
  | 'onAccentSecondary'
  | 'onInverse'
  | 'inherit';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Sans variants only. */
  weight?: Weight;
  /** Display variants only — Fraunces italic. */
  italic?: boolean;
  className?: string;
};

const sizeClass: Record<TypeVariant, string> = {
  display1: 'text-display1',
  display2: 'text-display2',
  display3: 'text-display3',
  title1: 'text-title1',
  title2: 'text-title2',
  body: 'text-body',
  bodySm: 'text-body-sm',
  caption: 'text-caption',
  eyebrow: 'text-eyebrow uppercase',
};

const toneClass: Record<TextTone, string> = {
  ink: 'text-ink',
  muted: 'text-muted',
  faint: 'text-faint',
  accent: 'text-accent-text',
  accentSecondary: 'text-accent-secondary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  onAccent: 'text-on-accent',
  onAccentSecondary: 'text-on-accent-secondary',
  onInverse: 'text-on-inverse',
  inherit: '',
};

const sansWeightClass: Record<Weight, string> = {
  regular: 'font-sans',
  medium: 'font-sans-medium',
  semibold: 'font-sans-semibold',
  bold: 'font-sans-bold',
};

const isDisplay = (v: TypeVariant) => v === 'display1' || v === 'display2' || v === 'display3';

function familyClass(variant: TypeVariant, weight: Weight | undefined, italic: boolean): string {
  if (isDisplay(variant)) return italic ? 'font-display-italic' : 'font-display';
  if (weight) return sansWeightClass[weight];
  if (variant === 'title1' || variant === 'title2' || variant === 'eyebrow') return 'font-sans-semibold';
  return 'font-sans';
}

/**
 * Typography primitive. Display sizes use Fraunces; everything else DM Sans.
 * Dynamic Type is on — display sizes are capped so headlines never explode
 * the layout.
 */
export function Text({
  variant = 'body',
  tone,
  weight,
  italic = false,
  className,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const resolvedTone: TextTone = tone ?? (variant === 'eyebrow' || variant === 'caption' ? 'muted' : 'ink');
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (isDisplay(variant) ? 1.3 : 1.8)}
      className={[familyClass(variant, weight, italic), sizeClass[variant], toneClass[resolvedTone], className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}

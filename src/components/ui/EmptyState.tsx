import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { BasketGlyph, GhostFoldGlyph, HangerGlyph } from '@/components/illustrations/Glyphs';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Text } from './Text';

export type EmptyIllustration = 'hanger' | 'basket' | 'shelf';

export type EmptyStateProps = {
  title: string;
  body?: string;
  illustration?: EmptyIllustration | ReactNode;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  /** Dashed-outline variant for inline slots (e.g. an empty rail). */
  outlined?: boolean;
};

function Illustration({ kind }: { kind: EmptyIllustration }) {
  const { colors } = useTheme();
  if (kind === 'basket') return <BasketGlyph width={96} color={colors.faint} />;
  if (kind === 'shelf') {
    return (
      <View className="items-center">
        <GhostFoldGlyph width={88} color={colors.faint} />
        <View className="mt-1 h-2 w-32 rounded-pill" style={{ backgroundColor: colors.surfaceTintedStrong }} />
      </View>
    );
  }
  return (
    <View className="h-14 w-36 items-center">
      <View className="absolute left-0 right-0 top-1.5 h-[3px] rounded-pill" style={{ backgroundColor: colors.rail }} />
      <HangerGlyph width={64} color={colors.faint} />
    </View>
  );
}

/**
 * Every empty screen gets a composition and a clear next step — never a blank
 * page. Pass a custom node as `illustration` for bespoke artwork.
 */
export function EmptyState({
  title,
  body,
  illustration = 'hanger',
  actionLabel,
  actionIcon,
  onAction,
  outlined = false,
}: EmptyStateProps) {
  const art =
    typeof illustration === 'string' ? <Illustration kind={illustration as EmptyIllustration} /> : illustration;

  return (
    <View
      className={[
        'items-center gap-3 rounded-lg px-6 py-8',
        outlined ? 'border-[1.5px] border-dashed border-line-strong' : 'bg-surface-tinted',
      ].join(' ')}
    >
      {art}
      <Text variant="display3" className="text-center" style={{ fontSize: 22, lineHeight: 27 }}>
        {title}
      </Text>
      {body ? (
        <Text variant="bodySm" tone="muted" className="text-center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} icon={actionIcon} size="sm" onPress={onAction} className="mt-1 self-center" />
      ) : null}
    </View>
  );
}

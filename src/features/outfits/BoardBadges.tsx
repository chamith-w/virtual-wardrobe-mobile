import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { PopIn, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/** A small pill over a board (Today.dc.html `.tag`): "Fits 24°", an outfit's name. */
export function BoardTag({ label }: { label: string }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      className="h-6 flex-row items-center rounded-pill border border-line bg-surface px-2.5"
      style={{
        shadowColor: colors.shadow,
        shadowOpacity: scheme === 'dark' ? 0.4 : 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Text variant="caption" weight="semibold" style={{ fontSize: 11, lineHeight: 14 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** "Worn today" / "Logged" on a board's corner; it pops in. */
export function WornBadge({ label = 'Worn today' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <PopIn from={0.55} tilt={-8}>
      <View className="h-7 flex-row items-center gap-1 rounded-pill bg-success pl-2 pr-3">
        <Check size={15} strokeWidth={2.6} color={colors.background} />
        <Text variant="caption" weight="bold" style={{ color: colors.background }}>
          {label}
        </Text>
      </View>
    </PopIn>
  );
}

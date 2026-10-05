import { router } from 'expo-router';
import { Clock, Moon, Repeat2, Sun, WashingMachine } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card, EmptyState, IconButton, Screen, Skeleton, Text } from '@/components/ui';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useForgottenCount, useStatusCounts } from '@/features/wardrobe/useWardrobeSummary';
import { formatLongDay, greetingFor } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

function Tile({
  value,
  label,
  icon,
  tint,
  onPress,
}: {
  value: number;
  label: string;
  icon: ReactNode;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${value} ${label}`} className="flex-1 gap-3" padded>
      <View className="h-9 w-9 items-center justify-center rounded-pill" style={{ backgroundColor: tint }}>
        {icon}
      </View>
      <View>
        <Text variant="display3" style={{ fontSize: 30, lineHeight: 32 }}>
          {value}
        </Text>
        <Text variant="caption" weight="semibold" className="mt-1">
          {label}
        </Text>
      </View>
    </Card>
  );
}

export default function TodayScreen() {
  const { colors, isDark, setPreference } = useTheme();
  const counts = useStatusCounts();
  const forgotten = useForgottenCount(90);
  const now = new Date();

  return (
    <Screen className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <Text variant="display3" italic tone="muted" style={{ fontSize: 20, lineHeight: 24 }}>
          {formatLongDay(now)}
        </Text>
        <IconButton
          icon={isDark ? Sun : Moon}
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={() => setPreference(isDark ? 'light' : 'dark')}
        />
      </View>
      <Text variant="display1" accessibilityRole="header" className="mt-2">
        {greetingFor(now)}.
      </Text>

      <Card tone="secondary" radius="lg" className="mt-5 gap-3 p-5">
        <Text variant="eyebrow" tone="onAccentSecondary" className="opacity-80">
          Weather · arrives in phase 6
        </Text>
        <Skeleton width={120} height={44} radius={14} />
        <Skeleton width="70%" height={12} radius={6} />
      </Card>

      <SectionHeader title="Today’s outfit" />
      <EmptyState
        title="Suggestions are on their way"
        body={`The weather-aware engine lands in phase 6. ${counts.inWardrobe} pieces are clean and ready for it.`}
        actionLabel="Browse the wardrobe"
        onAction={() => router.navigate('/wardrobe')}
      />

      <View className="mt-4 flex-row gap-2.5">
        <Tile
          value={counts.laundry}
          label="In laundry"
          tint={colors.accentSecondarySoft}
          icon={<WashingMachine size={19} color={colors.accentSecondary} strokeWidth={1.8} />}
          onPress={() => router.navigate('/me')}
        />
        <Tile
          value={counts.lent}
          label="Lent out"
          tint={colors.accentSoft}
          icon={<Repeat2 size={19} color={colors.accentText} strokeWidth={1.8} />}
          onPress={() => router.navigate('/me')}
        />
        <Tile
          value={forgotten}
          label="Forgotten"
          tint={colors.warningSoft}
          icon={<Clock size={19} color={colors.warning} strokeWidth={1.8} />}
          onPress={() => router.navigate('/me')}
        />
      </View>
    </Screen>
  );
}

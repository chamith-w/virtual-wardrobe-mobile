import { Luggage } from 'lucide-react-native';
import { View } from 'react-native';

import { AnimatedPressable, Text } from '@/components/ui';
import type { TripSummary } from '@/features/planner/usePlannerData';
import { daysBetween, fromDayKey } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

/** "in 11 days", "tomorrow", "today", "now". */
export function tripWhen(trip: Pick<TripSummary, 'startDate' | 'endDate'>, today: Date): string {
  const days = daysBetween(today, fromDayKey(trip.startDate));
  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  return 'now';
}

/** The next trip with its packing progress (Today.dc.html). */
export function TripCard({ trip, today, onPress }: { trip: TripSummary; today: Date; onPress: () => void }) {
  const { colors } = useTheme();
  const share = trip.total > 0 ? trip.packed / trip.total : 0;
  const when = tripWhen(trip, today);
  return (
    <AnimatedPressable
      accessibilityLabel={`${trip.name}, ${when}. ${trip.packed} of ${trip.total} packed`}
      accessibilityHint="Opens the trip in the planner"
      onPress={onPress}
      scaleTo={0.98}
      className="flex-row items-center gap-3.5 rounded-[24px] border border-line bg-surface px-4 py-3.5"
    >
      <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-surface-tinted">
        <Luggage size={21} color={colors.ink} strokeWidth={1.8} />
      </View>
      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text variant="bodySm" weight="semibold" numberOfLines={1} className="flex-1">
            {trip.name} · {when}
          </Text>
          <Text variant="caption">
            {trip.packed} of {trip.total} packed
          </Text>
        </View>
        <View className="h-1.5 overflow-hidden rounded-pill bg-surface-tinted">
          <View className="h-full rounded-pill bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

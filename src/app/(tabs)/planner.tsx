import { asc, eq, gte, isNull, and } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { View } from 'react-native';

import { Card, EmptyState, Screen, Text } from '@/components/ui';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { db } from '@/db/client';
import { outfits, plannedOutfits } from '@/db/schema';
import { fromDayKey, toDayKey } from '@/lib/dates';

/** Phase 1: upcoming plans from SQLite. The week strip / month calendar and drag-to-plan are phase 6. */
export default function PlannerScreen() {
  const today = toDayKey(new Date());
  const { data: upcoming } = useLiveQuery(
    db
      .select({ id: plannedOutfits.id, date: plannedOutfits.date, name: outfits.name, occasion: outfits.occasion })
      .from(plannedOutfits)
      .innerJoin(outfits, and(eq(outfits.id, plannedOutfits.outfitId), isNull(outfits.deletedAt)))
      .where(and(gte(plannedOutfits.date, today), isNull(plannedOutfits.deletedAt)))
      .orderBy(asc(plannedOutfits.date)),
    [today],
  );

  return (
    <Screen className="px-5">
      <Text variant="eyebrow" className="mt-2">
        Planner
      </Text>
      <Text variant="display1" accessibilityRole="header" className="mt-2">
        {new Date().toLocaleDateString(undefined, { month: 'long' })}
      </Text>

      <SectionHeader title="Coming up" meta={`${upcoming.length} planned`} />
      {upcoming.length === 0 ? (
        <EmptyState title="Nothing planned yet" body="Drag an outfit onto a day, or let the planner suggest one." />
      ) : (
        <View className="gap-2.5">
          {upcoming.map((p) => {
            const d = fromDayKey(p.date);
            return (
              <Card key={p.id} className="flex-row items-center gap-4">
                <View className="w-12 items-center">
                  <Text variant="caption" weight="semibold">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text variant="display3">{d.getDate()}</Text>
                </View>
                <View className="flex-1">
                  <Text variant="title2">{p.name}</Text>
                  <Text variant="caption" className="mt-0.5 capitalize">
                    {p.occasion ?? 'Any occasion'}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <View className="mt-6">
        <EmptyState
          illustration="hanger"
          title="Calendar arrives in phase 6"
          body="Week strip, month view, drag-to-plan and wear logging with the day’s weather."
        />
      </View>
    </Screen>
  );
}

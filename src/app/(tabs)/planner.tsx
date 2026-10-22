import { useLocalSearchParams } from 'expo-router';

import { PlannerScreen } from '@/features/planner/PlannerScreen';

/** The Planner (Planner.dc.html). `?day=YYYY-MM-DD` opens on that day (Today's trip card, the evening reminder). */
export default function PlannerRoute() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const initial = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
  // Opened again for another day: start over on it.
  return <PlannerScreen key={initial ?? 'today'} initialDay={initial} />;
}

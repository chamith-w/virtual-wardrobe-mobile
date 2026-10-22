import { useEffect } from 'react';

import { addDays, toDayKey } from '@/lib/dates';
import { usePreferences } from '@/store/preferences';
import { useCurrentDay } from '@/features/today/useCurrentDay';

import { PLAN_REMINDER_EVENINGS, syncPlanReminders } from './planReminder';
import { usePlans } from './usePlannerData';

/**
 * Keeps the evening "plan tomorrow" reminders in step with the plans: mounted
 * once in the root layout, it reschedules the coming week whenever a plan,
 * the setting or the day changes.
 */
export function usePlanReminderSync() {
  const enabled = usePreferences((s) => s.planReminder);
  const now = useCurrentDay();
  const { plans, loaded } = usePlans(toDayKey(now), toDayKey(addDays(now, PLAN_REMINDER_EVENINGS + 1)));
  const key = [...plans.keys()].sort().join(',');

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void syncPlanReminders(enabled, new Set(key ? key.split(',') : []));
    }, 600);
    return () => clearTimeout(timer);
  }, [enabled, key, loaded, now]);
}

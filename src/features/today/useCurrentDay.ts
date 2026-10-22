import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toDayKey } from '@/lib/dates';

/**
 * The current moment, kept stable for the day: it only changes when the
 * calendar day does (checked each minute and on returning to the app), so
 * screens can memoise on it.
 */
export function useCurrentDay(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const check = () => setNow((prev) => (toDayKey(prev) === toDayKey(new Date()) ? prev : new Date()));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const timer = setInterval(check, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return now;
}

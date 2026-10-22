import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';

import { forecastMatches, useWeatherStore } from './store';

/**
 * The weather for the chosen place, refreshed whenever the screen comes into
 * view or the app returns to the foreground (a no-op while the cache is
 * fresh). `forecast` is the cached one until a newer arrives, even offline.
 */
export function useWeather() {
  const place = usePreferences((s) => s.weatherPlace);
  const cached = useWeatherStore((s) => s.forecast);
  const loading = useWeatherStore((s) => s.loading);
  const error = useWeatherStore((s) => s.error);
  const override = useSession((s) => s.weatherOverride);

  useFocusEffect(
    useCallback(() => {
      if (place) void useWeatherStore.getState().refresh();
    }, [place]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useWeatherStore.getState().refresh();
    });
    return () => sub.remove();
  }, []);

  return { place, forecast: forecastMatches(place, cached) ? cached : null, loading, error, override };
}

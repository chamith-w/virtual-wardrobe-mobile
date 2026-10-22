/**
 * The weather: one forecast for wherever the user is (or the city they
 * picked), cached in the kv-store so it shows instantly and offline.
 * `refresh()` is cheap to call: it does nothing while the cache is fresh.
 */
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

import type { WeatherSnapshot } from '@/db/schema';
import { toDayKey, type DayKey } from '@/lib/dates';
import { usePreferences, type WeatherPlacePreference } from '@/store/preferences';

import { isStale, snapshotForDay } from './forecast';
import { devicePlace, LocationUnavailable } from './location';
import { fetchForecast } from './openMeteo';
import type { Forecast, Place } from './types';

const CACHE_KEY = 'my-closet.weather';

export type WeatherError = 'denied' | 'blocked' | 'services_off' | 'offline';

type WeatherState = {
  forecast: Forecast | null;
  loading: boolean;
  /** Why the last refresh failed (the cached forecast, if any, stays). */
  error: WeatherError | null;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  clear: () => void;
};

function readCache(): Forecast | null {
  try {
    const raw = Storage.getItemSync(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Forecast) : null;
  } catch {
    return null;
  }
}

function writeCache(forecast: Forecast | null) {
  try {
    if (forecast) Storage.setItemSync(CACHE_KEY, JSON.stringify(forecast));
    else Storage.removeItemSync(CACHE_KEY);
  } catch {
    // A cache miss next launch is harmless.
  }
}

/** Whether a cached forecast belongs to the place the user chose. */
export function forecastMatches(pref: WeatherPlacePreference | null, forecast: Forecast | null): boolean {
  if (!pref || !forecast) return false;
  if (pref.kind === 'device') return forecast.place.source === 'device';
  return (
    forecast.place.source === 'city' &&
    Math.abs(forecast.place.latitude - pref.latitude) < 0.01 &&
    Math.abs(forecast.place.longitude - pref.longitude) < 0.01
  );
}

async function resolvePlace(pref: WeatherPlacePreference): Promise<Place> {
  if (pref.kind === 'city')
    return { name: pref.name, latitude: pref.latitude, longitude: pref.longitude, source: 'city' };
  return devicePlace();
}

let inflight: Promise<void> | null = null;

export const useWeatherStore = create<WeatherState>()((set, get) => ({
  forecast: readCache(),
  loading: false,
  error: null,
  refresh: ({ force = false } = {}) => {
    const pref = usePreferences.getState().weatherPlace;
    if (!pref) return Promise.resolve();
    const { forecast } = get();
    if (!force && forecastMatches(pref, forecast) && forecast && !isStale(forecast, Date.now()))
      return Promise.resolve();
    if (inflight) return inflight;
    set({ loading: true });
    inflight = (async () => {
      try {
        const next = await fetchForecast(await resolvePlace(pref));
        // The user may have picked another place while this was in flight.
        if (forecastMatches(usePreferences.getState().weatherPlace, next)) {
          writeCache(next);
          set({ forecast: next, error: null });
        }
      } catch (e) {
        set({ error: e instanceof LocationUnavailable ? e.reason : 'offline' });
      } finally {
        set({ loading: false });
        inflight = null;
      }
    })();
    return inflight;
  },
  clear: () => {
    writeCache(null);
    set({ forecast: null, error: null });
  },
}));

/** The weather a wear log for `day` should carry, from the cached forecast for the chosen place. */
export function weatherSnapshotFor(day: DayKey, now = new Date()): WeatherSnapshot | null {
  const { forecast } = useWeatherStore.getState();
  if (!forecastMatches(usePreferences.getState().weatherPlace, forecast)) return null;
  return snapshotForDay(forecast, day, toDayKey(now));
}

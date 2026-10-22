import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { Category } from '@/features/items/catalog';

export type ThemePreference = 'system' | 'light' | 'dark';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

/**
 * Where the weather comes from. Null until the user has answered the
 * explainer card the first time weather is shown.
 */
export type WeatherPlacePreference =
  { kind: 'device' } | { kind: 'city'; name: string; latitude: number; longitude: number };

/** Per-category "move to laundry after N wears": a number, or null for never. Missing = the default. */
export type AutoLaundryOverrides = Partial<Record<Category, number | null>>;

type PreferencesState = {
  theme: ThemePreference;
  /** User override on top of the OS "Reduce Motion" setting. */
  reduceMotion: boolean;
  currency: string;
  temperatureUnit: TemperatureUnit;
  weatherPlace: WeatherPlacePreference | null;
  autoLaundry: AutoLaundryOverrides;
  /** An evening nudge when tomorrow has nothing planned. */
  planReminder: boolean;
  setTheme: (theme: ThemePreference) => void;
  setReduceMotion: (value: boolean) => void;
  setCurrency: (currency: string) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setWeatherPlace: (place: WeatherPlacePreference | null) => void;
  setAutoLaundry: (category: Category, wears: number | null) => void;
  resetAutoLaundry: () => void;
  setPlanReminder: (on: boolean) => void;
};

/**
 * Synchronous kv-store adapter so preferences hydrate before the first frame —
 * no flash of the wrong theme on launch.
 */
const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      reduceMotion: false,
      currency: 'USD',
      temperatureUnit: 'celsius',
      weatherPlace: null,
      autoLaundry: {},
      planReminder: false,
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setCurrency: (currency) => set({ currency }),
      setTemperatureUnit: (temperatureUnit) => set({ temperatureUnit }),
      setWeatherPlace: (weatherPlace) => set({ weatherPlace }),
      setAutoLaundry: (category, wears) => set((s) => ({ autoLaundry: { ...s.autoLaundry, [category]: wears } })),
      resetAutoLaundry: () => set({ autoLaundry: {} }),
      setPlanReminder: (planReminder) => set({ planReminder }),
    }),
    {
      name: 'my-closet.preferences',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
    },
  ),
);

import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

type PreferencesState = {
  theme: ThemePreference;
  /** User override on top of the OS "Reduce Motion" setting. */
  reduceMotion: boolean;
  currency: string;
  temperatureUnit: TemperatureUnit;
  setTheme: (theme: ThemePreference) => void;
  setReduceMotion: (value: boolean) => void;
  setCurrency: (currency: string) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
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
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setCurrency: (currency) => set({ currency }),
      setTemperatureUnit: (temperatureUnit) => set({ temperatureUnit }),
    }),
    {
      name: 'my-closet.preferences',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
    },
  ),
);

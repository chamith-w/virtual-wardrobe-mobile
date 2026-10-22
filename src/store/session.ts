import { create } from 'zustand';

/** Development only: pretend it's this cold (or wet) to see suggestions change. */
export type WeatherOverride = { feelsLikeC: number; rain: boolean };

/** Ephemeral UI state that resets every app launch. */
type SessionState = {
  /** The wardrobe doors play once per session (signature moment #1). */
  wardrobeDoorsPlayed: boolean;
  activeWardrobeId: string | null;
  weatherOverride: WeatherOverride | null;
  markWardrobeDoorsPlayed: () => void;
  setActiveWardrobe: (id: string) => void;
  setWeatherOverride: (override: WeatherOverride | null) => void;
};

export const useSession = create<SessionState>()((set) => ({
  wardrobeDoorsPlayed: false,
  activeWardrobeId: null,
  weatherOverride: null,
  markWardrobeDoorsPlayed: () => set({ wardrobeDoorsPlayed: true }),
  setActiveWardrobe: (activeWardrobeId) => set({ activeWardrobeId }),
  setWeatherOverride: (weatherOverride) => set({ weatherOverride }),
}));

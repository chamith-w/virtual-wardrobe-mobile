import { create } from 'zustand';

/** Ephemeral UI state that resets every app launch. */
type SessionState = {
  /** The wardrobe doors play once per session (signature moment #1). */
  wardrobeDoorsPlayed: boolean;
  activeWardrobeId: string | null;
  markWardrobeDoorsPlayed: () => void;
  setActiveWardrobe: (id: string) => void;
};

export const useSession = create<SessionState>()((set) => ({
  wardrobeDoorsPlayed: false,
  activeWardrobeId: null,
  markWardrobeDoorsPlayed: () => set({ wardrobeDoorsPlayed: true }),
  setActiveWardrobe: (activeWardrobeId) => set({ activeWardrobeId }),
}));

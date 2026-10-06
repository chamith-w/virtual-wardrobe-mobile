import { create } from 'zustand';

import type { Rect } from '@/features/items/detail/hero';

/**
 * Where an item-detail hero flies from and back to (window coordinates).
 * `from` is the thumbnail that was tapped; `back` is the spot in the list it
 * returns to, which differs when the detail was opened from the quick sheet.
 */
export type HeroOrigin = {
  itemId: string;
  /** The wardrobe on show behind the detail (null when opened from an outfit). */
  wardrobeId: string | null;
  uri: string | null;
  from: Rect;
  back: Rect | null;
};

type ItemTransitionState = {
  origin: HeroOrigin | null;
  /** The piece whose detail is open is hidden in its list, so the hero can land in an empty spot. */
  hiddenId: string | null;
  begin: (itemId: string, origin: HeroOrigin | null) => void;
  /** Hide (or show again) a piece while its detail is open, e.g. when paging away from it. */
  setHidden: (itemId: string | null) => void;
  /** Detail closed (or never opened): show the piece again. */
  end: () => void;
};

export const useItemTransition = create<ItemTransitionState>()((set) => ({
  origin: null,
  hiddenId: null,
  begin: (itemId, origin) => set({ hiddenId: origin ? itemId : null, origin }),
  setHidden: (hiddenId) => set({ hiddenId }),
  end: () => set({ hiddenId: null, origin: null }),
}));

/** Whether a list should hide this piece (its hero is out flying). */
export function useHiddenForHero(itemId: string): boolean {
  return useItemTransition((s) => s.hiddenId === itemId);
}

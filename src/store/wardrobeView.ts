import { create } from 'zustand';

import { EMPTY_FILTERS, type SortKey, type WardrobeFilters } from '@/features/wardrobe/filters';

export type WardrobeMode = 'closet' | 'grid' | 'outfits';

/**
 * Ephemeral Wardrobe tab state, shared by the Closet and Grid views so a
 * search or filter survives switching between them.
 */
type WardrobeViewState = {
  mode: WardrobeMode;
  query: string;
  filters: WardrobeFilters;
  sort: SortKey;
  /** Ids of the list item detail pages through (the view it was opened from). */
  browseIds: string[];
  setMode: (mode: WardrobeMode) => void;
  setQuery: (query: string) => void;
  setFilters: (update: (filters: WardrobeFilters) => WardrobeFilters) => void;
  clearFilters: () => void;
  setSort: (sort: SortKey) => void;
  setBrowseIds: (ids: string[]) => void;
};

export const useWardrobeView = create<WardrobeViewState>()((set) => ({
  mode: 'closet',
  query: '',
  filters: EMPTY_FILTERS,
  sort: 'recent',
  browseIds: [],
  setMode: (mode) => set({ mode }),
  setQuery: (query) => set({ query }),
  setFilters: (update) => set((s) => ({ filters: update(s.filters) })),
  clearFilters: () => set({ filters: EMPTY_FILTERS, query: '' }),
  setSort: (sort) => set({ sort }),
  setBrowseIds: (browseIds) => set({ browseIds }),
}));

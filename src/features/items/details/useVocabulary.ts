import { useAllItems } from '@/features/wardrobe/useWardrobeData';

import { byFrequency } from './vocabulary';

/** Brands and tags already in the wardrobe, for the details form's suggestions. */
export function useVocabulary() {
  const { data } = useAllItems();
  return {
    brands: byFrequency(data.map((i) => i.brand)),
    tags: byFrequency(data.flatMap((i) => i.tags)),
  };
}

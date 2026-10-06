import { useLocalSearchParams } from 'expo-router';

import { NewOutfitPlaceholder } from '@/features/outfits/OutfitScreen';

/** "New outfit" (from the Outfits segment or an item's "Add to outfit"). The builder is phase 5. */
export default function NewOutfitRoute() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  return <NewOutfitPlaceholder itemId={itemId} />;
}

import { useLocalSearchParams } from 'expo-router';

import { OutfitScreen } from '@/features/outfits/OutfitScreen';

/** A saved outfit: its board, pieces and tags. Editing arrives with the builder (phase 5). */
export default function OutfitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OutfitScreen id={id} />;
}

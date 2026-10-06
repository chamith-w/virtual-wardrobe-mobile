import { useLocalSearchParams } from 'expo-router';

import { ItemDetailScreen } from '@/features/items/detail/ItemDetailScreen';

/**
 * Item detail. Presented as a transparent modal with no native animation:
 * the screen draws its own entrance, flying the tapped thumbnail into place
 * over the still-visible list (see features/items/detail).
 */
export default function ItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemDetailScreen key={id} id={id} />;
}

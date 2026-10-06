import { useLocalSearchParams } from 'expo-router';

import { EditItemScreen } from '@/features/items/details/EditItemScreen';

/** Edit a piece: the same details form as the add flow. */
export default function EditItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditItemScreen key={id} id={id} />;
}

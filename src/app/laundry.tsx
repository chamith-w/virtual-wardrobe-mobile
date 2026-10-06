import { useLocalSearchParams } from 'expo-router';

import { isLaundryTab, LaundryScreen } from '@/features/laundry/LaundryScreen';

/** /laundry?tab=laundry|lent|cleaner — from the closet basket, Me and the Today tiles. */
export default function LaundryRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initial = isLaundryTab(tab) ? tab : 'laundry';
  // Opened again with another tab (a deep link while it's showing): start over on that tab.
  return <LaundryScreen key={initial} initialTab={initial} />;
}

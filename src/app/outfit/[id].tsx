import { useLocalSearchParams } from 'expo-router';

import { OutfitBuilderScreen } from '@/features/outfits/builder/OutfitBuilderScreen';

/**
 * The outfit builder. `/outfit/new` starts a board, optionally with pieces:
 * `?item=<id>` (item detail's "New outfit") or `?items=<id>,<id>` (a
 * suggestion's Edit, phase 6). Any other id opens that outfit to edit.
 */
export default function OutfitRoute() {
  const { id, item, items } = useLocalSearchParams<{ id: string; item?: string; items?: string }>();
  const preload = [item, ...(items ?? '').split(',')].filter((x): x is string => !!x);
  return <OutfitBuilderScreen key={`${id}:${preload.join(',')}`} id={id === 'new' ? null : id} preload={preload} />;
}

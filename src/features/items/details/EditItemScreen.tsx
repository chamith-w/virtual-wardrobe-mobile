import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyState, Skeleton } from '@/components/ui';
import { updateItemDetails } from '@/features/items/mutations';
import { useItem } from '@/features/items/useItem';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';

import { DetailsScreen } from './DetailsScreen';
import { draftFromItem, type ItemDraft } from './draft';

/** Item detail → Edit: the add flow's details form, filled from the piece. */
export function EditItemScreen({ id }: { id: string }) {
  const { item, loaded } = useItem(id);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const current = draft ?? (item ? draftFromItem(item) : null);

  if (!item || !current) {
    return (
      <View className="flex-1 bg-background px-5 pt-20">
        {loaded ? (
          <EmptyState
            title="This piece is gone"
            body="It may have been deleted."
            actionLabel="Close"
            onAction={() => router.back()}
          />
        ) : (
          <Skeleton height={136} radius={22} />
        )}
      </View>
    );
  }

  return (
    <DetailsScreen
      title="Edit piece"
      leading={{ icon: X, label: 'Close without saving', onPress: () => router.back() }}
      draft={current}
      onChange={setDraft}
      previewUri={item.thumbUri}
      submitLabel="Save changes"
      submitting={false}
      onSubmit={(fields) => {
        updateItemDetails(item.id, fields);
        haptics.statusChanged();
        toast(fields.category !== item.category ? 'Saved · moved to its new zone' : 'Saved');
        router.back();
      }}
    />
  );
}

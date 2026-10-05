import { router } from 'expo-router';
import { Camera, X } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState, IconButton, Screen, Text } from '@/components/ui';

/** The "+" flow (capture → magic cutout → details → fly-in) is phase 3. */
export default function AddItemScreen() {
  return (
    <Screen scroll={false} tabBarInset={false} className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <IconButton icon={X} accessibilityLabel="Close" onPress={() => router.back()} />
        <Text variant="title2">New piece</Text>
        <View className="w-11" />
      </View>
      <View className="flex-1 justify-center">
        <EmptyState
          title="Capture arrives in phase 3"
          body="Camera with a garment guide, on-device background removal, colour detection, the details sheet and the fly-in."
          actionLabel="Back to my closet"
          actionIcon={Camera}
          onAction={() => router.back()}
        />
      </View>
    </Screen>
  );
}

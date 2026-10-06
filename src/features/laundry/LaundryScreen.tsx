import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Segmented, Skeleton, Text } from '@/components/ui';
import { useZones } from '@/features/wardrobe/useWardrobeData';
import { useMotionReduced } from '@/theme/motion';

import { CleanerTab } from './CleanerTab';
import { LaundryTab } from './LaundryTab';
import { LentTab } from './LentTab';
import { useOutPieces } from './useOutPieces';

export const LAUNDRY_TABS = ['laundry', 'lent', 'cleaner'] as const;
export type LaundryTabKey = (typeof LAUNDRY_TABS)[number];

export function isLaundryTab(value: unknown): value is LaundryTabKey {
  return typeof value === 'string' && (LAUNDRY_TABS as readonly string[]).includes(value);
}

function LoadingList() {
  return (
    <View className="gap-3 px-5 pt-4" accessibilityLabel="Loading">
      <Skeleton height={150} radius={24} />
      <Skeleton height={236} radius={24} />
    </View>
  );
}

/** Laundry · Lent · Cleaner (Laundry.dc.html): everything that's out of the wardrobe and why. */
export function LaundryScreen({ initialTab }: { initialTab: LaundryTabKey }) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const [tab, setTab] = useState<LaundryTabKey>(initialTab);
  const { loaded, worn, pile, cleaner, lent } = useOutPieces();
  const { data: zones } = useZones();
  const zoneTypeOf = (zoneId: string | null) => zones.find((z) => z.id === zoneId)?.type;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-3 px-4">
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={back} />
        <Text variant="display2" style={{ fontSize: 30, lineHeight: 34 }} accessibilityRole="header">
          Laundry & lent
        </Text>
      </View>
      <View className="mt-4 px-5">
        <Segmented<LaundryTabKey>
          accessibilityLabel="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'laundry', label: 'Laundry', count: pile.length },
            { value: 'lent', label: 'Lent', count: lent.length },
            { value: 'cleaner', label: 'Cleaner', count: cleaner.length },
          ]}
        />
      </View>
      {!loaded ? (
        <LoadingList />
      ) : (
        <Animated.View
          key={tab}
          entering={FadeIn.duration(reduced ? 150 : 260).reduceMotion(ReduceMotion.Never)}
          className="flex-1"
        >
          {tab === 'laundry' ? (
            <LaundryTab worn={worn} pile={pile} />
          ) : tab === 'lent' ? (
            <LentTab lent={lent} zoneTypeOf={zoneTypeOf} />
          ) : (
            <CleanerTab cleaner={cleaner} zoneTypeOf={zoneTypeOf} />
          )}
        </Animated.View>
      )}
    </View>
  );
}

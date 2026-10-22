import { Check } from 'lucide-react-native';
import { useRef } from 'react';
import { View } from 'react-native';

import { AnimatedPressable, Cutout, Text } from '@/components/ui';
import type { LookItem } from '@/features/suggestions/useLookItems';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * "Wear it again" (Today.dc.html): one piece that's been idle a while, the
 * pieces the engine pairs it with, and a one-tap plan for tomorrow.
 */
export function WearAgainCard({
  item,
  pairs,
  line,
  planned,
  plannedLabel,
  onTogglePlan,
  onOpenItem,
}: {
  item: LookItem;
  pairs: readonly LookItem[];
  line: string;
  planned: boolean;
  plannedLabel: string;
  onTogglePlan: () => void;
  onOpenItem: (from: View | null) => void;
}) {
  const { colors } = useTheme();
  const tile = useRef<View>(null);
  return (
    <View className="flex-row gap-3.5 rounded-lg border border-line bg-surface p-3" accessibilityLabel="Wear it again">
      <AnimatedPressable
        accessibilityLabel={`${item.name}. Opens the piece`}
        onPress={() => onOpenItem(tile.current)}
        scaleTo={0.97}
        className="items-center justify-center rounded-md bg-accent-soft px-2.5 py-3.5"
        style={{ width: 118 }}
      >
        <View ref={tile} collapsable={false}>
          <Cutout uri={item.thumbUri} width={96} height={115} />
        </View>
      </AnimatedPressable>
      <View className="min-w-0 flex-1 gap-1.5 px-0.5 py-1">
        <Text variant="eyebrow" tone="accent">
          Wear it again
        </Text>
        <Text variant="display3" numberOfLines={2} style={{ fontSize: 21, lineHeight: 23 }}>
          {item.name}
        </Text>
        <Text variant="caption">{line}</Text>
        <View className="mt-0.5 flex-row gap-1.5">
          {pairs.slice(0, 3).map((p) => (
            <View
              key={p.id}
              className="items-center justify-center rounded-sm bg-surface-tinted"
              style={{ width: 44, height: 48 }}
              accessible
              accessibilityLabel={p.name}
            >
              <Cutout uri={p.thumbUri} width={34} height={38} shadow="none" />
            </View>
          ))}
        </View>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityState={{ selected: planned }}
          accessibilityLabel={planned ? `${plannedLabel}. Tap to take it off` : 'Plan for tomorrow'}
          haptic="none"
          onPress={onTogglePlan}
          className={[
            'mt-1.5 h-10 flex-row items-center justify-center gap-1.5 rounded-pill',
            planned ? 'bg-success-soft' : 'border-[1.5px] border-line-strong',
          ].join(' ')}
        >
          {planned ? <Check size={16} strokeWidth={2.4} color={colors.success} /> : null}
          <Text variant="bodySm" weight="semibold" tone={planned ? 'success' : 'ink'}>
            {planned ? plannedLabel : 'Plan for tomorrow'}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

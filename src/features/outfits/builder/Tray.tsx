import { FlashList } from '@shopify/flash-list';
import { Check } from 'lucide-react-native';
import { memo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedPressable, Chip, Cutout, Text } from '@/components/ui';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations } from '@/theme/tokens';

import { roleOf, TRAY_TABS, type Role } from '../shuffle';
import type { BuilderItem } from './useBuilderData';

export const TILE = { width: 80, height: 96 };

/** Dragging a tile up onto the board. `onMove` runs on the UI thread. */
export type TrayDrag = {
  draggingId: SharedValue<string>;
  onBegin: (id: string, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => void;
  onCancel: () => void;
};

const TrayTile = memo(function TrayTile({
  item,
  onBoard,
  onTap,
  drag,
}: {
  item: BuilderItem;
  onBoard: boolean;
  onTap: (id: string) => void;
  drag: TrayDrag;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const id = item.id;
  // An upward drag lifts the piece towards the board; a sideways swipe scrolls the tray.
  const pan = Gesture.Pan()
    .activeOffsetY(-10)
    .failOffsetX([-14, 14])
    .onStart((e) => {
      drag.draggingId.set(id);
      drag.onMove(e.absoluteX, e.absoluteY);
      scheduleOnRN(drag.onBegin, id, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => drag.onMove(e.absoluteX, e.absoluteY))
    .onEnd((e) => scheduleOnRN(drag.onEnd, e.absoluteX, e.absoluteY))
    .onFinalize((_e, success) => {
      drag.draggingId.set('');
      if (!success) scheduleOnRN(drag.onCancel);
    });
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(drag.draggingId.get() === id ? 0.25 : 1, { duration: reduced ? durations.reducedFade : 160 }),
  }));

  return (
    <GestureDetector gesture={pan}>
      <AnimatedPressable
        accessibilityLabel={onBoard ? `${item.name}, on the board` : `Add ${item.name}`}
        accessibilityHint={onBoard ? 'Selects it on the board' : 'Or drag it up onto the board'}
        haptic="none"
        onPress={() => onTap(id)}
        scaleTo={0.92}
        className="items-center justify-center rounded-[18px] border border-line bg-surface"
        style={TILE}
      >
        <Animated.View style={fade}>
          <Cutout uri={item.thumbUri} width={62} height={74} />
        </Animated.View>
        {onBoard ? (
          <View
            className="absolute right-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-pill bg-success"
            importantForAccessibility="no"
          >
            <Check size={12} strokeWidth={3} color={colors.background} />
          </View>
        ) : null}
      </AnimatedPressable>
    </GestureDetector>
  );
});

function TileGap() {
  return <View style={{ width: 10 }} />;
}

/**
 * The tray under the board: category tabs over a strip of everything that's
 * in the wardrobe right now. Tap a piece to place it, or drag it up.
 */
export function Tray({
  items,
  onBoard,
  onTap,
  drag,
  bottomInset,
}: {
  /** Available pieces only, newest first. */
  items: readonly BuilderItem[];
  onBoard: ReadonlySet<string>;
  onTap: (id: string) => void;
  drag: TrayDrag;
  bottomInset: number;
}) {
  const counts = new Map<Role, number>();
  for (const i of items) counts.set(roleOf(i), (counts.get(roleOf(i)) ?? 0) + 1);
  const [picked, setPicked] = useState<Role | null>(null);
  const tab = picked ?? TRAY_TABS.find((t) => (counts.get(t.role) ?? 0) > 0)?.role ?? 'top';
  const shown = items.filter((i) => roleOf(i) === tab);
  const label = TRAY_TABS.find((t) => t.role === tab)?.label ?? '';

  return (
    <View>
      <GHScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 8 }}
      >
        {TRAY_TABS.map((t) => (
          <Chip
            key={t.role}
            label={t.label}
            count={counts.get(t.role) ?? 0}
            selected={t.role === tab}
            onPress={() => setPicked(t.role)}
          />
        ))}
      </GHScrollView>
      {shown.length === 0 ? (
        <View
          className="mx-4 justify-center rounded-[18px] border-[1.5px] border-dashed border-line-strong px-4"
          style={{ height: TILE.height, marginBottom: bottomInset }}
        >
          <Text variant="bodySm" weight="semibold">
            No {label.toLowerCase()} in the wardrobe right now
          </Text>
          <Text variant="caption" className="mt-0.5">
            Pieces that are worn, washing, lent or stored come back here when they’re home.
          </Text>
        </View>
      ) : (
        <View style={{ height: TILE.height + 2 + bottomInset }}>
          <FlashList
            horizontal
            data={shown}
            keyExtractor={(i) => i.id}
            extraData={onBoard}
            renderItem={({ item }) => <TrayTile item={item} onBoard={onBoard.has(item.id)} onTap={onTap} drag={drag} />}
            ItemSeparatorComponent={TileGap}
            renderScrollComponent={GHScrollView}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2 }}
          />
        </View>
      )}
    </View>
  );
}

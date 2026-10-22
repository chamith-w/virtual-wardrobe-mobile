import { BlurView } from 'expo-blur';
import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedPressable, Text } from '@/components/ui';
import { OutfitThumb } from '@/features/outfits/OutfitThumb';
import type { OutfitSummary } from '@/features/outfits/useOutfits';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations } from '@/theme/tokens';

export const DOCK_CARD = { width: 92, height: 84 };
/** The dock's height, so the page can leave room for it. */
export const DOCK_HEIGHT = 10 + 22 + DOCK_CARD.height + 26 + 10;

/** Dragging an outfit up from the dock onto a day. `onMove` runs on the UI thread. */
export type DockDrag = {
  draggingId: SharedValue<string>;
  onBegin: (id: string, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => void;
  onCancel: () => void;
};

const DockCard = memo(function DockCard({
  outfit,
  drag,
  onTap,
}: {
  outfit: OutfitSummary;
  drag: DockDrag;
  onTap: (outfit: OutfitSummary) => void;
}) {
  const reduced = useMotionReduced();
  const id = outfit.id;
  // An upward drag lifts the outfit towards the calendar; a sideways swipe scrolls the dock.
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
        accessibilityLabel={`Plan ${outfit.name} for the selected day`}
        accessibilityHint="Or drag it up onto a day"
        haptic="none"
        onPress={() => onTap(outfit)}
        scaleTo={0.94}
        style={{ width: DOCK_CARD.width }}
      >
        <Animated.View style={fade}>
          <OutfitThumb outfit={outfit} width={DOCK_CARD.width} height={DOCK_CARD.height} />
        </Animated.View>
        <Text variant="caption" weight="semibold" tone="ink" numberOfLines={1} className="mt-1.5">
          {outfit.name}
        </Text>
      </AnimatedPressable>
    </GestureDetector>
  );
});

/**
 * "Your outfits · drag onto a day" (Planner.dc.html): a frosted strip above
 * the tab bar. Tap an outfit to plan it on the selected day, or drag it up
 * onto any day in the calendar.
 */
export function OutfitDock({
  outfits,
  bottom,
  drag,
  onTap,
}: {
  outfits: readonly OutfitSummary[];
  bottom: number;
  drag: DockDrag;
  onTap: (outfit: OutfitSummary) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 12, right: 12, bottom, borderRadius: 26 }}
      className="py-2.5"
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 26,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: withAlpha(colors.ink, 0.1),
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={36} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(colors.surface, Platform.OS === 'ios' ? 0.74 : 0.96) },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 26,
            shadowColor: colors.shadow,
            shadowOpacity: isDark ? 0.4 : 0.12,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 14 },
            zIndex: -1,
          },
        ]}
      />
      <Text variant="eyebrow" className="px-4 pb-2">
        Your outfits · drag onto a day
      </Text>
      {outfits.length === 0 ? (
        <Text variant="bodySm" tone="muted" className="px-4 pb-1" style={{ minHeight: DOCK_CARD.height }}>
          Saved outfits land here, ready to drop onto a day. Build one from the Wardrobe’s Outfits tab.
        </Text>
      ) : (
        <GHScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        >
          {outfits.map((o) => (
            <DockCard key={o.id} outfit={o} drag={drag} onTap={onTap} />
          ))}
        </GHScrollView>
      )}
    </View>
  );
}

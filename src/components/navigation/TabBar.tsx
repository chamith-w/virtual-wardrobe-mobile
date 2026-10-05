import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { CalendarDays, CircleUserRound, Plus, Sun } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HangerIcon } from '@/components/illustrations/Glyphs';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Text } from '@/components/ui/Text';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, layout, springs } from '@/theme/tokens';

type TabConfig = { label: string; icon: (color: string) => ReactNode };

const TABS: Record<string, TabConfig> = {
  index: { label: 'Today', icon: (c) => <Sun size={22} color={c} strokeWidth={1.8} /> },
  wardrobe: { label: 'Wardrobe', icon: (c) => <HangerIcon size={22} color={c} /> },
  planner: { label: 'Planner', icon: (c) => <CalendarDays size={22} color={c} strokeWidth={1.8} /> },
  me: { label: 'Me', icon: (c) => <CircleUserRound size={22} color={c} strokeWidth={1.8} /> },
};

/** Order of the slots, with the raised "+" in the middle. */
const SLOTS = ['index', 'wardrobe', '+', 'planner', 'me'] as const;

function bottomOffset(insetBottom: number) {
  return Math.max(insetBottom - 14, layout.tabBarBottomGap);
}

/** Space screens should leave at the bottom so content clears the floating bar. */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return bottomOffset(insets.bottom) + layout.tabBarHeight;
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
  onLongPress,
}: {
  label: string;
  icon: (color: string) => ReactNode;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.set(
      reduced
        ? withTiming(focused ? 1 : 0, { duration: durations.reducedFade })
        : withSpring(focused ? 1 : 0, springs.bouncy),
    );
  }, [active, focused, reduced]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: active.get(),
    transform: [{ scale: active.get() }],
  }));

  const color = focused ? colors.ink : colors.muted;
  return (
    <AnimatedPressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.9}
      className="h-14 flex-1 items-center justify-center gap-0.5"
    >
      {icon(color)}
      <Text
        variant="caption"
        weight="semibold"
        tone={focused ? 'ink' : 'muted'}
        style={{ fontSize: 11 }}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
      <Animated.View
        style={[
          { position: 'absolute', bottom: 1, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
          dotStyle,
        ]}
      />
    </AnimatedPressable>
  );
}

/**
 * Floating, frosted tab bar with a raised centre "+" that opens the add-item
 * flow as a modal. Identical on iOS and Android (Android uses an opaque glass
 * fill because platform blur needs a dedicated target view).
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const routeIndex = (name: string) => state.routes.findIndex((r) => r.name === name);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: layout.tabBarSideInset,
        right: layout.tabBarSideInset,
        bottom: bottomOffset(insets.bottom),
        height: layout.tabBarHeight,
      }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 30,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: withAlpha(colors.ink, 0.1),
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(colors.surface, Platform.OS === 'ios' ? 0.72 : 0.96) },
          ]}
        />
      </View>
      {/* Soft lift under the glass. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 30,
            shadowColor: colors.shadow,
            shadowOpacity: isDark ? 0.4 : 0.12,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 14 },
            zIndex: -1,
          },
        ]}
      />

      <View accessibilityRole="tablist" className="flex-1 flex-row items-center px-1">
        {SLOTS.map((slot) => {
          if (slot === '+') {
            return (
              <View key="add" className="flex-1 items-center">
                <AnimatedPressable
                  accessibilityLabel="Add a piece"
                  accessibilityHint="Opens the camera to add clothes"
                  haptic="press"
                  scaleTo={0.9}
                  onPress={() => router.push('/add')}
                  style={{
                    width: layout.addButtonSize,
                    height: layout.addButtonSize,
                    borderRadius: layout.addButtonSize / 2,
                    marginTop: -34,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 6,
                    borderColor: colors.background,
                    shadowColor: colors.accent,
                    shadowOpacity: 0.42,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 8,
                  }}
                >
                  <Plus size={26} color={colors.onAccent} strokeWidth={2.2} />
                </AnimatedPressable>
              </View>
            );
          }

          const index = routeIndex(slot);
          const route = state.routes[index];
          const config = TABS[slot];
          if (!route || !config) return <View key={slot} className="flex-1" />;
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;

          return (
            <TabItem
              key={route.key}
              label={options?.title ?? config.label}
              icon={config.icon}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

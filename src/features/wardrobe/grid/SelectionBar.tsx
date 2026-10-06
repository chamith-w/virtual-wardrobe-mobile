import { ArrowLeftRight, WashingMachine, X } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { Button, IconButton, Text } from '@/components/ui';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

/** Floats above the tab bar while pieces are selected in the grid. */
export function SelectionBar({
  count,
  onMove,
  onLaundry,
  onDone,
}: {
  count: number;
  onMove: () => void;
  onLaundry: () => void;
  onDone: () => void;
}) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const tabInset = useTabBarInset();
  return (
    <Animated.View
      entering={
        reduced
          ? FadeIn.duration(200).reduceMotion(ReduceMotion.Never)
          : SlideInDown.springify().damping(18).reduceMotion(ReduceMotion.Never)
      }
      exiting={reduced ? FadeOut.duration(200).reduceMotion(ReduceMotion.Never) : SlideOutDown.duration(220)}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: tabInset + 12,
        shadowColor: colors.shadow,
        shadowOpacity: isDark ? 0.5 : 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
      }}
    >
      <View
        className="flex-row items-center gap-2 rounded-lg border border-line bg-surface py-2 pl-2 pr-2"
        accessibilityRole="toolbar"
        accessibilityLabel={`${count} selected`}
      >
        <IconButton icon={X} variant="ghost" accessibilityLabel="Done selecting" onPress={onDone} />
        <Text variant="body" weight="semibold" className="flex-1" accessibilityLiveRegion="polite">
          {count} selected
        </Text>
        <IconButton icon={WashingMachine} variant="tinted" accessibilityLabel="Send to laundry" onPress={onLaundry} />
        <Button label="Move to…" size="sm" icon={ArrowLeftRight} onPress={onMove} />
      </View>
    </Animated.View>
  );
}

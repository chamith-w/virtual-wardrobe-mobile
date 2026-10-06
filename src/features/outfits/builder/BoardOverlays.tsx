import { BringToFront, Lock, LockOpen, RotateCw, SendToBack, Trash2, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { contentSize, handlePoint, rotatedHalfExtents } from '../canvas';
import type { BoardMotion } from './BoardCanvas';

export const TRASH_SIZE = 64;
export const TRASH_BOTTOM = 20;
const HANDLE_SIZE = 36;
const BADGE_SIZE = 24;

/** The corner handle on the selected piece: drag it to scale and rotate (the board's gesture does the work). */
export function CornerHandle({ motion, width, height }: { motion: BoardMotion; width: number; height: number }) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const shown = useSharedValue(0);
  // Animate only when visibility flips, not on every frame the piece moves.
  useAnimatedReaction(
    () => {
      const id = motion.selected.get();
      return !!motion.live.get()[id] && motion.exitId.get() !== id;
    },
    (now, before) => {
      if (now === before) return;
      shown.set(
        reduced
          ? withTiming(now ? 1 : 0, { duration: durations.reducedFade })
          : withSpring(now ? 1 : 0, springs.snappy),
      );
    },
  );
  const style = useAnimatedStyle(() => {
    const p = motion.live.get()[motion.selected.get()];
    if (!p) return { opacity: 0 };
    const h = handlePoint(
      { cx: p.x * width, cy: p.y * height, scale: p.scale, rotation: p.rotation, aspect: p.aspect },
      width,
    );
    const v = shown.get();
    return {
      opacity: Math.min(1, v),
      transform: [
        { translateX: h.x - HANDLE_SIZE / 2 },
        { translateY: h.y - HANDLE_SIZE / 2 },
        { scale: reduced ? 1 : 0.4 + 0.6 * v },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          borderRadius: HANDLE_SIZE / 2,
          backgroundColor: colors.accentStrong,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.shadow,
          shadowOpacity: 0.3,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
        style,
      ]}
    >
      <RotateCw size={16} strokeWidth={2.2} color={colors.onAccent} />
    </Animated.View>
  );
}

/** A small lock above a locked piece, upright whatever the piece's angle. */
export function LockBadge({
  id,
  motion,
  width,
  height,
}: {
  id: string;
  motion: BoardMotion;
  width: number;
  height: number;
}) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const p = motion.live.get()[id];
    if (!p || motion.exitId.get() === id) return { opacity: 0 };
    const size = contentSize(p.aspect, p.scale, width);
    const half = rotatedHalfExtents(size.width, size.height, p.rotation);
    return {
      opacity: 1,
      transform: [
        { translateX: p.x * width - BADGE_SIZE / 2 },
        { translateY: Math.max(4, p.y * height - half.height - BADGE_SIZE / 2) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: BADGE_SIZE,
          height: BADGE_SIZE,
          borderRadius: BADGE_SIZE / 2,
          backgroundColor: colors.inverse,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Lock size={13} strokeWidth={2.2} color={colors.onInverse} />
    </Animated.View>
  );
}

/** The bin that rises while a piece is dragged, and swells red when it's over it. */
export function TrashZone({ motion }: { motion: BoardMotion }) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const base = useAnimatedStyle(() => {
    const up = motion.dragging.get() === 1;
    const hot = motion.hot.get() === 1;
    if (reduced) return { opacity: withTiming(up ? 1 : 0, { duration: durations.reducedFade }) };
    return {
      opacity: 1,
      transform: [
        { translateY: withSpring(up ? 0 : 120, springs.bouncy) },
        { scale: withSpring(hot ? 1.22 : 1, springs.bouncy) },
      ],
    };
  });
  const hotFill = useAnimatedStyle(() => ({
    opacity: withTiming(motion.hot.get() === 1 ? 1 : 0, { duration: 160 }),
  }));
  const circle = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: TRASH_SIZE,
    height: TRASH_SIZE,
    borderRadius: TRASH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        {
          position: 'absolute',
          bottom: TRASH_BOTTOM,
          alignSelf: 'center',
          width: TRASH_SIZE,
          height: TRASH_SIZE,
          shadowColor: colors.shadow,
          shadowOpacity: 0.24,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        },
        base,
      ]}
    >
      <View style={[circle, { backgroundColor: colors.surface }]}>
        <Trash2 size={24} strokeWidth={1.75} color={colors.danger} />
      </View>
      <Animated.View style={[circle, { backgroundColor: colors.danger }, hotFill]}>
        <Trash2 size={24} strokeWidth={1.75} color={colors.background} />
      </Animated.View>
    </Animated.View>
  );
}

function Tool({
  icon: Icon,
  label,
  onPress,
  disabled,
  active,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const color = active ? colors.onInverse : danger ? colors.danger : colors.ink;
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.88}
      className={['h-11 w-11 items-center justify-center rounded-[14px]', active ? 'bg-inverse' : ''].join(' ')}
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Icon size={19} strokeWidth={1.75} color={color} />
    </AnimatedPressable>
  );
}

/** Lock, bring forward, send back and remove, floating at the foot of the board while a piece is selected. */
export function BoardToolbar({
  visible,
  locked,
  atFront,
  atBack,
  onLock,
  onForward,
  onBackward,
  onRemove,
}: {
  visible: boolean;
  locked: boolean;
  atFront: boolean;
  atBack: boolean;
  onLock: () => void;
  onForward: () => void;
  onBackward: () => void;
  onRemove: () => void;
}) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const target = visible ? 1 : 0;
    shown.set(
      reduced
        ? withTiming(target, { duration: durations.reducedFade })
        : visible
          ? withSpring(target, springs.bouncy)
          : withTiming(target, { duration: 120 }),
    );
  }, [visible, reduced, shown]);

  const style = useAnimatedStyle(() => {
    const s = shown.get();
    if (reduced) return { opacity: s };
    return { opacity: Math.min(1, s * 1.5), transform: [{ scale: 0.6 + 0.4 * s }] };
  });

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }, style]}
    >
      <View
        accessibilityRole="toolbar"
        className="flex-row gap-0.5 rounded-[18px] border border-line p-1"
        style={{
          backgroundColor: withAlpha(colors.surface, 0.94),
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        }}
      >
        <Tool
          icon={locked ? Lock : LockOpen}
          label={locked ? 'Unlock piece' : 'Lock piece for shuffle'}
          active={locked}
          onPress={onLock}
        />
        <Tool icon={BringToFront} label="Bring forward" disabled={atFront} onPress={onForward} />
        <Tool icon={SendToBack} label="Send backward" disabled={atBack} onPress={onBackward} />
        <Tool icon={Trash2} label="Remove from outfit" danger onPress={onRemove} />
      </View>
    </Animated.View>
  );
}

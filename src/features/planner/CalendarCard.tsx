import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, type RefObject } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AnimatedPressable, Text } from '@/components/ui';
import { toDayKey, weekdayInitials, type DayKey } from '@/lib/dates';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { CELL_HEIGHT, dayLabel, ROW_HEIGHT } from './calendar';

export type DayInfo = { worn: boolean; dots: string[]; planned: string | null; trip: string | null };

/** The prototype's .65s overshoot, as a spring. */
const OPEN_SPRING = springs.drawer;
const ARROW_WIDTH = 28;

function DayCell({
  day,
  index,
  inMonth,
  selected,
  isToday,
  info,
  hover,
  onPress,
}: {
  day: Date;
  index: number;
  inMonth: boolean;
  selected: boolean;
  isToday: boolean;
  info: DayInfo;
  hover: SharedValue<number>;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  // Under a dragged outfit, the cell swells with an accent ring.
  const lift = useAnimatedStyle(() => {
    const on = hover.get() === index;
    if (reduced) return { transform: [{ scale: 1 }] };
    return { transform: [{ scale: withSpring(on ? 1.12 : 1, springs.bouncy) }] };
  });
  const ring = useAnimatedStyle(() => ({
    opacity: withTiming(hover.get() === index ? 1 : 0, { duration: reduced ? durations.reducedFade : 120 }),
  }));
  const fg = selected ? colors.onInverse : inMonth ? colors.ink : colors.faint;
  return (
    <Animated.View style={[{ flex: 1 }, lift]}>
      <AnimatedPressable
        accessibilityLabel={dayLabel(day, { today: isToday, ...info })}
        accessibilityState={{ selected }}
        onPress={onPress}
        scaleTo={0.9}
        className={[
          'items-center justify-center gap-1 rounded-[18px]',
          selected ? 'bg-inverse' : '',
          !selected && isToday ? 'border-[1.5px] border-accent' : '',
        ].join(' ')}
        style={{ height: CELL_HEIGHT }}
      >
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 rounded-[18px] border-2 border-accent bg-accent-soft"
          style={ring}
        />
        <Text variant="display3" style={{ fontSize: 19, lineHeight: 21, color: fg }}>
          {day.getDate()}
        </Text>
        {/* A fixed slot, so numbers line up whatever sits under them. */}
        <View className="h-3.5 items-center justify-center">
          {info.worn ? (
            <View className="h-3.5 w-3.5 items-center justify-center rounded-pill bg-accent-secondary">
              <Check size={9} strokeWidth={3.4} color={colors.onAccentSecondary} />
            </View>
          ) : info.dots.length > 0 ? (
            <View className="h-1.5 flex-row gap-0.5">
              {info.dots.map((hex, i) => (
                <View
                  key={i}
                  className={[
                    'h-1.5 w-1.5 rounded-pill border',
                    selected ? 'border-on-inverse/50' : 'border-line-strong',
                  ].join(' ')}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </View>
          ) : null}
        </View>
        {info.trip ? (
          <View
            pointerEvents="none"
            className="absolute bottom-[3px] left-1.5 right-1.5 h-[3px] rounded-pill bg-accent-secondary opacity-55"
          />
        ) : null}
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * The calendar card (Planner.dc.html): one week, or the whole month when
 * expanded. The grid keeps every row and the card's height and offset spring
 * between them, so the selected week stays put as the month opens around it.
 */
export function CalendarCard({
  rows,
  month,
  expanded,
  weekRow,
  selected,
  today,
  info,
  hover,
  gridRef,
  onSelect,
  onPrev,
  onNext,
}: {
  rows: Date[][];
  month: Date;
  expanded: boolean;
  weekRow: number;
  selected: DayKey;
  today: DayKey;
  info: (day: DayKey) => DayInfo;
  hover: SharedValue<number>;
  gridRef: RefObject<View | null>;
  onSelect: (day: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const height = useSharedValue(expanded ? rows.length * ROW_HEIGHT - 4 : CELL_HEIGHT);
  const offset = useSharedValue(expanded ? 0 : -weekRow * ROW_HEIGHT);
  const monthKey = toDayKey(month);
  const lastMonth = useRef(monthKey);

  useEffect(() => {
    const h = expanded ? rows.length * ROW_HEIGHT - 4 : CELL_HEIGHT;
    const y = expanded ? 0 : -weekRow * ROW_HEIGHT;
    // A different month's grid: jump, so the strip doesn't slide through rows it never showed.
    const jump = lastMonth.current !== monthKey;
    lastMonth.current = monthKey;
    if (jump) {
      height.set(h);
      offset.set(y);
    } else if (reduced) {
      height.set(withTiming(h, { duration: durations.reducedFade }));
      offset.set(withTiming(y, { duration: durations.reducedFade }));
    } else {
      height.set(withSpring(h, OPEN_SPRING));
      offset.set(withSpring(y, OPEN_SPRING));
    }
  }, [expanded, weekRow, rows.length, monthKey, height, offset, reduced]);

  const clip = useAnimatedStyle(() => ({ height: height.get() }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const initials = weekdayInitials();
  const unit = expanded ? 'month' : 'week';

  return (
    <View className="rounded-[26px] border border-line bg-surface px-2 pb-2 pt-2.5">
      <View className="flex-row items-center">
        <View style={{ width: ARROW_WIDTH }} />
        <View className="flex-1 flex-row">
          {initials.map((d, i) => (
            <Text key={`${d}-${i}`} variant="caption" weight="bold" tone="muted" className="flex-1 text-center">
              {d}
            </Text>
          ))}
        </View>
        <View style={{ width: ARROW_WIDTH }} />
      </View>
      <View className="mt-1.5 flex-row items-start">
        <AnimatedPressable
          accessibilityLabel={`Previous ${unit}`}
          onPress={onPrev}
          className="items-center justify-center"
          style={{ width: ARROW_WIDTH, height: CELL_HEIGHT }}
        >
          <ChevronLeft size={16} color={colors.muted} strokeWidth={2} />
        </AnimatedPressable>
        <Animated.View className="flex-1 overflow-hidden" style={clip}>
          <View ref={gridRef} collapsable={false}>
            <Animated.View style={[{ rowGap: ROW_HEIGHT - CELL_HEIGHT }, slide]}>
              {rows.map((row, r) => (
                <View key={toDayKey(row[0]!)} className="flex-row">
                  {row.map((day, c) => {
                    const key = toDayKey(day);
                    return (
                      <DayCell
                        key={key}
                        day={day}
                        index={r * 7 + c}
                        inMonth={day.getMonth() === month.getMonth()}
                        selected={key === selected}
                        isToday={key === today}
                        info={info(key)}
                        hover={hover}
                        onPress={() => onSelect(day)}
                      />
                    );
                  })}
                </View>
              ))}
            </Animated.View>
          </View>
        </Animated.View>
        <AnimatedPressable
          accessibilityLabel={`Next ${unit}`}
          onPress={onNext}
          className="items-center justify-center"
          style={{ width: ARROW_WIDTH, height: CELL_HEIGHT }}
        >
          <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

import { CalendarClock } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Chip, DatePickerSheet, Text, type SheetRef } from '@/components/ui';
import { setReadyAt } from '@/features/items/mutations';
import { cleanerInfo } from '@/features/laundry/copy';
import { addDays, formatWeekdayDay, startOfDay } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useMotionReduced } from '@/theme/motion';
import { durations, springs } from '@/theme/tokens';

export type CleanerPiece = { id: string; name: string; statusChangedAt: Date | null; readyAt: Date | null };

const READY_PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'In 3 days', days: 3 },
  { label: 'In a week', days: 7 },
];

function Progress({ value, onTinted }: { value: number; onTinted: boolean }) {
  const reduced = useMotionReduced();
  const width = useSharedValue(0);
  useEffect(() => {
    width.set(reduced ? withTiming(value, { duration: durations.reducedFade }) : withSpring(value, springs.gentle));
  }, [reduced, value, width]);
  const style = useAnimatedStyle(() => ({ width: `${Math.round(width.get() * 100)}%` }));
  return (
    <View
      className={['h-2 overflow-hidden rounded-pill', onTinted ? 'bg-surface' : 'bg-surface-tinted'].join(' ')}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View className="h-full rounded-pill bg-accent-secondary" style={style} />
    </View>
  );
}

/**
 * Dry cleaner: when it was dropped off, when it's ready (with progress), and a
 * chip to set the ready day.
 */
export function CleanerDetails({ item, onTinted = false }: { item: CleanerPiece; onTinted?: boolean }) {
  const picker = useRef<SheetRef>(null);
  const now = new Date();
  const info = cleanerInfo(item.statusChangedAt, item.readyAt, now);
  const today = startOfDay(now);

  return (
    <View className="gap-2">
      <View className="gap-0.5">
        <Text variant="bodySm" weight="semibold">
          {info.dropped}
        </Text>
        <Text variant="caption" weight="semibold" tone={info.tone}>
          {info.line}
        </Text>
      </View>
      {info.progress !== null ? <Progress value={info.progress} onTinted={onTinted} /> : null}
      <Chip
        icon={CalendarClock}
        label={item.readyAt ? `Ready ${formatWeekdayDay(item.readyAt)}` : 'Set a ready day'}
        accessibilityHint="Choose when it’s ready to collect"
        onPress={() => picker.current?.present()}
      />
      <DatePickerSheet
        ref={picker}
        title="Ready to collect"
        eyebrow={item.name}
        presets={READY_PRESETS}
        initial={item.readyAt ?? addDays(today, 3)}
        min={today}
        confirmLabel={(day) => `Ready ${formatWeekdayDay(day)}`}
        onPick={(day) => {
          picker.current?.dismiss();
          setReadyAt(item.id, startOfDay(day));
          haptics.tap();
        }}
        clearLabel={item.readyAt ? 'No ready day' : undefined}
        onClear={() => {
          picker.current?.dismiss();
          setReadyAt(item.id, null);
        }}
      />
    </View>
  );
}

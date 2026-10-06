import { ChevronLeft, ChevronRight, Timer } from 'lucide-react-native';
import { useState, type Ref } from 'react';
import { View } from 'react-native';

import {
  addDays,
  addMonths,
  formatLongDay,
  formatMonthTitle,
  isSameDay,
  monthGrid,
  startOfDay,
  weekdayInitials,
} from '@/lib/dates';
import { haptics } from '@/lib/haptics';

import { AnimatedPressable } from './AnimatedPressable';
import { Button } from './Button';
import { Chip } from './Chip';
import { IconButton } from './IconButton';
import { Sheet, type SheetRef } from './Sheet';
import { Text } from './Text';

export type DatePreset = { label: string; days: number };

export const DEFAULT_DATE_PRESETS: DatePreset[] = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In a week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'In a month', days: 30 },
];

export type DatePickerSheetProps = {
  ref: Ref<SheetRef>;
  title: string;
  eyebrow?: string;
  /** The day shown as chosen when the sheet opens. */
  initial: Date;
  /** The earliest day that can be chosen. */
  min: Date;
  presets?: DatePreset[];
  /** Button label for the chosen day, e.g. "Remind me Fri 20 Oct". */
  confirmLabel: (day: Date) => string;
  onPick: (day: Date) => void;
  /** A secondary action, e.g. "No ready date". */
  clearLabel?: string;
  onClear?: () => void;
  /**
   * Development builds only: a chip that picks a moment ten seconds away, to
   * test notifications without waiting days.
   */
  onDevMoment?: (at: Date) => void;
};

function Calendar({
  month,
  selected,
  min,
  today,
  onMonth,
  onSelect,
}: {
  month: Date;
  selected: Date;
  min: Date;
  today: Date;
  onMonth: (month: Date) => void;
  onSelect: (day: Date) => void;
}) {
  const rows = monthGrid(month.getFullYear(), month.getMonth());
  const canGoBack = month > addMonths(min, 0);
  const initials = weekdayInitials();

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text variant="display3" style={{ fontSize: 21, lineHeight: 26 }} accessibilityRole="header">
          {formatMonthTitle(month)}
        </Text>
        <View className="flex-row gap-1.5">
          <IconButton
            icon={ChevronLeft}
            variant="tinted"
            accessibilityLabel="Previous month"
            disabled={!canGoBack}
            className={canGoBack ? '' : 'opacity-30'}
            onPress={() => onMonth(addMonths(month, -1))}
          />
          <IconButton
            icon={ChevronRight}
            variant="tinted"
            accessibilityLabel="Next month"
            onPress={() => onMonth(addMonths(month, 1))}
          />
        </View>
      </View>
      <View className="mt-3 flex-row">
        {initials.map((d, i) => (
          <Text key={`${d}-${i}`} variant="caption" weight="semibold" tone="muted" className="flex-1 text-center">
            {d}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} className="flex-row">
          {row.map((day, c) => {
            if (!day) return <View key={c} className="h-11 flex-1" />;
            const disabled = day < startOfDay(min);
            const on = isSameDay(day, selected);
            const isToday = isSameDay(day, today);
            return (
              <AnimatedPressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={formatLongDay(day)}
                accessibilityState={{ selected: on, disabled }}
                disabled={disabled}
                onPress={() => onSelect(day)}
                scaleTo={0.88}
                className="h-11 flex-1 items-center justify-center"
              >
                <View
                  className={[
                    'h-10 w-10 items-center justify-center rounded-pill',
                    on ? 'bg-inverse' : '',
                    !on && isToday ? 'border-[1.5px] border-accent' : '',
                  ].join(' ')}
                >
                  <Text
                    variant="bodySm"
                    weight={on || isToday ? 'semibold' : 'medium'}
                    tone={on ? 'onInverse' : disabled ? 'faint' : 'ink'}
                  >
                    {day.getDate()}
                  </Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DatePickerBody({
  initial,
  min,
  presets = DEFAULT_DATE_PRESETS,
  confirmLabel,
  onPick,
  clearLabel,
  onClear,
  onDevMoment,
}: Omit<DatePickerSheetProps, 'ref' | 'title' | 'eyebrow'>) {
  const [today] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(initial < min ? min : initial));
  const [month, setMonth] = useState(() => addMonths(selected, 0));
  const choose = (day: Date) => {
    haptics.tap();
    setSelected(startOfDay(day));
    setMonth(addMonths(day, 0));
  };
  const options = presets.map((p) => ({ ...p, day: addDays(today, p.days) })).filter((p) => p.day >= startOfDay(min));

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {options.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            selected={isSameDay(p.day, selected)}
            haptic="none"
            onPress={() => choose(p.day)}
          />
        ))}
        {__DEV__ && onDevMoment ? (
          <Chip
            label="In 10 s · dev"
            icon={Timer}
            accessibilityHint="Development only: schedules it ten seconds from now"
            onPress={() => onDevMoment(new Date(Date.now() + 10_000))}
          />
        ) : null}
      </View>
      <View className="mt-5">
        <Calendar month={month} selected={selected} min={min} today={today} onMonth={setMonth} onSelect={choose} />
      </View>
      <Button label={confirmLabel(selected)} fullWidth className="mt-5" onPress={() => onPick(selected)} />
      {clearLabel && onClear ? (
        <Button label={clearLabel} variant="ghost" fullWidth className="mt-1" onPress={onClear} />
      ) : null}
    </View>
  );
}

/**
 * Pick a day: quick chips ("In a week") over a month calendar. The body
 * mounts each time the sheet opens, so it always starts from `initial`.
 * Stacks on top of a sheet it's opened from.
 */
export function DatePickerSheet({ ref, title, eyebrow, ...body }: DatePickerSheetProps) {
  return (
    <Sheet ref={ref} title={title} eyebrow={eyebrow} stackBehavior="push">
      <DatePickerBody {...body} />
    </Sheet>
  );
}

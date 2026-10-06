import { BellRing, ChevronDown } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { AnimatedPressable, Button, DatePickerSheet, Text, Toggle, type SheetRef } from '@/components/ui';
import { defaultReminderDate, earliestReminderDay, reminderMoment } from '@/features/items/reminders';
import { setLendReminder } from '@/features/items/statusService';
import { formatLongDay, formatShortDay, formatWeekdayDay } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useTheme } from '@/theme/ThemeProvider';

export type LentPiece = {
  id: string;
  name: string;
  lentTo: string | null;
  lentAt: Date | null;
  remindAt: Date | null;
};

function whenLine(at: Date, now: Date): string {
  const seconds = Math.round((at.getTime() - now.getTime()) / 1000);
  return seconds < 90 ? `in ${Math.max(1, seconds)} seconds` : formatWeekdayDay(at);
}

/**
 * "Remind me to ask for it back": a toggle that schedules a local
 * notification (default two weeks after lending, at 10:00) and a chip to
 * change the day. Permission is asked the first time it's switched on.
 */
export function LendReminderRow({ item, onSurface = false }: { item: LentPiece; onSurface?: boolean }) {
  const { colors } = useTheme();
  const picker = useRef<SheetRef>(null);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);
  const on = optimistic ?? item.remindAt !== null;
  const now = new Date();

  const apply = async (at: Date | null) => {
    setOptimistic(at !== null);
    const result = await setLendReminder(item, at);
    setOptimistic(null);
    if (result === 'blocked' || result === 'denied') {
      haptics.warning();
      setBlocked(result === 'blocked');
      if (result === 'denied') toast('Reminders need notifications turned on', 'info');
      return;
    }
    setBlocked(false);
    haptics.tap();
    if (result === 'on' && at) toast(`We’ll remind you ${whenLine(at, new Date())}`);
  };

  const remindAt = item.remindAt;
  const past = remindAt !== null && remindAt <= now;

  return (
    <View className={['rounded-[16px] py-2 pl-3.5 pr-2', onSurface ? 'bg-surface' : 'bg-surface-tinted'].join(' ')}>
      <View className="min-h-11 flex-row items-center justify-between gap-2.5">
        <View className="flex-1 gap-1">
          <Text variant="bodySm" weight="semibold">
            Remind me to ask for it back
          </Text>
          {on && remindAt ? (
            <AnimatedPressable
              accessibilityLabel={`${past ? 'Reminded' : 'Reminder'} ${formatLongDay(remindAt)}`}
              accessibilityHint="Changes the reminder day"
              onPress={() => picker.current?.present()}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              scaleTo={0.95}
              className={[
                'h-8 flex-row items-center gap-1.5 self-start rounded-pill px-2.5',
                onSurface ? 'bg-surface-tinted' : 'bg-surface',
              ].join(' ')}
            >
              <BellRing size={13} color={colors.accentText} strokeWidth={2} />
              <Text variant="caption" weight="semibold" tone="ink">
                {past ? `Reminded ${formatShortDay(remindAt)}` : formatWeekdayDay(remindAt)}
              </Text>
              <ChevronDown size={13} color={colors.muted} strokeWidth={2} />
            </AnimatedPressable>
          ) : null}
        </View>
        <Toggle
          value={on}
          onValueChange={(next) => void apply(next ? defaultReminderDate(item.lentAt, new Date()) : null)}
          accessibilityLabel={`Remind me to ask for ${item.name} back`}
        />
      </View>
      {blocked ? (
        <View className="mt-1 flex-row items-center justify-between gap-2">
          <Text variant="caption" tone="muted" className="flex-1">
            Notifications are off for My Closet.
          </Text>
          <Button label="Open Settings" variant="ghost" size="sm" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      <DatePickerSheet
        ref={picker}
        title="Remind me on"
        eyebrow={item.lentTo ? `${item.name} · ${item.lentTo}` : item.name}
        initial={remindAt && !past ? remindAt : defaultReminderDate(item.lentAt, now)}
        min={earliestReminderDay(now)}
        confirmLabel={(day) => `Remind me ${formatWeekdayDay(day)}`}
        onPick={(day) => {
          picker.current?.dismiss();
          const at = reminderMoment(day, new Date());
          if (at) void apply(at);
        }}
        clearLabel="Turn the reminder off"
        onClear={() => {
          picker.current?.dismiss();
          void apply(null);
        }}
        onDevMoment={(at) => {
          picker.current?.dismiss();
          void apply(at);
        }}
      />
    </View>
  );
}

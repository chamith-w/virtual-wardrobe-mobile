import { CalendarPlus, Copy, Pencil, Trash2, type LucideIcon } from 'lucide-react-native';
import { useState, type RefObject } from 'react';
import { View } from 'react-native';

import { AnimatedPressable, Button, DatePickerSheet, Sheet, Text, type SheetRef } from '@/components/ui';
import { startOfDay, toDayKey } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useTheme } from '@/theme/ThemeProvider';

import { planOutfit } from './mutations';
import { PLAN_PRESETS, planButtonLabel, planToast } from './plan';

/** Pick a day and plan the outfit on it (one outfit per day). */
export function PlanOutfitSheet({
  ref,
  outfit,
}: {
  ref: RefObject<SheetRef | null>;
  outfit: { id: string; name: string } | null;
}) {
  const today = startOfDay(new Date());
  return (
    <DatePickerSheet
      ref={ref}
      title="Plan it"
      eyebrow={outfit?.name}
      initial={today}
      min={today}
      presets={PLAN_PRESETS}
      confirmLabel={(day) => planButtonLabel(day, today)}
      onPick={(day) => {
        if (!outfit) return;
        const result = planOutfit(outfit.id, toDayKey(day));
        haptics.dropSuccess();
        toast(planToast(day, result, today));
        ref.current?.dismiss();
      }}
    />
  );
}

function MenuRow({
  icon: Icon,
  label,
  hint,
  danger,
  last,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  danger?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      scaleTo={0.98}
      className={['min-h-[56px] flex-row items-center gap-3.5 py-2', last ? '' : 'border-b border-line'].join(' ')}
    >
      <View
        className={[
          'h-9 w-9 items-center justify-center rounded-pill',
          danger ? 'bg-danger-soft' : 'bg-surface-tinted',
        ].join(' ')}
      >
        <Icon size={18} strokeWidth={1.8} color={danger ? colors.danger : colors.ink} />
      </View>
      <View className="flex-1">
        <Text variant="body" weight="medium" tone={danger ? 'danger' : 'ink'}>
          {label}
        </Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
    </AnimatedPressable>
  );
}

export type OutfitMenuTarget = { id: string; name: string; meta: string };

/**
 * The long-press menu on an outfit card: edit, plan for a day, duplicate,
 * delete. Delete asks once more, in place.
 */
export function OutfitMenuSheet({
  ref,
  outfit,
  onEdit,
  onPlan,
  onDuplicate,
  onDelete,
}: {
  ref: RefObject<SheetRef | null>;
  outfit: OutfitMenuTarget | null;
  onEdit: () => void;
  onPlan: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Sheet ref={ref} eyebrow={outfit?.meta} title={outfit?.name} onDismiss={() => setConfirming(false)}>
      {confirming ? (
        <View>
          <Text variant="body" tone="muted">
            It leaves your outfits and any upcoming plans. The pieces stay in your wardrobe.
          </Text>
          <Button label="Delete outfit" variant="danger" icon={Trash2} fullWidth className="mt-5" onPress={onDelete} />
          <Button label="Keep it" variant="ghost" fullWidth className="mt-1" onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <View>
          <MenuRow icon={Pencil} label="Edit outfit" hint="Rearrange, shuffle or swap pieces" onPress={onEdit} />
          <MenuRow icon={CalendarPlus} label="Plan for a day" onPress={onPlan} />
          <MenuRow icon={Copy} label="Duplicate" hint="A copy to vary" onPress={onDuplicate} />
          <MenuRow
            icon={Trash2}
            label="Delete"
            danger
            last
            onPress={() => {
              haptics.warning();
              setConfirming(true);
            }}
          />
        </View>
      )}
    </Sheet>
  );
}

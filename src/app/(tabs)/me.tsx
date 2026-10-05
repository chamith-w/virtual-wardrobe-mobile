import { router } from 'expo-router';
import { ChevronRight, Palette, RotateCcw } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Screen, Segmented, Sheet, Text, Toggle, type SheetRef } from '@/components/ui';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { clearAllData, createEmptyWardrobes, resetToDemoData } from '@/db/seed';
import { useStatusCounts } from '@/features/wardrobe/useWardrobeSummary';
import { haptics } from '@/lib/haptics';
import { usePreferences, type TemperatureUnit, type ThemePreference } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="min-h-[60px] flex-row items-center justify-between gap-4 border-b border-line py-2.5">
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="medium">
          {label}
        </Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function MeScreen() {
  const { colors, preference, setPreference } = useTheme();
  const reduceMotion = usePreferences((s) => s.reduceMotion);
  const setReduceMotion = usePreferences((s) => s.setReduceMotion);
  const unit = usePreferences((s) => s.temperatureUnit);
  const setUnit = usePreferences((s) => s.setTemperatureUnit);
  const counts = useStatusCounts();
  const resetSheet = useRef<SheetRef>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      haptics.statusChanged();
    } finally {
      setBusy(false);
      resetSheet.current?.dismiss();
    }
  };

  return (
    <Screen className="px-5">
      <Text variant="eyebrow" className="mt-2">
        Me
      </Text>
      <Text variant="display1" accessibilityRole="header" className="mt-2">
        Your closet
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1.5">
        {counts.total} pieces · {counts.laundry} in laundry · {counts.lent} lent · {counts.storage} in storage
      </Text>

      <SectionHeader title="Coming in phase 7" />
      <Card tone="tinted" className="gap-1">
        <Text variant="bodySm" tone="muted">
          Insights, laundry basket, lent items, declutter, packing lists, wishlist and seasonal rotation all live here.
        </Text>
      </Card>

      <SectionHeader title="Design system" />
      <Card
        onPress={() => router.push('/design-system')}
        className="flex-row items-center gap-3.5"
        accessibilityLabel="Open the design system"
      >
        <View className="h-11 w-11 items-center justify-center rounded-sm bg-accent-soft">
          <Palette size={20} color={colors.accentText} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <Text variant="title2">Primitives & tokens</Text>
          <Text variant="caption" className="mt-0.5">
            Type, colour, buttons, chips, sheets, skeletons…
          </Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Card>

      <SectionHeader title="Settings" />
      <Row label="Theme">
        <View className="w-52">
          <Segmented<ThemePreference>
            size="sm"
            accessibilityLabel="Theme"
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </View>
      </Row>
      <Row label="Temperature">
        <View className="w-32">
          <Segmented<TemperatureUnit>
            size="sm"
            accessibilityLabel="Temperature unit"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'celsius', label: '°C' },
              { value: 'fahrenheit', label: '°F' },
            ]}
          />
        </View>
      </Row>
      <Row label="Reduce motion" hint="Fades instead of springs and 3D">
        <Toggle value={reduceMotion} onValueChange={setReduceMotion} accessibilityLabel="Reduce motion" />
      </Row>
      <Row label="Demo data" hint="Reload the sample wardrobe or start from scratch">
        <Button
          label="Reset"
          size="sm"
          variant="secondary"
          icon={RotateCcw}
          onPress={() => resetSheet.current?.present()}
        />
      </Row>

      <Sheet ref={resetSheet} eyebrow="Demo data" title="Reset your closet?">
        <Text variant="bodySm" tone="muted">
          This deletes every piece, outfit, log and photo on this device.
        </Text>
        <View className="mt-5 gap-2.5">
          <Button label="Reload the demo wardrobe" fullWidth disabled={busy} onPress={() => run(resetToDemoData)} />
          <Button
            label="Start with an empty closet"
            variant="secondary"
            fullWidth
            disabled={busy}
            onPress={() =>
              run(async () => {
                await clearAllData();
                await createEmptyWardrobes();
              })
            }
          />
        </View>
      </Sheet>
    </Screen>
  );
}

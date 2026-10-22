import type { RefObject } from 'react';
import { View } from 'react-native';

import { Button, Chip, Sheet, Text, Toggle, type SheetRef } from '@/components/ui';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';

import { formatTemp } from './units';

/** Feels-like temperatures across the engine's bands (°C). */
const STEPS = [-2, 4, 10, 15, 20, 24, 28, 33];

/**
 * Development builds only: pretend it's this cold (or wet) to watch the
 * suggestions change. Lives for the session; nothing is saved.
 */
export function DevWeatherSheet({ ref }: { ref: RefObject<SheetRef | null> }) {
  const unit = usePreferences((s) => s.temperatureUnit);
  const override = useSession((s) => s.weatherOverride);
  const set = useSession((s) => s.setWeatherOverride);
  return (
    <Sheet ref={ref} eyebrow="Development" title="Weather override">
      <Text variant="bodySm" tone="muted">
        Today’s suggestions use this instead of the forecast until you clear it or restart the app.
      </Text>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {STEPS.map((c) => (
          <Chip
            key={c}
            label={`Feels ${formatTemp(c, unit)}`}
            selected={override?.feelsLikeC === c}
            onPress={() => set({ feelsLikeC: c, rain: override?.rain ?? false })}
          />
        ))}
      </View>
      <View className="mt-4 flex-row items-center justify-between">
        <Text variant="body" weight="medium">
          Raining
        </Text>
        <Toggle
          value={override?.rain ?? false}
          accessibilityLabel="Raining"
          onValueChange={(rain) => set({ feelsLikeC: override?.feelsLikeC ?? 15, rain })}
        />
      </View>
      <Button
        label="Use the real forecast"
        variant="secondary"
        fullWidth
        className="mt-5"
        disabled={!override}
        onPress={() => {
          set(null);
          ref.current?.dismiss();
        }}
      />
    </Sheet>
  );
}

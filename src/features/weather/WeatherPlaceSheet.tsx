import { Check, LocateFixed, MapPin } from 'lucide-react-native';
import { useEffect, useState, type RefObject } from 'react';
import { Linking, View } from 'react-native';

import { AnimatedPressable, Button, SearchField, Sheet, Skeleton, Text, type SheetRef } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';
import { useTheme } from '@/theme/ThemeProvider';

import { requestLocationAccess } from './location';
import { searchCities } from './openMeteo';
import { useWeatherStore } from './store';
import type { CityResult } from './types';

const SEARCH_DELAY_MS = 300;

/** Asks for location (when it still can) and switches the weather to the device. */
export async function switchToDeviceLocation(): Promise<'granted' | 'denied' | 'blocked'> {
  const access = await requestLocationAccess();
  if (access !== 'granted') return access === 'blocked' ? 'blocked' : 'denied';
  usePreferences.getState().setWeatherPlace({ kind: 'device' });
  void useWeatherStore.getState().refresh({ force: true });
  return 'granted';
}

function Row({
  icon,
  title,
  hint,
  selected,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      accessibilityLabel={hint ? `${title}, ${hint}` : title}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      scaleTo={0.98}
      className="min-h-[56px] flex-row items-center gap-3.5 border-b border-line py-2"
    >
      <View className="h-9 w-9 items-center justify-center rounded-pill bg-surface-tinted">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text variant="body" weight="medium" numberOfLines={1}>
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {selected ? <Check size={18} color={colors.accentSecondary} strokeWidth={2.4} /> : null}
    </AnimatedPressable>
  );
}

/**
 * Where the weather comes from: the device's location, or a city found by
 * name (Open-Meteo geocoding) for when location is off.
 */
export function WeatherPlaceSheet({ ref }: { ref: RefObject<SheetRef | null> }) {
  const { colors } = useTheme();
  const place = usePreferences((s) => s.weatherPlace);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ query: string; results: CityResult[]; failed: boolean } | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const name = query.trim();
    if (name.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchCities(name)
        .then((results) => alive && setFound({ query: name, results, failed: false }))
        .catch(() => alive && setFound({ query: name, results: [], failed: true }));
    }, SEARCH_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const name = query.trim();
  const active = name.length >= 2;
  const searching = active && found?.query !== name;
  // The last results stay up while the next search runs, so the list doesn't flicker.
  const results = active ? (found?.results ?? []) : [];
  const failed = active && !searching && !!found?.failed;

  const close = () => {
    ref.current?.dismiss();
    setQuery('');
  };

  const pickCity = (city: CityResult) => {
    haptics.tap();
    usePreferences.getState().setWeatherPlace({
      kind: 'city',
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
    });
    void useWeatherStore.getState().refresh({ force: true });
    toast(`Weather for ${city.name}`);
    close();
  };

  const pickDevice = async () => {
    const result = await switchToDeviceLocation();
    if (result === 'granted') {
      toast('Weather for where you are');
      close();
    } else {
      haptics.warning();
      setBlocked(result === 'blocked');
      toast(result === 'blocked' ? 'Location is off for My Closet in Settings' : 'Location wasn’t allowed', 'info');
    }
  };

  return (
    <Sheet ref={ref} eyebrow="Weather" title="Where are you dressing for?" onDismiss={() => setQuery('')}>
      <Row
        icon={<LocateFixed size={18} color={colors.ink} strokeWidth={1.9} />}
        title="Use my location"
        hint="The forecast for wherever you are"
        selected={place?.kind === 'device'}
        onPress={() => void pickDevice()}
      />
      {blocked ? (
        <Button
          label="Open Settings"
          variant="ghost"
          size="sm"
          className="mt-1"
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
      <SearchField
        inSheet
        value={query}
        onChangeText={setQuery}
        placeholder="Search a city"
        accessibilityLabel="Search a city"
        autoCapitalize="words"
        className="mt-4"
      />
      <View className="mt-2 min-h-[120px]">
        {searching && results.length === 0 ? (
          <View className="gap-3 pt-3">
            <Skeleton height={18} width="60%" radius={6} />
            <Skeleton height={18} width="45%" radius={6} />
          </View>
        ) : null}
        {results.map((city) => (
          <Row
            key={city.id}
            icon={<MapPin size={18} color={colors.ink} strokeWidth={1.9} />}
            title={city.name}
            hint={city.region || undefined}
            selected={
              place?.kind === 'city' &&
              Math.abs(place.latitude - city.latitude) < 0.01 &&
              Math.abs(place.longitude - city.longitude) < 0.01
            }
            onPress={() => pickCity(city)}
          />
        ))}
        {failed ? (
          <Text variant="bodySm" tone="muted" className="pt-3">
            Couldn’t reach the city search. Check your connection and try again.
          </Text>
        ) : null}
        {active && !searching && !failed && results.length === 0 ? (
          <Text variant="bodySm" tone="muted" className="pt-3">
            No city called “{name}”.
          </Text>
        ) : null}
        {!active && place?.kind === 'city' ? (
          <Row
            icon={<MapPin size={18} color={colors.ink} strokeWidth={1.9} />}
            title={place.name}
            hint="Chosen city"
            selected
            onPress={close}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

import { LocateFixed, MapPin, RotateCw, Settings, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { AnimatedPressable, Card, Skeleton, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { toDayKey } from '@/lib/dates';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';

import { dayForecast, updatedAgo } from './forecast';
import { useWeatherStore } from './store';
import { formatTemp } from './units';
import type { useWeather } from './useWeather';
import { WeatherIcon } from './WeatherIcon';
import { switchToDeviceLocation } from './WeatherPlaceSheet';
import { describeWeather } from './wmo';

type Weather = ReturnType<typeof useWeather>;

/** A pill on the green card: solid for the main action, outlined for the other. */
function CardPill({
  label,
  icon: Icon,
  solid,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  solid?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fg = solid ? colors.accentSecondary : colors.onAccentSecondary;
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      haptic="press"
      onPress={onPress}
      className={[
        'h-11 flex-row items-center gap-1.5 rounded-pill px-4',
        solid ? 'bg-on-accent-secondary' : 'border-[1.5px] border-on-accent-secondary/40',
      ].join(' ')}
    >
      <Icon size={16} color={fg} strokeWidth={2} />
      <Text variant="bodySm" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Card tone="secondary" radius="lg" padded={false} className="px-5 py-[18px]">
      {children}
    </Card>
  );
}

/** First time: why location helps, with a city as the alternative. */
function Explainer({ refused, onChooseCity }: { refused: 'denied' | 'blocked' | null; onChooseCity: () => void }) {
  const [asked, setAsked] = useState<'denied' | 'blocked' | null>(null);
  const state = asked ?? refused;
  const askForLocation = async () => {
    const result = await switchToDeviceLocation();
    if (result !== 'granted') {
      haptics.warning();
      setAsked(result);
    }
  };
  return (
    <Shell>
      <Text variant="eyebrow" tone="onAccentSecondary" className="opacity-80">
        Weather
      </Text>
      <Text variant="display3" tone="onAccentSecondary" className="mt-2" style={{ fontSize: 26, lineHeight: 29 }}>
        {state ? 'Pick a city instead' : 'Dress for today’s weather'}
      </Text>
      <Text variant="bodySm" tone="onAccentSecondary" className="mt-1.5 opacity-90">
        {state === 'blocked'
          ? 'Location is off for My Closet. Choose a city, or turn it on in Settings.'
          : state === 'denied'
            ? 'No problem. Choose a city and suggestions will follow its forecast.'
            : 'Share your location and suggestions follow the forecast. It’s only used to fetch the weather.'}
      </Text>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {state ? (
          <CardPill label="Choose a city" icon={MapPin} solid onPress={onChooseCity} />
        ) : (
          <CardPill label="Use my location" icon={LocateFixed} solid onPress={() => void askForLocation()} />
        )}
        {state === 'blocked' ? (
          <CardPill label="Open Settings" icon={Settings} onPress={() => void Linking.openSettings()} />
        ) : state ? null : (
          <CardPill label="Choose a city" icon={MapPin} onPress={onChooseCity} />
        )}
      </View>
    </Shell>
  );
}

function Loading() {
  return (
    <Shell>
      <Text variant="eyebrow" tone="onAccentSecondary" className="opacity-80">
        Now
      </Text>
      <View className="mt-2 gap-2.5" accessibilityLabel="Loading the weather">
        <Skeleton width={132} height={56} radius={14} />
        <Skeleton width="72%" height={12} radius={6} />
      </View>
    </Shell>
  );
}

/**
 * Today's weather card (Today.dc.html): temperature, conditions and
 * feels-like on the green card. Before the user has chosen, it explains why
 * location helps; offline it shows the last forecast with its age. Tap to
 * change the place; in development, hold for the temperature override.
 */
export function WeatherCard({
  weather,
  onChangePlace,
  onDevOverride,
}: {
  weather: Weather;
  onChangePlace: () => void;
  onDevOverride?: () => void;
}) {
  const { colors } = useTheme();
  const unit = usePreferences((s) => s.temperatureUnit);
  const { place, forecast, loading, error, override } = weather;
  const now = new Date();

  if (!place) return <Explainer refused={null} onChooseCity={onChangePlace} />;
  if (!forecast && !override) {
    if (error === 'denied' || error === 'blocked') return <Explainer refused={error} onChooseCity={onChangePlace} />;
    if (loading || !error) return <Loading />;
    return (
      <Shell>
        <Text variant="eyebrow" tone="onAccentSecondary" className="opacity-80">
          Weather
        </Text>
        <Text variant="display3" tone="onAccentSecondary" className="mt-2" style={{ fontSize: 24, lineHeight: 28 }}>
          {error === 'services_off' ? 'Location services are off' : 'Can’t reach the forecast'}
        </Text>
        <Text variant="bodySm" tone="onAccentSecondary" className="mt-1.5 opacity-90">
          {error === 'services_off'
            ? 'Turn them on, or choose a city instead.'
            : 'Suggestions use a mild, dry day until it’s back.'}
        </Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          <CardPill
            label="Try again"
            icon={RotateCw}
            solid
            onPress={() => void useWeatherStore.getState().refresh({ force: true })}
          />
          <CardPill label="Choose a city" icon={MapPin} onPress={onChangePlace} />
        </View>
      </Shell>
    );
  }

  const today = forecast ? dayForecast(forecast, toDayKey(now)) : null;
  const shown = override
    ? {
        tempC: override.feelsLikeC,
        feelsLikeC: override.feelsLikeC,
        code: override.rain ? 63 : 2,
        isDay: true,
        precipitationProbability: override.rain ? 90 : 0,
      }
    : forecast!.current;
  const info = describeWeather(shown.code, shown.isDay);
  const rain = Math.max(shown.precipitationProbability, override ? 0 : (today?.precipitationProbability ?? 0));
  const details = [
    `Feels like ${formatTemp(shown.feelsLikeC, unit)}`,
    today && !override ? `H ${formatTemp(today.maxC, unit)} L ${formatTemp(today.minC, unit)}` : null,
    `Rain ${Math.round(rain)}%`,
  ]
    .filter(Boolean)
    .join(' · ');
  const age = forecast && !override ? updatedAgo(forecast.fetchedAt, now.getTime()) : null;
  const eyebrow = override ? 'Dev override' : `Now · ${forecast?.place.name ?? ''}`;

  return (
    <AnimatedPressable
      accessibilityLabel={`Weather in ${forecast?.place.name ?? 'your area'}: ${formatTemp(shown.tempC, unit)}, ${info.summary}. ${details}${age ? `. ${age}` : ''}`}
      accessibilityHint="Changes where the weather is for"
      onPress={onChangePlace}
      onLongPress={__DEV__ ? onDevOverride : undefined}
      scaleTo={0.98}
      className="flex-row items-center gap-3 rounded-lg bg-accent-secondary py-[18px] pl-5 pr-[18px]"
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="eyebrow" tone="onAccentSecondary" numberOfLines={1} className="opacity-80">
          {eyebrow}
        </Text>
        <View className="flex-row items-end gap-2.5">
          <Text
            variant="display1"
            tone="onAccentSecondary"
            style={{ fontSize: 64, lineHeight: 64, letterSpacing: -2.8 }}
          >
            {formatTemp(shown.tempC, unit)}
          </Text>
          <Text
            variant="body"
            weight="semibold"
            tone="onAccentSecondary"
            numberOfLines={2}
            className="min-w-0 flex-1 pb-2"
          >
            {info.summary}
          </Text>
        </View>
        <Text
          variant="caption"
          tone="onAccentSecondary"
          style={{ fontSize: 13, lineHeight: 17 }}
          className="opacity-90"
        >
          {details}
        </Text>
        {age || (error && !override) ? (
          <Text variant="caption" tone="onAccentSecondary" className="mt-0.5 opacity-75">
            {[age, error === 'offline' ? 'offline' : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      <WeatherIcon name={info.icon} size={70} color={colors.onAccentSecondary} />
    </AnimatedPressable>
  );
}

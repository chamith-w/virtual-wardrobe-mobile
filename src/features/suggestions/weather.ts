/**
 * Weather → what an outfit needs: the temperature band, rain, and the
 * layers to add. Also the engine's view of a cached forecast for a day.
 * Pure — safe to import from tests.
 */
import type { Season } from '@/features/items/catalog';
import { toDayKey, type DayKey } from '@/lib/dates';
import { dayForecast, daytimeFeelsLike } from '@/features/weather/forecast';
import type { Forecast } from '@/features/weather/types';
import { describeWeather } from '@/features/weather/wmo';
import type { WeatherOverride } from '@/store/session';

import { SUGGESTION_CONFIG, type SuggestionConfig } from './config';

/** What the engine knows about the weather. */
export type EngineWeather = {
  feelsLikeC: number;
  /** 0–100. */
  precipitationProbability: number;
  /** WMO code, when known. */
  code: number | null;
};

export type Band = 'hot' | 'mild' | 'cold';

export type LayerPlan = {
  band: Band;
  rain: boolean;
  /**
   * The layer to add: none when hot, a light one when mild, outerwear when
   * cold. In hot rain a light waterproof layer is welcome but optional.
   */
  layer: 'none' | 'light' | 'outer';
  optionalWaterproofLayer: boolean;
  /** Cold: knitwear as the top or over it. */
  warm: boolean;
};

export function bandFor(feelsLikeC: number, config: SuggestionConfig = SUGGESTION_CONFIG): Band {
  if (feelsLikeC >= config.bands.hotFrom) return 'hot';
  if (feelsLikeC < config.bands.coldBelow) return 'cold';
  return 'mild';
}

export function isRainy(weather: EngineWeather, config: SuggestionConfig = SUGGESTION_CONFIG): boolean {
  if (weather.code !== null && describeWeather(weather.code).wet) return true;
  return weather.precipitationProbability >= config.rain.probabilityFrom;
}

/** No forecast: dress for a mild, dry day. */
export function layerPlan(weather: EngineWeather | null, config: SuggestionConfig = SUGGESTION_CONFIG): LayerPlan {
  const band = weather ? bandFor(weather.feelsLikeC, config) : 'mild';
  const rain = weather ? isRainy(weather, config) : false;
  return {
    band,
    rain,
    layer: band === 'hot' ? 'none' : band === 'mild' ? 'light' : 'outer',
    optionalWaterproofLayer: band === 'hot' && rain,
    warm: band === 'cold',
  };
}

/** Meteorological season, flipped south of the equator. */
export function seasonFor(date: Date, latitude?: number | null): Season {
  const m = date.getMonth();
  const north: Season = m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
  if (latitude === undefined || latitude === null || latitude >= 0) return north;
  const flip: Record<Season, Season> = { winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' };
  return flip[north];
}

/**
 * The engine's weather for a day: the dev override if set; right now for
 * today (what the card shows), with the day's chance of rain; a day's
 * daytime feel otherwise. Null when the forecast doesn't reach that day.
 */
export function engineWeatherFor(
  forecast: Forecast | null,
  day: DayKey,
  today: Date,
  override: WeatherOverride | null = null,
): EngineWeather | null {
  if (override) {
    return {
      feelsLikeC: override.feelsLikeC,
      precipitationProbability: override.rain ? 90 : 0,
      code: override.rain ? 63 : 2,
    };
  }
  if (!forecast) return null;
  const daily = dayForecast(forecast, day);
  if (day === toDayKey(today)) {
    const c = forecast.current;
    return {
      feelsLikeC: c.feelsLikeC,
      precipitationProbability: Math.max(c.precipitationProbability, daily?.precipitationProbability ?? 0),
      code: c.code,
    };
  }
  if (!daily) return null;
  return {
    feelsLikeC: daytimeFeelsLike(daily),
    precipitationProbability: daily.precipitationProbability,
    code: daily.code,
  };
}

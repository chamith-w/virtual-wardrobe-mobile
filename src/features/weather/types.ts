import type { DayKey } from '@/lib/dates';

/** Where the weather comes from: the device's location, or a city picked by hand. */
export type Place = {
  name: string;
  latitude: number;
  longitude: number;
  source: 'device' | 'city';
};

/** Right now. Temperatures are always stored in °C; units apply only on screen. */
export type CurrentWeather = {
  tempC: number;
  feelsLikeC: number;
  /** WMO weather code. */
  code: number;
  isDay: boolean;
  /** 0–100. */
  precipitationProbability: number;
};

/** One day of the forecast, keyed by the place's local calendar day. */
export type DayForecast = {
  date: DayKey;
  code: number;
  maxC: number;
  minC: number;
  feelsMaxC: number;
  feelsMinC: number;
  precipitationProbability: number;
};

/** The last forecast fetched: kept in the kv-store and shown offline. */
export type Forecast = {
  place: Place;
  /** ms epoch. */
  fetchedAt: number;
  current: CurrentWeather;
  /** From a week ago to about two weeks ahead, oldest first. */
  daily: DayForecast[];
};

/** A city from the manual fallback search. */
export type CityResult = {
  id: number;
  name: string;
  /** "Lisbon District, Portugal" */
  region: string;
  latitude: number;
  longitude: number;
};

/**
 * Open-Meteo (no key): the forecast and the city search used when location is
 * off. Parsing is pure and tested; the fetches are thin wrappers.
 * https://open-meteo.com/en/docs
 */
import { addDays, toDayKey, type DayKey } from '@/lib/dates';

import type { CityResult, CurrentWeather, DayForecast, Forecast, Place } from './types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
/** The forecast reaches this many days ahead (today included). */
export const FORECAST_DAYS = 16;
/** And this many days back, so a log for last week still gets its weather. */
export const PAST_DAYS = 7;
const TIMEOUT_MS = 12_000;

const CURRENT_FIELDS = 'temperature_2m,apparent_temperature,weather_code,precipitation_probability,is_day';
const DAILY_FIELDS =
  'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max';

type Json = Record<string, unknown>;

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function parseCurrent(json: Json): CurrentWeather | null {
  const c = json.current as Json | undefined;
  if (!c || typeof c.temperature_2m !== 'number') return null;
  return {
    tempC: c.temperature_2m,
    feelsLikeC: num(c.apparent_temperature, c.temperature_2m),
    code: num(c.weather_code),
    isDay: c.is_day !== 0,
    precipitationProbability: num(c.precipitation_probability),
  };
}

/** The `daily` block as one row per day; days with no temperatures are dropped. */
export function parseDaily(json: Json): DayForecast[] {
  const d = (json.daily ?? {}) as Json;
  const days = arr(d.time);
  const out: DayForecast[] = [];
  days.forEach((date, i) => {
    const max = arr(d.temperature_2m_max)[i];
    const min = arr(d.temperature_2m_min)[i];
    if (typeof date !== 'string' || typeof max !== 'number' || typeof min !== 'number') return;
    out.push({
      date,
      code: num(arr(d.weather_code)[i]),
      maxC: max,
      minC: min,
      feelsMaxC: num(arr(d.apparent_temperature_max)[i], max),
      feelsMinC: num(arr(d.apparent_temperature_min)[i], min),
      precipitationProbability: num(arr(d.precipitation_probability_max)[i]),
    });
  });
  return out;
}

export function parseCities(json: Json): CityResult[] {
  return arr(json.results).flatMap((r) => {
    const row = r as Json;
    if (typeof row.name !== 'string' || typeof row.latitude !== 'number' || typeof row.longitude !== 'number')
      return [];
    const region = [row.admin1, row.country].filter((x): x is string => typeof x === 'string' && x !== row.name);
    return [
      {
        id: num(row.id),
        name: row.name,
        region: [...new Set(region)].join(', '),
        latitude: row.latitude,
        longitude: row.longitude,
      },
    ];
  });
}

async function getJson(url: string): Promise<Json> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    return (await res.json()) as Json;
  } finally {
    clearTimeout(timer);
  }
}

const coords = (lat: number, lon: number) => `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`;

/** Current conditions plus a week back and ~two weeks ahead, in °C, in the place's own days. */
export async function fetchForecast(place: Place, now = new Date()): Promise<Forecast> {
  const json = await getJson(
    `${FORECAST_URL}?${coords(place.latitude, place.longitude)}&current=${CURRENT_FIELDS}&daily=${DAILY_FIELDS}` +
      `&timezone=auto&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}`,
  );
  const current = parseCurrent(json);
  if (!current) throw new Error('Open-Meteo: no current conditions');
  return { place, fetchedAt: now.getTime(), current, daily: parseDaily(json) };
}

/**
 * Daily forecast for a date range at any place (packing lists, phase 7).
 * Only the part within the forecast window comes back; a range wholly
 * beyond it resolves to an empty list.
 */
export async function fetchDailyRange(
  latitude: number,
  longitude: number,
  start: DayKey,
  end: DayKey,
  today = new Date(),
): Promise<DayForecast[]> {
  const last = toDayKey(addDays(today, FORECAST_DAYS - 1));
  const first = toDayKey(addDays(today, -PAST_DAYS));
  const from = start < first ? first : start;
  const to = end > last ? last : end;
  if (from > to) return [];
  const json = await getJson(
    `${FORECAST_URL}?${coords(latitude, longitude)}&daily=${DAILY_FIELDS}&timezone=auto&start_date=${from}&end_date=${to}`,
  );
  return parseDaily(json);
}

/** Cities matching a name, for the manual fallback. Needs at least two letters. */
export async function searchCities(query: string, language = 'en'): Promise<CityResult[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const json = await getJson(
    `${GEOCODING_URL}?name=${encodeURIComponent(name)}&count=8&language=${language}&format=json`,
  );
  return parseCities(json);
}

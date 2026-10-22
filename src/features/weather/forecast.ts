/**
 * Reading a cached forecast: the weather for a given day, what a wear log
 * keeps, and the "updated 3h ago" note. Pure — safe to import from tests.
 */
import type { WeatherSnapshot } from '@/db/schema';
import type { DayKey } from '@/lib/dates';

import type { CurrentWeather, DayForecast, Forecast } from './types';
import { describeWeather } from './wmo';

/** Older than this, the cache is refreshed when weather is next shown. */
export const STALE_AFTER_MS = 30 * 60_000;
/** Older than this, the card says how old it is. */
export const SHOW_AGE_AFTER_MS = 60 * 60_000;

export function isStale(forecast: Pick<Forecast, 'fetchedAt'>, now: number): boolean {
  return now - forecast.fetchedAt > STALE_AFTER_MS;
}

/** "Updated 3h ago", or null while it's fresh. */
export function updatedAgo(fetchedAt: number, now: number): string | null {
  const ms = now - fetchedAt;
  if (ms < SHOW_AGE_AFTER_MS) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Updated yesterday' : `Updated ${days} days ago`;
}

export function dayForecast(forecast: Forecast | null, day: DayKey): DayForecast | null {
  return forecast?.daily.find((d) => d.date === day) ?? null;
}

/**
 * How a whole day feels: weighted towards the afternoon high, since that's
 * when you're out in what you put on in the morning.
 */
export function daytimeFeelsLike(day: Pick<DayForecast, 'feelsMaxC' | 'feelsMinC'>): number {
  return day.feelsMaxC * 0.65 + day.feelsMinC * 0.35;
}

/** What a wear log keeps: right now for today, the day's forecast otherwise. */
export function snapshotFromCurrent(current: CurrentWeather): WeatherSnapshot {
  return {
    tempC: Math.round(current.tempC * 10) / 10,
    feelsLikeC: Math.round(current.feelsLikeC * 10) / 10,
    code: current.code,
    summary: describeWeather(current.code, current.isDay).summary,
    precipitationProbability: current.precipitationProbability,
  };
}

export function snapshotFromDay(day: DayForecast): WeatherSnapshot {
  return {
    tempC: Math.round(day.maxC * 10) / 10,
    feelsLikeC: Math.round(daytimeFeelsLike(day) * 10) / 10,
    code: day.code,
    summary: describeWeather(day.code).summary,
    precipitationProbability: day.precipitationProbability,
  };
}

/** The weather to attach to a log for `day`, if the cache knows it. */
export function snapshotForDay(forecast: Forecast | null, day: DayKey, today: DayKey): WeatherSnapshot | null {
  if (!forecast) return null;
  if (day === today) return snapshotFromCurrent(forecast.current);
  const d = dayForecast(forecast, day);
  return d ? snapshotFromDay(d) : null;
}

import { addDays, toDayKey } from '@/lib/dates';

import { daytimeFeelsLike, isStale, snapshotForDay, updatedAgo } from './forecast';
import { parseCities, parseCurrent, parseDaily } from './openMeteo';
import { forecastMatches } from './store';
import type { Forecast } from './types';
import { celsiusToFahrenheit, formatTemp, inUnit } from './units';
import { describeWeather } from './wmo';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: () => null, setItemSync: () => {}, removeItemSync: () => {} },
}));
jest.mock('expo-location', () => ({}));

describe('WMO codes', () => {
  it('maps codes to a summary, an icon and whether it is wet', () => {
    expect(describeWeather(0)).toEqual({ summary: 'Clear', icon: 'sun', wet: false });
    expect(describeWeather(2)).toEqual({ summary: 'Partly cloudy', icon: 'cloud-sun', wet: false });
    expect(describeWeather(45).icon).toBe('fog');
    expect(describeWeather(53)).toMatchObject({ icon: 'drizzle', wet: true });
    expect(describeWeather(63)).toMatchObject({ summary: 'Rain', icon: 'rain', wet: true });
    expect(describeWeather(81)).toMatchObject({ summary: 'Showers', icon: 'rain', wet: true });
    expect(describeWeather(66).icon).toBe('sleet');
    expect(describeWeather(75)).toMatchObject({ icon: 'snow', wet: true });
    expect(describeWeather(95)).toMatchObject({ icon: 'storm', wet: true });
  });

  it('shows the moon at night and plain cloud for unknown codes', () => {
    expect(describeWeather(0, false).icon).toBe('moon');
    expect(describeWeather(1, false).icon).toBe('cloud-moon');
    expect(describeWeather(3, false).icon).toBe('cloud');
    expect(describeWeather(42)).toEqual({ summary: 'Cloudy', icon: 'cloud', wet: false });
  });
});

describe('units', () => {
  it('converts and rounds', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(inUnit(24.4, 'celsius')).toBe(24);
    expect(inUnit(24, 'fahrenheit')).toBe(75);
    expect(inUnit(-0.3, 'celsius')).toBe(0);
    expect(Object.is(inUnit(-0.3, 'celsius'), -0)).toBe(false);
    expect(formatTemp(-17.8, 'fahrenheit')).toBe('0°');
    expect(formatTemp(21.6, 'celsius')).toBe('22°');
  });
});

describe('Open-Meteo parsing', () => {
  const json = {
    current: {
      temperature_2m: 20.1,
      apparent_temperature: 18.4,
      weather_code: 1,
      precipitation_probability: 0,
      is_day: 0,
    },
    daily: {
      time: ['2026-10-22', '2026-10-23', '2026-10-24'],
      weather_code: [3, 61, 80],
      temperature_2m_max: [20.1, 22.3, null],
      temperature_2m_min: [8.4, 12.5, 9],
      apparent_temperature_max: [18.6, 20.3, 21],
      apparent_temperature_min: [6.7, 11.4, 7.7],
      precipitation_probability_max: [0, 70, 20],
    },
  };

  it('reads current conditions', () => {
    expect(parseCurrent(json)).toEqual({
      tempC: 20.1,
      feelsLikeC: 18.4,
      code: 1,
      isDay: false,
      precipitationProbability: 0,
    });
    expect(parseCurrent({})).toBeNull();
  });

  it('reads the daily rows, dropping days without temperatures', () => {
    const days = parseDaily(json);
    expect(days.map((d) => d.date)).toEqual(['2026-10-22', '2026-10-23']);
    expect(days[1]).toEqual({
      date: '2026-10-23',
      code: 61,
      maxC: 22.3,
      minC: 12.5,
      feelsMaxC: 20.3,
      feelsMinC: 11.4,
      precipitationProbability: 70,
    });
  });

  it('reads city search results with their region', () => {
    const cities = parseCities({
      results: [
        { id: 1, name: 'Lisbon', latitude: 38.7, longitude: -9.1, admin1: 'Lisbon District', country: 'Portugal' },
        { id: 2, name: 'Monaco', latitude: 43.7, longitude: 7.4, admin1: 'Monaco', country: 'Monaco' },
        { id: 3, name: 'Broken' },
      ],
    });
    expect(cities).toEqual([
      { id: 1, name: 'Lisbon', region: 'Lisbon District, Portugal', latitude: 38.7, longitude: -9.1 },
      { id: 2, name: 'Monaco', region: '', latitude: 43.7, longitude: 7.4 },
    ]);
    expect(parseCities({})).toEqual([]);
  });
});

describe('reading the cache', () => {
  const now = new Date(2026, 9, 22, 9);
  const today = toDayKey(now);
  const forecast: Forecast = {
    place: { name: 'Lisbon', latitude: 38.7, longitude: -9.1, source: 'city' },
    fetchedAt: now.getTime() - 3 * 3_600_000,
    current: { tempC: 20, feelsLikeC: 18, code: 2, isDay: true, precipitationProbability: 10 },
    daily: [
      { date: today, code: 3, maxC: 21, minC: 9, feelsMaxC: 20, feelsMinC: 8, precipitationProbability: 5 },
      {
        date: toDayKey(addDays(now, 1)),
        code: 61,
        maxC: 18,
        minC: 12,
        feelsMaxC: 17,
        feelsMinC: 11,
        precipitationProbability: 80,
      },
    ],
  };

  it('says how old it is once it is over an hour', () => {
    expect(updatedAgo(now.getTime() - 20 * 60_000, now.getTime())).toBeNull();
    expect(updatedAgo(forecast.fetchedAt, now.getTime())).toBe('Updated 3h ago');
    expect(updatedAgo(now.getTime() - 30 * 3_600_000, now.getTime())).toBe('Updated yesterday');
    expect(updatedAgo(now.getTime() - 80 * 3_600_000, now.getTime())).toBe('Updated 3 days ago');
    expect(isStale(forecast, now.getTime())).toBe(true);
  });

  it('weights a day towards its afternoon high', () => {
    expect(daytimeFeelsLike({ feelsMaxC: 20, feelsMinC: 10 })).toBeCloseTo(16.5);
  });

  it('gives a log right now for today and the day forecast otherwise', () => {
    expect(snapshotForDay(forecast, today, today)).toMatchObject({
      tempC: 20,
      feelsLikeC: 18,
      summary: 'Partly cloudy',
    });
    expect(snapshotForDay(forecast, toDayKey(addDays(now, 1)), today)).toMatchObject({
      tempC: 18,
      summary: 'Light rain',
      precipitationProbability: 80,
    });
    expect(snapshotForDay(forecast, '2026-01-01', today)).toBeNull();
    expect(snapshotForDay(null, today, today)).toBeNull();
  });

  it('only uses a cached forecast for the place the user chose', () => {
    expect(forecastMatches({ kind: 'city', name: 'Lisbon', latitude: 38.7, longitude: -9.1 }, forecast)).toBe(true);
    expect(forecastMatches({ kind: 'city', name: 'Porto', latitude: 41.1, longitude: -8.6 }, forecast)).toBe(false);
    expect(forecastMatches({ kind: 'device' }, forecast)).toBe(false);
    expect(forecastMatches(null, forecast)).toBe(false);
  });
});

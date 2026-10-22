/**
 * Temperatures are fetched, cached and reasoned about in °C; the user's unit
 * only applies when one is shown. Pure — safe to import from tests.
 */
import type { TemperatureUnit } from '@/store/preferences';

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/** A °C value in the given unit, rounded to a whole degree. */
export function inUnit(c: number, unit: TemperatureUnit): number {
  const value = unit === 'fahrenheit' ? celsiusToFahrenheit(c) : c;
  // Avoid "-0°".
  return Math.round(value) || 0;
}

/** "24°": the unit is implied, as on most weather screens. */
export function formatTemp(c: number, unit: TemperatureUnit): string {
  return `${inUnit(c, unit)}°`;
}

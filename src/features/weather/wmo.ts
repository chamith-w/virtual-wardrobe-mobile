/**
 * WMO weather codes (the ones Open-Meteo returns) → a short summary and an
 * icon. Pure — safe to import from tests.
 */

export type WeatherIconName =
  'sun' | 'moon' | 'cloud-sun' | 'cloud-moon' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'sleet' | 'snow' | 'storm';

export type WmoInfo = {
  summary: string;
  icon: WeatherIconName;
  /** Rain, drizzle, sleet, snow or a storm: the engine reaches for waterproofs. */
  wet: boolean;
};

const TABLE: Record<number, [summary: string, icon: WeatherIconName, wet: boolean]> = {
  0: ['Clear', 'sun', false],
  1: ['Mainly clear', 'cloud-sun', false],
  2: ['Partly cloudy', 'cloud-sun', false],
  3: ['Overcast', 'cloud', false],
  45: ['Fog', 'fog', false],
  48: ['Freezing fog', 'fog', false],
  51: ['Light drizzle', 'drizzle', true],
  53: ['Drizzle', 'drizzle', true],
  55: ['Heavy drizzle', 'drizzle', true],
  56: ['Freezing drizzle', 'sleet', true],
  57: ['Freezing drizzle', 'sleet', true],
  61: ['Light rain', 'rain', true],
  63: ['Rain', 'rain', true],
  65: ['Heavy rain', 'rain', true],
  66: ['Freezing rain', 'sleet', true],
  67: ['Freezing rain', 'sleet', true],
  71: ['Light snow', 'snow', true],
  73: ['Snow', 'snow', true],
  75: ['Heavy snow', 'snow', true],
  77: ['Snow grains', 'snow', true],
  80: ['Light showers', 'rain', true],
  81: ['Showers', 'rain', true],
  82: ['Heavy showers', 'rain', true],
  85: ['Snow showers', 'snow', true],
  86: ['Heavy snow showers', 'snow', true],
  95: ['Thunderstorm', 'storm', true],
  96: ['Thunderstorm, hail', 'storm', true],
  99: ['Thunderstorm, hail', 'storm', true],
};

/** Clear skies at night show the moon. Unknown codes read as plain cloud. */
export function describeWeather(code: number, isDay = true): WmoInfo {
  const row = TABLE[code];
  if (!row) return { summary: 'Cloudy', icon: 'cloud', wet: false };
  const [summary, icon, wet] = row;
  if (!isDay && icon === 'sun') return { summary, icon: 'moon', wet };
  if (!isDay && icon === 'cloud-sun') return { summary, icon: 'cloud-moon', wet };
  return { summary, icon, wet };
}

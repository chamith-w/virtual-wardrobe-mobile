import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';

import type { WeatherIconName } from './wmo';

const ICONS: Record<WeatherIconName, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  'cloud-sun': CloudSun,
  'cloud-moon': CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  sleet: CloudHail,
  snow: CloudSnow,
  storm: CloudLightning,
};

/** A WMO condition as a line icon (the prototype draws them at a fine 1.1 stroke when large). */
export function WeatherIcon({
  name,
  size,
  color,
  strokeWidth,
}: {
  name: WeatherIconName;
  size: number;
  color: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth ?? (size > 40 ? 1.1 : 1.8)} />;
}

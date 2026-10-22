/**
 * The device's location for the weather. Permission is asked only from the
 * explainer card, the first time weather is shown (expo-location, SDK 57).
 */
import * as Location from 'expo-location';

import type { Place } from './types';

export type LocationAccess = 'granted' | 'undetermined' | 'denied' | 'blocked';

/** Thrown when the device can't give a position; `reason` picks the card's copy. */
export class LocationUnavailable extends Error {
  constructor(readonly reason: 'denied' | 'blocked' | 'services_off') {
    super(`Location unavailable: ${reason}`);
  }
}

function toAccess(r: Location.LocationPermissionResponse): LocationAccess {
  if (r.granted) return 'granted';
  if (r.status === 'undetermined') return 'undetermined';
  return r.canAskAgain ? 'denied' : 'blocked';
}

export async function locationAccess(): Promise<LocationAccess> {
  return toAccess(await Location.getForegroundPermissionsAsync());
}

/** Shows the system prompt (when it still can). */
export async function requestLocationAccess(): Promise<LocationAccess> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted || !current.canAskAgain) return toAccess(current);
  return toAccess(await Location.requestForegroundPermissionsAsync());
}

/** A fix from the last hour is plenty for weather; otherwise ask for a coarse one. */
const LAST_KNOWN_MAX_AGE_MS = 60 * 60_000;

async function cityName(latitude: number, longitude: number): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return address?.city ?? address?.subregion ?? address?.region ?? 'Current location';
  } catch {
    return 'Current location';
  }
}

/** Where the device is, named by its town. Throws LocationUnavailable. */
export async function devicePlace(): Promise<Place> {
  const access = await locationAccess();
  if (access !== 'granted') throw new LocationUnavailable(access === 'blocked' ? 'blocked' : 'denied');
  if (!(await Location.hasServicesEnabledAsync())) throw new LocationUnavailable('services_off');
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  const { latitude, longitude } = position.coords;
  return { name: await cityName(latitude, longitude), latitude, longitude, source: 'device' };
}

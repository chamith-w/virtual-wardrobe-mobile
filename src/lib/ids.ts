import { randomUUID } from 'expo-crypto';

/** UUID v4 for every primary key (sync-friendly, generated on device). */
export const newId = (): string => randomUUID();

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'my-closet.db';

/**
 * `enableChangeListener` powers Drizzle's `useLiveQuery`, so screens re-render
 * whenever the rows they read change — no manual refetching.
 */
export const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export type Database = typeof db;

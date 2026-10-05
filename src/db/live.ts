import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState, type DependencyList } from 'react';

export type LiveData<T> = { data: T; loaded: boolean };

/**
 * Reactive read for queries that join tables. Drizzle's `useLiveQuery` only
 * re-runs when the FROM table changes and once per changed row; this re-runs
 * when any of `tables` changes, coalescing a burst of row events (one
 * transaction) into a single refetch. `loaded` lets screens show skeletons
 * instead of a flash of the empty state.
 */
export function useLiveData<T>(
  load: () => Promise<T>,
  tables: readonly SQLiteTable[],
  deps: DependencyList,
  initial: T,
): LiveData<T> {
  const [state, setState] = useState<LiveData<T>>({ data: initial, loaded: false });

  useEffect(() => {
    let alive = true;
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const names = tables.map((t) => getTableConfig(t).name);

    const refresh = () => {
      scheduled = null;
      load()
        .then((data) => {
          if (alive) setState({ data, loaded: true });
        })
        .catch((error: unknown) => {
          console.warn('[useLiveData]', error);
          if (alive) setState((s) => ({ ...s, loaded: true }));
        });
    };

    refresh();
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (!names.includes(tableName) || scheduled) return;
      scheduled = setTimeout(refresh, 16);
    });

    return () => {
      alive = false;
      if (scheduled) clearTimeout(scheduled);
      subscription.remove();
    };
    // The caller's deps describe the query; `load` and `tables` are rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, type Item } from '@/db/schema';

/** One item, full row (detail screen). `item` is undefined until loaded or if it doesn't exist. */
export function useItem(id: string | undefined) {
  const { data, loaded } = useLiveData(
    () =>
      db
        .select()
        .from(items)
        .where(eq(items.id, id ?? ''))
        .limit(1),
    [items],
    [id],
    [] as Item[],
  );
  const item = data[0];
  return { item: item && !item.deletedAt ? item : undefined, loaded };
}

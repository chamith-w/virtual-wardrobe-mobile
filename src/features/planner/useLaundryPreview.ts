import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, wearLogItems, wearLogs } from '@/db/schema';
import type { DayKey } from '@/lib/dates';
import { usePreferences } from '@/store/preferences';

import { statusAfterWear, type WornPiece } from './logEffects';

/**
 * Which of these pieces logging `day` would send straight to the basket,
 * by the auto-laundry rule (only ever for today's log).
 */
export function useLaundryPreview(itemIds: readonly string[], day: DayKey, today: DayKey): ReadonlySet<string> {
  const rules = usePreferences((s) => s.autoLaundry);
  const key = [...itemIds].sort().join(',');
  const { data } = useLiveData(
    async () => {
      const ids = key ? key.split(',') : [];
      if (ids.length === 0 || day !== today) return [];
      const rows = await db
        .select({ id: items.id, category: items.category, status: items.status, washedAt: items.washedAt })
        .from(items)
        .where(inArray(items.id, ids));
      const worn = await db
        .select({ itemId: wearLogItems.itemId, date: wearLogs.date })
        .from(wearLogItems)
        .innerJoin(wearLogs, and(eq(wearLogs.id, wearLogItems.wearLogId), isNull(wearLogs.deletedAt)))
        .where(and(inArray(wearLogItems.itemId, ids), isNull(wearLogItems.deletedAt)));
      return rows.map((r): WornPiece & { id: string } => ({
        ...r,
        wearDays: [...worn.filter((w) => w.itemId === r.id && w.date !== day).map((w) => w.date), day],
      }));
    },
    [items, wearLogItems, wearLogs],
    [key, day, today],
    [] as (WornPiece & { id: string })[],
  );
  return new Set(data.filter((r) => statusAfterWear(r, day, today, rules) === 'laundry').map((r) => r.id));
}

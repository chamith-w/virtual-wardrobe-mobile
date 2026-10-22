/**
 * The Planner's "Suggest one": the engine with that day's forecast. Planning
 * ahead counts pieces that are only out for the wash as available, and the
 * plans around the day count as wear, so a week of suggestions doesn't repeat
 * itself. Pure — safe to import from tests.
 */
import {
  pickDiverse,
  suggestOutfits,
  type Suggestion,
  type SuggestInput,
  type WearDay,
} from '@/features/suggestions/engine';
import type { SuggestItem } from '@/features/suggestions/garments';
import { daySeed } from '@/features/suggestions/random';
import type { EngineWeather } from '@/features/suggestions/weather';
import { daysBetween, fromDayKey, toDayKey, type DayKey } from '@/lib/dates';

/** Plans this many days either side of a day count as wear when suggesting for it. */
const PLAN_WINDOW = 3;

export function suggestionInputFor(args: {
  day: DayKey;
  now: Date;
  items: readonly SuggestItem[];
  logs: readonly WearDay[];
  plans: readonly WearDay[];
  weather: EngineWeather | null;
  latitude: number | null;
}): SuggestInput {
  const { day, now, items, logs, plans, weather, latitude } = args;
  const date = fromDayKey(day);
  date.setHours(12, 0, 0, 0);
  const near = plans.filter((p) => p.date !== day && Math.abs(daysBetween(fromDayKey(p.date), date)) <= PLAN_WINDOW);
  return {
    items,
    weather,
    // Around a future day, a planned outfit counts as if worn on its day.
    recentWear: [...logs.filter((l) => l.date < day), ...near.filter((p) => p.date < day)],
    today: date,
    latitude,
    seed: daySeed(day),
    available: day === toDayKey(now) ? ['in_wardrobe'] : ['in_wardrobe', 'worn', 'laundry'],
  };
}

/** The best look for the day that isn't `avoid` (the current plan), or null. */
export function suggestForDay(input: SuggestInput, avoid: readonly string[] = []): Suggestion | null {
  const ranked = suggestOutfits(input);
  const avoidKey = [...avoid].sort().join('|');
  return (
    pickDiverse(
      ranked.filter((s) => s.key !== avoidKey),
      1,
    )[0] ?? null
  );
}

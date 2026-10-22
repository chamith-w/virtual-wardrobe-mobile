/**
 * Words on the suggestion cards (Today.dc.html): tags, the meta line and the
 * "Wear it again" nudge. Temperatures arrive already formatted ("24°").
 * Pure — safe to import from tests.
 */
import { OCCASION_LABEL } from '@/features/items/catalog';

import type { Suggestion } from './engine';

/** "3 weeks", "4 months", "112 days"… for how long a piece has been idle. */
export function idleSpan(days: number): string {
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  const months = Math.round(days / 30.4);
  return months >= 12 ? (months < 24 ? 'a year' : `${Math.floor(months / 12)} years`) : `${months} months`;
}

/** Two tags for the board's corner: the temperature, then the outfit's best trait. */
export function suggestionTags(s: Suggestion, temp: string | null, extra?: string): string[] {
  const t = s.traits;
  const trait =
    extra ??
    (t.waterproof
      ? 'Rain-ready'
      : t.underworn
        ? 'Under-worn'
        : t.favorite
          ? 'Favourite'
          : t.fresh
            ? 'Fresh picks'
            : t.layered
              ? 'Light layer'
              : null);
  return [temp ? `Fits ${temp}` : null, trait].filter((x): x is string => !!x);
}

/** "Work · light layer for 24°", "Weekend · not worn in 3 weeks". */
export function suggestionMeta(s: Suggestion, temp: string | null): string {
  const occasion = s.traits.occasion ? OCCASION_LABEL[s.traits.occasion] : `${s.itemIds.length} pieces`;
  if (s.traits.underworn && s.traits.underworn.idleDays >= 21)
    return `${occasion} · not worn in ${idleSpan(s.traits.underworn.idleDays)}`;
  const what = s.plan.rain
    ? s.traits.waterproof
      ? 'rain-ready'
      : 'take an umbrella'
    : s.plan.band === 'cold'
      ? 'warm layers'
      : s.plan.band === 'hot'
        ? 'no layers needed'
        : s.traits.layered
          ? 'light layer'
          : 'easy layers';
  return temp ? `${occasion} · ${what} for ${temp}` : `${occasion} · ${what}`;
}

/** Under the "Wear it again" piece. */
export function wearAgainLine(idleDays: number, neverWorn: boolean): string {
  if (neverWorn) return `Not worn yet, and it’s been ${idleSpan(idleDays)}. Try it with:`;
  return `Not worn in ${idleDays} days. Try it with:`;
}

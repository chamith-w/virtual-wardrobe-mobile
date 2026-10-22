/**
 * Today's outfit carousel: three cards, each a look. A day's plan, if any,
 * leads; the engine's diverse picks fill the rest. Shuffle swaps one card for
 * the next-best look that stays diverse against the others. When pieces go
 * out (worn elsewhere, into the wash) a card that needed them is replaced,
 * unless it's the one worn today. Pure — safe to import from tests.
 */
import { nextDiverse, pickDiverse, type Suggestion } from '@/features/suggestions/engine';
import { SUGGESTION_CONFIG } from '@/features/suggestions/config';

export type LookCard = {
  key: string;
  itemIds: string[];
  /** The engine's look, or null for a plan. */
  suggestion: Suggestion | null;
  plan: { outfitId: string; name: string } | null;
};

export type Carousel = {
  /** What the cards were picked for (day, weather band, plan); a new basis starts over. */
  basis: string;
  cards: LookCard[];
  /** Keys each card has shown, so Shuffle moves on before it repeats. */
  shown: string[][];
};

export const CAROUSEL_SIZE = 3;

export function cardFromSuggestion(s: Suggestion): LookCard {
  return { key: s.key, itemIds: s.itemIds, suggestion: s, plan: null };
}

/** Worn today: every piece on the card is in today's log. */
export function isWornCard(card: Pick<LookCard, 'itemIds'>, wornToday: ReadonlySet<string>): boolean {
  return card.itemIds.length > 0 && card.itemIds.every((id) => wornToday.has(id));
}

export function startCarousel(
  ranked: readonly Suggestion[],
  basis: string,
  lead: LookCard | null,
  keep: readonly LookCard[] = [],
  maxShared: number = SUGGESTION_CONFIG.diversity.maxShared,
): Carousel {
  const fixed = [...(lead ? [lead] : []), ...keep.filter((k) => k.key !== lead?.key)].slice(0, CAROUSEL_SIZE);
  const cards = [
    ...fixed,
    ...pickDiverse(ranked, CAROUSEL_SIZE - fixed.length, maxShared, fixed).map(cardFromSuggestion),
  ];
  return { basis, cards, shown: cards.map((c) => [c.key]) };
}

/** Shuffle card `index`; null when nothing else fits. */
export function shuffleCard(c: Carousel, ranked: readonly Suggestion[], index: number): Carousel | null {
  const card = c.cards[index];
  if (!card) return null;
  const others = c.cards.filter((_, i) => i !== index);
  const next = nextDiverse(ranked, others, card.key, new Set(c.shown[index] ?? []));
  if (!next) return null;
  return {
    ...c,
    cards: c.cards.map((x, i) => (i === index ? cardFromSuggestion(next) : x)),
    shown: c.shown.map((keys, i) => (i === index ? [...keys, next.key] : keys)),
  };
}

/**
 * Cards whose pieces aren't all available any more are replaced (or dropped
 * when nothing fits); worn-today and planned cards stay. Returns the same
 * object when nothing changed.
 */
export function reconcileCarousel(
  c: Carousel,
  ranked: readonly Suggestion[],
  isAvailable: (id: string) => boolean,
  wornToday: ReadonlySet<string>,
): Carousel {
  const stale = (card: LookCard) => !card.plan && !isWornCard(card, wornToday) && !card.itemIds.every(isAvailable);
  if (!c.cards.some(stale)) return c;
  let next: Carousel = c;
  for (let i = 0; i < next.cards.length; i++) {
    const card = next.cards[i]!;
    if (!stale(card)) continue;
    const swapped = shuffleCard(next, ranked, i);
    next = swapped ?? {
      ...next,
      cards: next.cards.filter((_, j) => j !== i),
      shown: next.shown.filter((_, j) => j !== i),
    };
    if (!swapped) i--;
  }
  return next;
}

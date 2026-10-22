import { sharedCount, type Suggestion } from '@/features/suggestions/engine';
import { layerPlan } from '@/features/suggestions/weather';

import { reconcileCarousel, shuffleCard, startCarousel, type LookCard } from './carousel';

const look = (ids: string[], score: number): Suggestion => ({
  key: [...ids].sort().join('|'),
  itemIds: ids,
  score,
  harmony: 0.8,
  plan: layerPlan(null),
  traits: {
    layered: false,
    warm: false,
    waterproof: false,
    favorite: false,
    fresh: true,
    underworn: null,
    occasion: null,
  },
});

// Ranked best first. Tops t1–t4, bottoms b1–b3, shoes s1–s3.
const ranked = [
  look(['t1', 'b1', 's1'], 9),
  look(['t1', 'b2', 's1'], 8),
  look(['t2', 'b2', 's2'], 7),
  look(['t3', 'b3', 's3'], 6),
  look(['t4', 'b1', 's2'], 5),
  look(['t2', 'b3', 's1'], 4),
];

const diverse = (cards: readonly LookCard[]) => {
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) expect(sharedCount(cards[i]!, cards[j]!)).toBeLessThanOrEqual(1);
};

describe('Today’s carousel', () => {
  it('starts with three diverse looks, best first', () => {
    const c = startCarousel(ranked, 'day', null);
    expect(c.cards.map((x) => x.key)).toEqual([ranked[0]!.key, ranked[2]!.key, ranked[3]!.key]);
    diverse(c.cards);
  });

  it('leads with the day’s plan and keeps the picks diverse against it', () => {
    const plan: LookCard = {
      key: 'p',
      itemIds: ['t1', 'b1', 's3'],
      suggestion: null,
      plan: { outfitId: 'o', name: 'Plan' },
    };
    const c = startCarousel(ranked, 'day', plan);
    expect(c.cards[0]).toBe(plan);
    expect(c.cards).toHaveLength(3);
    diverse(c.cards);
  });

  it('Shuffle moves one card on to the next diverse look, without repeats until it has to', () => {
    const c = startCarousel(ranked, 'day', null);
    const once = shuffleCard(c, ranked, 2)!;
    diverse(once.cards);
    expect(once.cards[2]!.key).not.toBe(c.cards[2]!.key);
    expect(once.shown[2]).toEqual([c.cards[2]!.key, once.cards[2]!.key]);
    const twice = shuffleCard(once, ranked, 2);
    if (twice) expect(twice.shown[2]).toHaveLength(3);
  });

  it('replaces a card whose piece went out, but keeps the one worn today', () => {
    const c = startCarousel(ranked, 'day', null);
    const out = new Set(['t2']);
    const replaced = reconcileCarousel(c, ranked, (id) => !out.has(id), new Set());
    expect(replaced.cards.some((x) => x.itemIds.includes('t2'))).toBe(false);
    diverse(replaced.cards);

    const worn = new Set(c.cards[1]!.itemIds);
    const kept = reconcileCarousel(c, ranked, (id) => !worn.has(id), worn);
    expect(kept).toBe(c);
  });
});

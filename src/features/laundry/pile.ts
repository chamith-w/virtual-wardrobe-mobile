/**
 * Where pieces sit in the laundry basket (Laundry.dc.html): a loose heap of
 * tilted cutouts that peek over the rim. Pure — safe to import from tests.
 */
import { CATEGORY_DEFAULT_ZONE, type Category } from '@/features/items/catalog';

/** The basket composition, in points (the prototype's 266 × 236 box). */
export const BASKET_BOX = { width: 266, height: 236 } as const;

/** Prototype slots: [left, top, rotation°], filled in order. */
const SLOTS: readonly (readonly [number, number, number])[] = [
  [30, 22, -14],
  [150, 28, 12],
  [86, 6, -4],
  [176, 52, 22],
  [52, 54, -8],
  [118, 50, 6],
  [20, 70, 10],
  [196, 74, -12],
  [100, 30, 16],
  [60, 24, -20],
];

/** More than this and the heap stops growing; the count line says the rest. */
export const PILE_VISIBLE = 14;

export type PileSlot = { x: number; y: number; rotate: number; width: number; height: number };

/** Garments are tall, folded basics and accessories short, shoes wide. */
export function pieceSize(category: Category): { width: number; height: number } {
  const zone = CATEGORY_DEFAULT_ZONE[category];
  if (zone === 'shoes') return { width: 88, height: 59 };
  if (zone === 'drawer' || zone === 'accessories') return { width: 72, height: 56 };
  return { width: 80, height: 96 };
}

/**
 * One slot per piece, oldest first (so the newest lands on top). After the
 * first ten, slots repeat a little higher and further right, as if piled up.
 */
export function pileLayout(categories: readonly Category[]): PileSlot[] {
  return categories.slice(0, PILE_VISIBLE).map((category, i) => {
    const [x, y, rotate] = SLOTS[i % SLOTS.length] ?? [0, 0, 0];
    const layer = Math.floor(i / SLOTS.length);
    const size = pieceSize(category);
    return {
      x: Math.min(BASKET_BOX.width - size.width, x + layer * 14),
      y: y - layer * 12,
      rotate: rotate + layer * 7,
      ...size,
    };
  });
}

/** Wash done: the newest piece leaves first, each 90ms after the one before. */
export const WASH_STAGGER = 90;
export const WASH_FLIGHT = 1000;

export function washDelay(index: number, count: number): number {
  return (count - 1 - index) * WASH_STAGGER;
}

/** How long the whole fly-out takes, last piece included. */
export function washDuration(count: number): number {
  return count > 0 ? WASH_FLIGHT + (count - 1) * WASH_STAGGER : 0;
}

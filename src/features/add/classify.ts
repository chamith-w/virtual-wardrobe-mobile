/**
 * Garment category detection behind a pluggable interface. Nothing is
 * plugged in yet, so `classifyGarment` returns null and the add flow asks
 * with a quick-pick sheet. A model (on-device or remote) can be registered
 * later with `setGarmentClassifier` without touching the flow.
 */
import type { ItemColor } from '@/db/schema';
import { CATEGORIES, type Category } from '@/features/items/catalog';

export type ClassifyInput = {
  /** The cutout (transparent PNG/WebP) when there is one, else the photo. */
  imageUri: string;
  width: number;
  height: number;
  colors: ItemColor[];
};

export type GarmentGuess = { category: Category; confidence: number };

export type GarmentClassifier = (input: ClassifyInput) => Promise<GarmentGuess | null>;

/** Below this the guess only pre-selects a chip; the quick-pick still opens. */
export const CONFIDENT = 0.75;

const askTheUser: GarmentClassifier = async () => null;
let classifier: GarmentClassifier = askTheUser;

export function setGarmentClassifier(next: GarmentClassifier | null) {
  classifier = next ?? askTheUser;
}

/** The registered classifier's guess, or null (never throws: a failing model just means "ask"). */
export async function classifyGarment(input: ClassifyInput): Promise<GarmentGuess | null> {
  try {
    const guess = await classifier(input);
    if (!guess || !(CATEGORIES as readonly string[]).includes(guess.category)) return null;
    return { category: guess.category, confidence: Math.max(0, Math.min(1, guess.confidence)) };
  } catch {
    return null;
  }
}

/** Whether to skip the quick-pick: only for a confident guess. */
export function isConfident(guess: GarmentGuess | null): boolean {
  return guess !== null && guess.confidence >= CONFIDENT;
}

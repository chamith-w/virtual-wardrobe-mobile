/**
 * Colour harmony in HSL. Neutrals pair with everything; complementary and
 * analogous hues are favoured; saturated hues a third of the wheel apart
 * clash. Pure — safe to import from tests.
 */
import type { ItemColor } from '@/db/schema';
import { hexToHsl, hueDistance, isNeutral } from '@/lib/color';

import { SUGGESTION_CONFIG, type SuggestionConfig } from './config';

/** 0–1 harmony of two primary colours, with the reason shown under a match. */
export function colorHarmony(
  a: ItemColor | undefined,
  b: ItemColor | undefined,
  config: SuggestionConfig = SUGGESTION_CONFIG,
): { score: number; reason: string } {
  const h = config.harmony;
  if (!a || !b) return { score: h.scores.unknown, reason: 'Easy pairing' };
  if (isNeutral(b)) return { score: h.scores.neutral, reason: 'Neutral pairing' };
  if (isNeutral(a)) return { score: h.scores.liftsNeutral, reason: `Lifts the ${a.name.toLowerCase()}` };
  const ha = hexToHsl(a.hex);
  const hb = hexToHsl(b.hex);
  const d = hueDistance(ha.h, hb.h);
  if (d <= h.analogousWithin) return { score: h.scores.analogous, reason: 'Tonal match' };
  if (d >= h.complementaryFrom) return { score: h.scores.complementary, reason: 'Complementary colour' };
  const [lo, hi] = h.clashBetween;
  if (ha.s > h.clashSaturation && hb.s > h.clashSaturation && d > lo && d < hi)
    return { score: h.scores.clash, reason: 'Bold contrast' };
  return { score: h.scores.soft, reason: 'Soft contrast' };
}

/** Distinct accent hues (non-neutrals more than "analogous" apart). */
export function accentHueCount(colors: readonly ItemColor[], config: SuggestionConfig = SUGGESTION_CONFIG): number {
  const hues: number[] = [];
  for (const c of colors) {
    if (isNeutral(c)) continue;
    const { h } = hexToHsl(c.hex);
    if (!hues.some((x) => hueDistance(x, h) <= config.harmony.analogousWithin)) hues.push(h);
  }
  return hues.length;
}

/**
 * 0–1 harmony of a whole outfit: the mean of every pair of primary colours,
 * less a little for each accent hue beyond the limit.
 */
export function outfitHarmony(
  colors: readonly (ItemColor | undefined)[],
  config: SuggestionConfig = SUGGESTION_CONFIG,
): number {
  const known = colors.filter((c): c is ItemColor => !!c);
  if (known.length < 2) return config.harmony.scores.neutral;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      // Symmetric: a neutral on either side is a neutral pairing.
      const ab = colorHarmony(known[i], known[j], config).score;
      const ba = colorHarmony(known[j], known[i], config).score;
      sum += Math.max(ab, ba);
      pairs++;
    }
  }
  const extra = Math.max(0, accentHueCount(known, config) - config.harmony.accentLimit);
  return Math.max(0, Math.min(1, sum / pairs - extra * config.harmony.extraAccentPenalty));
}

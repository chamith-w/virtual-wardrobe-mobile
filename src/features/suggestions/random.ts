/**
 * Seeds for the engine: the same day and pieces always give the same
 * suggestions. Pure — safe to import from tests.
 */

/** FNV-1a: a stable 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) fixed by the seed and the key (one mulberry32 step). */
export function seededUnit(seed: number, key: string): number {
  let t = (hashString(key) ^ seed) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Today's seed: the same all day, different tomorrow. */
export function daySeed(day: string): number {
  return hashString(`day:${day}`);
}

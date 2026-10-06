/**
 * Dominant colours of a garment cutout. Pure — safe to import from tests.
 *
 *   RGBA pixels (≈64px) → opaque only (alpha ≥ 128) → k-means in CIELAB (k ≤ 3)
 *   → merge near-duplicate shades, drop clusters under ~8% coverage
 *   → name each by its nearest FASHION_PALETTE colour (CIEDE2000).
 *
 * Reading the pixels (Skia) lives in features/add/pixels.ts.
 */
import type { ItemColor } from '@/db/schema';

import { FASHION_PALETTE, hexToRgb, rgbToHex, type NamedColor, type RGB } from './color';

export type Lab = { L: number; a: number; b: number };

// ------------------------------------------------------------- sRGB → LAB --
const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** D65 reference white. */
const WHITE = { x: 0.95047, y: 1, z: 1.08883 };
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;
const f = (t: number) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);

/** sRGB (0–255) to CIELAB under D65. */
export function rgbToLab({ r, g, b }: RGB): Lab {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / WHITE.x;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.072175) / WHITE.y;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / WHITE.z;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

// ----------------------------------------------------------------- ΔE --
const rad = (deg: number) => (deg * Math.PI) / 180;
const hueOf = (b: number, a: number) => {
  if (a === 0 && b === 0) return 0;
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h >= 0 ? h : h + 360;
};
const POW25_7 = 25 ** 7;

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005). ~1 is a just-noticeable difference. */
export function deltaE2000(x: Lab, y: Lab): number {
  const c1 = Math.hypot(x.a, x.b);
  const c2 = Math.hypot(y.a, y.b);
  const meanC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + POW25_7)));
  const a1 = x.a * (1 + g);
  const a2 = y.a * (1 + g);
  const c1p = Math.hypot(a1, x.b);
  const c2p = Math.hypot(a2, y.b);
  const h1p = hueOf(x.b, a1);
  const h2p = hueOf(y.b, a2);

  const dL = y.L - x.L;
  const dC = c2p - c1p;
  let dh = 0;
  if (c1p * c2p !== 0) {
    dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dh / 2));

  const meanL = (x.L + y.L) / 2;
  const meanCp = (c1p + c2p) / 2;
  let meanH = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) meanH = (h1p + h2p) / 2;
    else meanH = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos(rad(meanH - 30)) +
    0.24 * Math.cos(rad(2 * meanH)) +
    0.32 * Math.cos(rad(3 * meanH + 6)) -
    0.2 * Math.cos(rad(4 * meanH - 63));
  const dTheta = 30 * Math.exp(-(((meanH - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + POW25_7));
  const sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
  const sc = 1 + 0.045 * meanCp;
  const sh = 1 + 0.015 * meanCp * t;
  const rt = -Math.sin(rad(2 * dTheta)) * rc;

  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}

/** Squared Euclidean distance in LAB (ΔE76²): cheap, good enough for clustering. */
const dist2 = (x: Lab, y: Lab) => (x.L - y.L) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2;

// ------------------------------------------------------------- palette --
const paletteLab = new Map<NamedColor[], Lab[]>();
const labsOf = (palette: NamedColor[]) => {
  let labs = paletteLab.get(palette);
  if (!labs) {
    labs = palette.map((c) => hexToLab(c.hex));
    paletteLab.set(palette, labs);
  }
  return labs;
};

/** The closest named colour by CIEDE2000. */
export function nearestNamed(
  lab: Lab,
  palette: NamedColor[] = FASHION_PALETTE,
): { color: NamedColor; distance: number } {
  const labs = labsOf(palette);
  let best = 0;
  let bestDistance = Infinity;
  labs.forEach((candidate, i) => {
    const d = deltaE2000(lab, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  const color = palette[best];
  if (!color) throw new Error('The palette is empty');
  return { color, distance: bestDistance };
}

// -------------------------------------------------------------- k-means --
export type Cluster = { center: Lab; count: number; rgb: RGB };

/**
 * k-means in LAB with a deterministic farthest-point start, so the same
 * cutout always yields the same colours. Empty clusters are dropped.
 */
export function kmeans(points: readonly Lab[], rgbs: readonly RGB[], k: number, iterations = 12): Cluster[] {
  if (points.length === 0 || k <= 0) return [];
  const mean = points.reduce((m, p) => ({ L: m.L + p.L, a: m.a + p.a, b: m.b + p.b }), { L: 0, a: 0, b: 0 });
  const centroid = { L: mean.L / points.length, a: mean.a / points.length, b: mean.b / points.length };

  // Start from the point nearest the centroid, then repeatedly the point farthest from every center.
  const centers: Lab[] = [];
  let first = 0;
  points.forEach((p, i) => {
    if (dist2(p, centroid) < dist2(points[first] ?? p, centroid)) first = i;
  });
  centers.push({ ...(points[first] as Lab) });
  while (centers.length < k) {
    let far = -1;
    let farDistance = 0;
    points.forEach((p, i) => {
      const d = Math.min(...centers.map((c) => dist2(p, c)));
      if (d > farDistance) {
        farDistance = d;
        far = i;
      }
    });
    if (far < 0 || farDistance < 1) break; // every point already sits on a center
    centers.push({ ...(points[far] as Lab) });
  }

  const assignment = new Int32Array(points.length);
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    points.forEach((p, i) => {
      let best = 0;
      let bestDistance = Infinity;
      centers.forEach((c, j) => {
        const d = dist2(p, c);
        if (d < bestDistance) {
          bestDistance = d;
          best = j;
        }
      });
      if (assignment[i] !== best) {
        assignment[i] = best;
        moved = true;
      }
    });
    const sums = centers.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    points.forEach((p, i) => {
      const s = sums[assignment[i] ?? 0];
      if (!s) return;
      s.L += p.L;
      s.a += p.a;
      s.b += p.b;
      s.n += 1;
    });
    sums.forEach((s, j) => {
      if (s.n > 0) centers[j] = { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n };
    });
    if (!moved && iter > 0) break;
  }

  const totals = centers.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
  rgbs.forEach((c, i) => {
    const t = totals[assignment[i] ?? 0];
    if (!t) return;
    t.n += 1;
    t.r += c.r;
    t.g += c.g;
    t.b += c.b;
  });
  return centers
    .map((center, j) => {
      const t = totals[j] ?? { n: 0, r: 0, g: 0, b: 0 };
      return { center, count: t.n, rgb: t.n ? { r: t.r / t.n, g: t.g / t.n, b: t.b / t.n } : { r: 0, g: 0, b: 0 } };
    })
    .filter((c) => c.count > 0);
}

// --------------------------------------------------------------- detect --
export type DetectedColor = ItemColor & {
  /** Share of the garment's pixels, 0–1. */
  coverage: number;
  /** The measured average colour, before snapping to the palette. */
  measured: string;
};

export type DetectOptions = {
  /** At most this many clusters (and colours). Default 3. */
  k?: number;
  /** Clusters covering less than this share are dropped. Default 0.08. */
  minCoverage?: number;
  /** Pixels more transparent than this are background. Default 128. */
  alphaThreshold?: number;
  /** Clusters closer than this (CIEDE2000) are one colour in different light. Default 10. */
  mergeBelow?: number;
  palette?: NamedColor[];
};

/** Pulls the opaque pixels out of an RGBA buffer as LAB (and RGB for the measured hex). */
export function opaquePixels(data: ArrayLike<number>, alphaThreshold = 128): { labs: Lab[]; rgbs: RGB[] } {
  const labs: Lab[] = [];
  const rgbs: RGB[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < alphaThreshold) continue;
    const rgb = { r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 };
    rgbs.push(rgb);
    labs.push(rgbToLab(rgb));
  }
  return { labs, rgbs };
}

/**
 * 1–3 named colours for an RGBA pixel buffer (unpremultiplied), largest
 * first. Empty when nothing is opaque.
 */
export function detectColors(data: ArrayLike<number>, options: DetectOptions = {}): DetectedColor[] {
  const { k = 3, minCoverage = 0.08, alphaThreshold = 128, mergeBelow = 10, palette = FASHION_PALETTE } = options;
  const { labs, rgbs } = opaquePixels(data, alphaThreshold);
  if (labs.length === 0) return [];

  // Biggest clusters first; fold shades of the same colour into the larger one.
  const clusters = kmeans(labs, rgbs, Math.max(1, Math.min(3, k))).sort((a, b) => b.count - a.count);
  const merged: Cluster[] = [];
  for (const c of clusters) {
    const twin = merged.find((m) => deltaE2000(m.center, c.center) < mergeBelow);
    if (twin) twin.count += c.count;
    else merged.push({ ...c });
  }

  const total = labs.length;
  const named = new Map<string, DetectedColor>();
  for (const c of merged) {
    const coverage = c.count / total;
    if (coverage < minCoverage) continue;
    const { color } = nearestNamed(c.center, palette);
    const existing = named.get(color.name);
    if (existing) existing.coverage += coverage;
    else named.set(color.name, { name: color.name, hex: color.hex, coverage, measured: rgbToHex(c.rgb) });
  }
  return [...named.values()].sort((a, b) => b.coverage - a.coverage).slice(0, Math.min(3, k));
}

/** Strips detection extras so colours can be stored on an item. */
export function toItemColors(colors: readonly ItemColor[]): ItemColor[] {
  return colors.map(({ hex, name }) => ({ hex, name }));
}

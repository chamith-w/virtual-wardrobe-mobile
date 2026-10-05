/**
 * Colour helpers. Phase 3 adds LAB/ΔE matching against FASHION_PALETTE; the
 * palette lives here now because seed data and swatches already use it.
 */

export type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Linear blend: t=0 → a, t=1 → b. Used for the colour-tinted detail background. */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.18;
}

export type HSL = { h: number; s: number; l: number };

/** Hue in degrees (0–360), saturation and lightness in 0–1. */
export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** Shortest distance between two hues on the colour wheel (0–180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Whether a colour reads as a neutral that pairs with anything. Palette names
 * use the curated flag; other hex values fall back to low saturation or
 * extreme lightness.
 */
export function isNeutral(color: { hex: string; name?: string }): boolean {
  const named = color.name
    ? FASHION_PALETTE.find((c) => c.name.toLowerCase() === color.name?.toLowerCase())
    : undefined;
  if (named) return named.neutral;
  const { s, l } = hexToHsl(color.hex);
  return s < 0.18 || l < 0.12 || l > 0.92;
}

export type NamedColor = { name: string; hex: string; neutral: boolean };

/** Curated fashion palette used for colour naming, swatches and filters. */
export const FASHION_PALETTE: NamedColor[] = [
  { name: 'Black', hex: '#1D1C1B', neutral: true },
  { name: 'Charcoal', hex: '#3B3936', neutral: true },
  { name: 'Grey', hex: '#8E8C88', neutral: true },
  { name: 'White', hex: '#F5F3EE', neutral: true },
  { name: 'Cream', hex: '#F0E8D8', neutral: true },
  { name: 'Ecru', hex: '#E8DDC8', neutral: true },
  { name: 'Stone', hex: '#B8AD9E', neutral: true },
  { name: 'Camel', hex: '#B98B5E', neutral: true },
  { name: 'Chocolate', hex: '#5A3C2B', neutral: true },
  { name: 'Navy', hex: '#26354E', neutral: true },
  { name: 'Indigo', hex: '#2F405E', neutral: true },
  { name: 'Denim', hex: '#4E6B8B', neutral: false },
  { name: 'Sky', hex: '#A8C2D8', neutral: false },
  { name: 'Olive', hex: '#6B6B3A', neutral: false },
  { name: 'Sage', hex: '#A3B196', neutral: false },
  { name: 'Forest', hex: '#2F4B3A', neutral: false },
  { name: 'Mustard', hex: '#C9A03B', neutral: false },
  { name: 'Rust', hex: '#B5542E', neutral: false },
  { name: 'Burgundy', hex: '#6E2A35', neutral: false },
  { name: 'Blush', hex: '#E3B3A3', neutral: false },
  { name: 'Red', hex: '#B8322A', neutral: false },
  { name: 'Lilac', hex: '#B4A4C8', neutral: false },
];

export function paletteColor(name: string): NamedColor {
  const found = FASHION_PALETTE.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!found) throw new Error(`Unknown palette colour: ${name}`);
  return found;
}

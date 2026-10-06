import Svg, { Path, Rect } from 'react-native-svg';

/** Hanger path from the design prototype (viewBox 60×30). */
export const HANGER_PATH =
  'M30 14L30 11Q30 9 32 8.2Q35 7 35 4.5Q35 1.5 32 1.5Q29.5 1.5 29 4M30 14L5 26.5Q3 28 5.5 28.5L54.5 28.5Q57 28 55 26.5Z';

type GlyphProps = { width: number; color: string; strokeWidth?: number };

/** The minimal hanger glyph used on the rail and for "empty hanger" states. */
export function HangerGlyph({ width, color, strokeWidth = 1.6 }: GlyphProps) {
  return (
    <Svg width={width} height={width / 2} viewBox="0 0 60 30">
      <Path
        d={HANGER_PATH}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Wardrobe tab icon: a hanger drawn at icon scale (24×24 grid). */
export function HangerIcon({
  size = 22,
  color,
  strokeWidth = 1.8,
}: {
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M10 5.5a2 2 0 1 1 2 2v1.5l8.4 6.2a1.4 1.4 0 0 1-.8 2.5H4.4a1.4 1.4 0 0 1-.8-2.5L12 9"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Woven laundry basket (viewBox 120×100). */
export function BasketGlyph({ width, color, strokeWidth = 1.4 }: GlyphProps) {
  return (
    <Svg width={width} height={(width * 100) / 120} viewBox="0 0 120 100">
      <Path
        d="M14 40L106 40L96 92Q95 97 90 97L30 97Q25 97 24 92Z"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M18 54L102 54M20 68L100 68M22 82L98 82M36 40L38 97M52 40L53 97M68 40L67 97M84 40L82 97"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 0.8}
        strokeLinecap="round"
      />
      <Rect x={6} y={26} width={108} height={16} rx={6} fill="none" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** A dashed shoe outline: the gap left on the shoe rack (viewBox 120×80). */
export function GhostShoeGlyph({ width, color }: GlyphProps) {
  return (
    <Svg width={width} height={(width * 80) / 120} viewBox="0 0 120 80">
      <Path
        d="M10 54Q10 42 20 40L42 36Q48 28 58 30L68 38Q76 44 88 46Q110 50 112 62L112 64L10 64Z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A dashed garment outline: the ghost left behind on a shelf. */
export function GhostFoldGlyph({ width, color }: GlyphProps) {
  return (
    <Svg width={width} height={(width * 70) / 100} viewBox="0 0 100 70">
      <Path
        d="M8 20Q8 10 18 10L82 10Q92 10 92 20L92 58Q92 64 86 64L14 64Q8 64 8 58Z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
    </Svg>
  );
}

/** The floating laundry basket button's icon (24×24 line art from Closet.dc.html). */
export function BasketIcon({
  size = 26,
  color,
  strokeWidth = 1.75,
}: {
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 10h20M3.6 10l1.7 8.2a2 2 0 0 0 2 1.8h9.4a2 2 0 0 0 2-1.8L20.4 10M8 10l3-6M16 10l-3-6M9 14v3M15 14v3M12 14v3"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The woven basket on the Laundry screen (viewBox 120×100, Laundry.dc.html).
 * Drawn in front of the pile, so pieces peek over the rim.
 */
export function WickerBasket({
  width,
  body,
  weave,
  handle,
}: {
  width: number;
  /** Wicker fill, weave lines and rim, and the hand-hold slot: theme tokens. */
  body: string;
  weave: string;
  handle: string;
}) {
  return (
    <Svg width={width} height={(width * 100) / 120} viewBox="0 0 120 100">
      <Path d="M14 40L106 40L96 92Q95 97 90 97L30 97Q25 97 24 92Z" fill={body} />
      <Path
        d="M18 54L102 54M20 68L100 68M22 82L98 82M36 40L38 97M52 40L53 97M68 40L67 97M84 40L82 97"
        fill="none"
        stroke={weave}
        strokeWidth={1.2}
      />
      <Path d="M6 32Q6 26 12 26L108 26Q114 26 114 32L114 38Q114 42 108 42L12 42Q6 42 6 38Z" fill={weave} />
      <Path d="M44 31L76 31" stroke={handle} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

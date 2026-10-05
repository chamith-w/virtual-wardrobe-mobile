/**
 * Design tokens — the single source of truth for colour, type, shape and motion.
 *
 * Pure data only (no React Native imports): this file is read by
 * tailwind.config.ts at build time and by the ThemeProvider at runtime.
 *
 * Colour notes (see docs/DESIGN.md → "Contrast fixes"):
 *  - `muted` is the text-safe muted colour. The spec's #8A847C fails 4.5:1 on
 *    the cream background, so it lives on as `faint` (icons, hairlines, hanger
 *    glyphs, disabled states) and text uses #6E6860.
 *  - `accentStrong` is the fill for buttons with white text; the spec accent
 *    #E2553F is kept for dots, rings, focus and illustration accents.
 */

export type ColorScheme = 'light' | 'dark';

export const colors = {
  light: {
    background: '#F7F3EE',
    surface: '#FFFFFF',
    surfaceTinted: '#EFE8DF',
    surfaceTintedStrong: '#E4D9CB',
    board: '#ECE5DB',
    ink: '#1C1A17',
    muted: '#6E6860',
    faint: '#8A847C',
    rail: '#B9AE9F',
    accent: '#E2553F',
    accentStrong: '#C2412C',
    onAccent: '#FFFFFF',
    accentText: '#B23A26',
    accentSoft: '#F8E0D8',
    accentSecondary: '#2F4B3A',
    onAccentSecondary: '#FFFFFF',
    accentSecondarySoft: '#DFE8E1',
    success: '#2F6B45',
    successSoft: '#DCEBE0',
    warning: '#8A5A12',
    warningSoft: '#F5E8CF',
    danger: '#A8321F',
    dangerSoft: '#F7DED7',
    inverse: '#1C1A17',
    onInverse: '#F7F3EE',
    shadow: '#543A22',
  },
  dark: {
    background: '#121110',
    surface: '#1D1B19',
    surfaceTinted: '#26231F',
    surfaceTintedStrong: '#312C27',
    board: '#1A1816',
    ink: '#F3EEE8',
    muted: '#9C958C',
    faint: '#6F6962',
    rail: '#4E4740',
    accent: '#FF7A5C',
    accentStrong: '#FF7A5C',
    onAccent: '#1A0F0B',
    accentText: '#FF8F75',
    accentSoft: '#3B231C',
    accentSecondary: '#8DB89C',
    onAccentSecondary: '#0F1A12',
    accentSecondarySoft: '#1E2B22',
    success: '#86C59B',
    successSoft: '#1B2A20',
    warning: '#E2B565',
    warningSoft: '#2F2717',
    danger: '#F08A75',
    dangerSoft: '#35201B',
    inverse: '#F3EEE8',
    onInverse: '#121110',
    shadow: '#000000',
  },
} as const;

export type ColorToken = keyof (typeof colors)['light'];
export type Palette = Record<ColorToken, string>;

/** Hairline strengths, applied as alpha over `ink`. */
export const hairline = {
  line: 0.09,
  lineStrong: 0.17,
} as const;

/** Shadow opacities over the `shadow` token, per scheme. */
export const shadowOpacity = {
  light: { soft: 0.12, strong: 0.24 },
  dark: { soft: 0.4, strong: 0.62 },
} as const;

export const radii = {
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
} as const;

/** 4pt grid. Tailwind's default spacing scale already maps 1 → 4px. */
export const space = (steps: number) => steps * 4;

export const fontFamily = {
  display: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_500Medium_Italic',
  displaySemibold: 'Fraunces_600SemiBold',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemibold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
} as const;

type TypeStyle = { fontSize: number; lineHeight: number; letterSpacing: number; fontFamily: string };

/** Type scale from the spec: display 40/34/28, title 22/18, body 16/14, caption 12. */
export const typography = {
  display1: { fontSize: 40, lineHeight: 42, letterSpacing: -1.4, fontFamily: fontFamily.display },
  display2: { fontSize: 34, lineHeight: 36, letterSpacing: -1.0, fontFamily: fontFamily.display },
  display3: { fontSize: 28, lineHeight: 31, letterSpacing: -0.7, fontFamily: fontFamily.display },
  title1: { fontSize: 22, lineHeight: 27, letterSpacing: -0.3, fontFamily: fontFamily.sansSemibold },
  title2: { fontSize: 18, lineHeight: 23, letterSpacing: -0.2, fontFamily: fontFamily.sansSemibold },
  body: { fontSize: 16, lineHeight: 23, letterSpacing: 0, fontFamily: fontFamily.sans },
  bodySm: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontFamily: fontFamily.sans },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0, fontFamily: fontFamily.sans },
  eyebrow: { fontSize: 11, lineHeight: 14, letterSpacing: 1.5, fontFamily: fontFamily.sansSemibold },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typography;

/**
 * Spring presets (Reanimated `withSpring` configs). Never use linear easing.
 * Values were tuned in the design prototype (docs/design/*.dc.html).
 */
export const springs = {
  /** Press feedback, chips, toggles. */
  snappy: { damping: 18, stiffness: 320, mass: 0.8 },
  /** Sheets, cards settling, layout moves. */
  gentle: { damping: 20, stiffness: 180, mass: 1 },
  /** Playful overshoot: fly-in landing, basket bounce, success pops. */
  bouncy: { damping: 11, stiffness: 220, mass: 0.9 },
  /** Hanger sway settle (prototype: k=170, c=9). */
  sway: { damping: 9, stiffness: 170, mass: 1 },
} as const;

export const durations = {
  /** Cross-fade used in place of physics when Reduce Motion is on. */
  reducedFade: 200,
  doors: 1400,
  flyIn: 1350,
  shimmer: 1250,
} as const;

/** Layout constants shared by the tab bar and screens. */
export const layout = {
  screenGutter: 20,
  tabBarHeight: 70,
  tabBarSideInset: 16,
  tabBarBottomGap: 12,
  addButtonSize: 62,
  minTouch: 44,
} as const;

/** "#RRGGBB" → "R G B" channel string for CSS variables. */
export function hexToChannels(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** camelCase token → kebab-case CSS name, e.g. accentSoft → accent-soft. */
export function tokenToCssName(token: string): string {
  return token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export const colorTokenNames = Object.keys(colors.light) as ColorToken[];

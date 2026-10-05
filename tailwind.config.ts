import type { Config } from 'tailwindcss';

import { colorTokenNames, fontFamily, hairline, radii, tokenToCssName, typography } from './src/theme/tokens';

// nativewind/preset ships as CommonJS without a module declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativewindPreset = require('nativewind/preset') as Config;

/**
 * Tailwind is driven by src/theme/tokens.ts. Colours resolve to CSS variables
 * that ThemeProvider sets per colour scheme, so `bg-surface` / `text-muted`
 * follow light and dark automatically — no `dark:` variants needed.
 */
const themeColors = Object.fromEntries(
  colorTokenNames.map((token) => {
    const name = tokenToCssName(token);
    return [name, `rgb(var(--color-${name}) / <alpha-value>)`];
  }),
);

const fontSize = Object.fromEntries(
  Object.entries(typography).map(([name, t]) => [
    tokenToCssName(name),
    [`${t.fontSize}px`, { lineHeight: `${t.lineHeight}px`, letterSpacing: `${t.letterSpacing}px` }] as [
      string,
      { lineHeight: string; letterSpacing: string },
    ],
  ]),
);

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        ...themeColors,
        line: `rgb(var(--color-ink) / ${hairline.line})`,
        'line-strong': `rgb(var(--color-ink) / ${hairline.lineStrong})`,
      },
      fontFamily: {
        display: [fontFamily.display],
        'display-italic': [fontFamily.displayItalic],
        'display-semibold': [fontFamily.displaySemibold],
        sans: [fontFamily.sans],
        'sans-medium': [fontFamily.sansMedium],
        'sans-semibold': [fontFamily.sansSemibold],
        'sans-bold': [fontFamily.sansBold],
      },
      fontSize,
      borderRadius: {
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        pill: `${radii.pill}px`,
      },
    },
  },
  plugins: [],
} satisfies Config;

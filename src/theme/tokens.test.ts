import { contrastRatio } from '@/lib/color';

import { colors, type ColorScheme, type ColorToken } from './tokens';

const AA_TEXT = 4.5;

/** [foreground, background] pairs that carry readable text anywhere in the app. */
const TEXT_PAIRS: [ColorToken, ColorToken][] = [
  ['ink', 'background'],
  ['ink', 'surface'],
  ['ink', 'surfaceTinted'],
  ['muted', 'background'],
  ['muted', 'surface'],
  ['muted', 'surfaceTinted'],
  ['accentText', 'background'],
  ['accentText', 'surface'],
  ['accentText', 'accentSoft'],
  ['onAccent', 'accentStrong'],
  ['onAccentSecondary', 'accentSecondary'],
  ['onInverse', 'inverse'],
  ['success', 'successSoft'],
  ['warning', 'warningSoft'],
  ['danger', 'dangerSoft'],
];

describe.each<ColorScheme>(['light', 'dark'])('%s palette', (scheme) => {
  const palette = colors[scheme];

  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('defines the same tokens as the other scheme', () => {
    expect(Object.keys(palette).sort()).toEqual(Object.keys(colors.light).sort());
  });
});

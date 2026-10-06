import * as SystemUI from 'expo-system-ui';
import { vars } from 'nativewind';
import { createContext, use, useEffect, type ReactNode } from 'react';
import { Appearance, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

import { usePreferences, type ThemePreference } from '@/store/preferences';

import { colors, colorTokenNames, hexToChannels, tokenToCssName, type ColorScheme, type Palette } from './tokens';

type ThemeContextValue = {
  scheme: ColorScheme;
  isDark: boolean;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** CSS variables consumed by tailwind.config.ts colour utilities. */
const schemeVars = {
  light: vars(
    Object.fromEntries(colorTokenNames.map((t) => [`--color-${tokenToCssName(t)}`, hexToChannels(colors.light[t])])),
  ),
  dark: vars(
    Object.fromEntries(colorTokenNames.map((t) => [`--color-${tokenToCssName(t)}`, hexToChannels(colors.dark[t])])),
  ),
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = usePreferences((s) => s.theme);
  const setPreference = usePreferences((s) => s.setTheme);

  const scheme: ColorScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const palette = colors[scheme];

  useEffect(() => {
    // Native chrome (keyboard, alerts, pickers) follows the in-app choice too.
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  useEffect(() => {
    // Paint the native root so screen transitions never flash white.
    SystemUI.setBackgroundColorAsync(palette.background).catch(() => {});
  }, [palette.background]);

  const value: ThemeContextValue = {
    scheme,
    isDark: scheme === 'dark',
    colors: palette,
    preference,
    setPreference,
  };

  return (
    <ThemeContext value={value}>
      <View style={[{ flex: 1, backgroundColor: palette.background }, schemeVars[scheme]]}>{children}</View>
    </ThemeContext>
  );
}

/**
 * Renders a subtree in a fixed scheme whatever the app theme, e.g. the
 * always-dark camera. Primitives inside pick up that palette through both the
 * CSS variables and `useTheme()`.
 */
export function SchemeScope({
  scheme,
  children,
  style,
}: {
  scheme: ColorScheme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const parent = useTheme();
  const value: ThemeContextValue = { ...parent, scheme, isDark: scheme === 'dark', colors: colors[scheme] };
  return (
    <ThemeContext value={value}>
      <View style={[{ flex: 1, backgroundColor: colors[scheme].background }, schemeVars[scheme], style]}>
        {children}
      </View>
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** `#RRGGBB` + alpha → `rgba()` — for Skia, SVG and shadow colours. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

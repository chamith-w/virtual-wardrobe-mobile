import '@/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';

import { ToastHost } from '@/components/ui';
import { DatabaseGate } from '@/db/DatabaseGate';
import { openItem } from '@/features/items/openItem';
import { configureNotifications, useNotificationResponses } from '@/lib/notifications';
import { appFonts } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 350, fade: true });
configureNotifications();

/** A tapped lend reminder opens its piece (also when the tap launched the app). */
function openFromNotification(data: Record<string, unknown>) {
  const itemId = data.itemId;
  if (typeof itemId === 'string')
    void openItem({ id: itemId, wardrobeId: null, thumbUri: null }, { browseIds: [itemId] });
}

function AppStack() {
  const { colors, isDark } = useTheme();
  useNotificationResponses(openFromNotification);
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.surfaceTinted,
      notification: colors.accent,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="design-system" options={{ presentation: 'modal' }} />
        {/* Transparent and unanimated: the screen flies the tapped thumbnail in over the list itself. */}
        <Stack.Screen
          name="item/[id]"
          options={{
            presentation: 'transparentModal',
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        {/* Full screen, no swipe to dismiss: the board's own drags must never close it. */}
        <Stack.Screen
          name="outfit/[id]"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen name="edit-item/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="laundry" />
        <Stack.Screen name="wardrobes" options={{ presentation: 'modal' }} />
      </Stack>
      {/* iOS presents modals in their own window layer; the overlay keeps toasts above them. */}
      {Platform.OS === 'ios' ? (
        <FullWindowOverlay>
          <ToastHost />
        </FullWindowOverlay>
      ) : (
        <ToastHost />
      )}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const [dbReady, setDbReady] = useState(false);
  const onDbReady = useCallback(() => setDbReady(true), []);

  const ready = dbReady && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <BottomSheetModalProvider>
          {fontsLoaded || fontError ? (
            <DatabaseGate onReady={onDbReady}>
              <AppStack />
            </DatabaseGate>
          ) : null}
        </BottomSheetModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

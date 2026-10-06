/**
 * Local notifications only (expo-notifications). My Closet never registers for
 * remote push: the app is signed with a free Personal Team, and
 * plugins/withoutPushEntitlement.js strips the push capability on iOS.
 */
import * as Notifications from 'expo-notifications';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

const CHANNEL_ID = 'reminders';

/** Show reminders as banners even when the app is open. Call once at startup. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let channelReady: Promise<unknown> | null = null;

/** Android shows nothing (and, on 13+, never asks permission) until a channel exists. */
function ensureChannel(): Promise<unknown> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    description: 'Lent pieces you asked to be reminded about',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => null);
  return channelReady;
}

export type NotificationPermission = 'granted' | 'denied' | 'blocked';

function isAllowed(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/**
 * Asks for permission the first time a reminder is switched on. "blocked"
 * means the system won't ask again; only Settings can turn it back on.
 */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (isAllowed(current)) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (isAllowed(asked)) return 'granted';
  return asked.canAskAgain ? 'denied' : 'blocked';
}

export type LocalNotification = {
  title: string;
  body: string;
  data: Record<string, unknown>;
};

/**
 * Schedules (or replaces) one notification at `at`. On Android 12+ without the
 * exact-alarm permission the system may deliver it a few minutes late, which
 * is fine for a reminder.
 */
export async function scheduleLocal(id: string, at: Date, content: LocalNotification): Promise<void> {
  await ensureChannel();
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { ...content, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
  });
}

export function cancelLocal(id: string): Promise<void> {
  return Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export function cancelAllLocal(): Promise<void> {
  return Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/**
 * Calls `onOpen` with the data of a tapped notification: the one that
 * launched the app (cold start) and any tapped while it runs.
 */
export function useNotificationResponses(onOpen: (data: Record<string, unknown>) => void) {
  const handler = useRef(onOpen);
  useLayoutEffect(() => {
    handler.current = onOpen;
  });

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      handler.current(response.notification.request.content.data ?? {});
      // Handled: don't route to it again on the next launch.
      Notifications.clearLastNotificationResponse();
    };
    handle(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, []);
}

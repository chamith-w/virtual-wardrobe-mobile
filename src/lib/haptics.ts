import * as Haptics from 'expo-haptics';

const safe = (fn: () => Promise<void>) => () => {
  fn().catch(() => {
    // Haptics are a nicety; never let them throw (e.g. simulator, low power).
  });
};

/**
 * Named haptic moments from the spec. Call these rather than expo-haptics
 * directly so the feel stays consistent across the app.
 */
export const haptics = {
  /** Light tick for ordinary presses, chip toggles and tab switches. */
  tap: safe(() => Haptics.selectionAsync()),
  /** A firmer tap for primary buttons. */
  press: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A new garment saved to the wardrobe. */
  itemAdded: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** An outfit saved from the builder. */
  outfitSaved: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Worn / laundry / lent / storage changes. */
  statusChanged: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Successful drag-and-drop (basket, planner day, outfit canvas). */
  dropSuccess: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** A card committed in declutter mode. */
  declutterSwipe: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  /** Something went wrong or was refused. */
  warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

export type HapticName = keyof typeof haptics;

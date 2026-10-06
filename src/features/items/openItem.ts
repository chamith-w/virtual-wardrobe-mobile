import { router } from 'expo-router';
import type { View } from 'react-native';

import { useItemTransition } from '@/store/itemTransition';
import { useWardrobeView } from '@/store/wardrobeView';

import type { Rect } from './detail/hero';

type Openable = { id: string; wardrobeId: string | null; thumbUri: string | null };

export type OpenItemOptions = {
  /** The thumbnail that was tapped; the hero flies out of it. */
  from?: View | null;
  /**
   * Where the hero flies back to on close, when it isn't `from` (quick sheet →
   * closet spot). Null means there's nowhere to fly back to: the page fades.
   */
  back?: Rect | null;
  /** The list detail pages through, in on-screen order. */
  browseIds?: string[];
};

/** Window rect of a view, or null if it isn't laid out. */
export function measureRect(view: View | null | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

let opening = false;

/**
 * Opens item detail with the shared-element-style flight from its thumbnail.
 * Taps while a detail is already opening are ignored.
 */
export async function openItem(item: Openable, options: OpenItemOptions = {}) {
  if (opening) return;
  opening = true;
  try {
    if (options.browseIds) useWardrobeView.getState().setBrowseIds(options.browseIds);
    const from = await measureRect(options.from);
    useItemTransition.getState().begin(
      item.id,
      from
        ? {
            itemId: item.id,
            wardrobeId: item.wardrobeId,
            uri: item.thumbUri,
            from,
            back: options.back === undefined ? from : options.back,
          }
        : null,
    );
    router.push({ pathname: '/item/[id]', params: { id: item.id } });
  } finally {
    // Long enough to swallow a double tap, short enough never to feel stuck.
    setTimeout(() => {
      opening = false;
    }, 450);
  }
}

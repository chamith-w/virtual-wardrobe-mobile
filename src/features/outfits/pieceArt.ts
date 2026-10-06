import type { SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

import { loadCutout } from '@/components/ui';
import { samplePixels } from '@/features/add/pixels';

import { FULL_IMAGE, garmentAspect, opaqueBounds, type UnitRect } from './bounds';

/** A decoded cutout plus where its garment sits in it, ready to draw on a board. */
export type PieceArt = {
  image: SkImage;
  bounds: UnitRect;
  /** Width ÷ height of the garment itself (not the image). */
  aspect: number;
};

const boundsByUri = new Map<string, UnitRect>();
const ready = new Map<string, PieceArt>();
const pending = new Map<string, Promise<PieceArt | null>>();

/** Decodes a cutout (through Cutout's shared cache) and measures its garment once per URI. */
export function loadPieceArt(uri: string): Promise<PieceArt | null> {
  const inflight = pending.get(uri);
  if (inflight) return inflight;
  const task = (async () => {
    const image = await loadCutout(uri);
    if (!image) return null;
    let bounds = boundsByUri.get(uri);
    if (!bounds) {
      const sample = await samplePixels(uri).catch(() => null);
      bounds = sample ? opaqueBounds(sample.data, sample.width, sample.height) : FULL_IMAGE;
      boundsByUri.set(uri, bounds);
    }
    const art = { image, bounds, aspect: garmentAspect(bounds, image.width() / image.height()) };
    ready.set(uri, art);
    // Keep only a recent handful of handles here; Cutout's cache owns the pixel budget.
    if (ready.size > 80) ready.delete(ready.keys().next().value!);
    return art;
  })().finally(() => pending.delete(uri));
  pending.set(uri, task);
  return task;
}

/** The art for every URI that has loaded so far, keyed by URI. */
export function usePieceArts(uris: readonly string[]): ReadonlyMap<string, PieceArt> {
  const key = uris.join('|');
  const [arts, setArts] = useState<ReadonlyMap<string, PieceArt>>(
    () => new Map(uris.flatMap((u) => (ready.has(u) ? [[u, ready.get(u)!] as const] : []))),
  );

  useEffect(() => {
    let alive = true;
    for (const uri of key ? key.split('|') : []) {
      void loadPieceArt(uri).then((art) => {
        if (!alive || !art) return;
        setArts((prev) => (prev.get(uri) === art ? prev : new Map(prev).set(uri, art)));
      });
    }
    return () => {
      alive = false;
    };
  }, [key]);

  return arts;
}

/** The best image for drawing a piece large (the builder): the full cutout, else the thumbnail. */
export function boardUri(item: { cutoutUri: string | null; thumbUri: string | null }): string | null {
  return item.cutoutUri ?? item.thumbUri;
}

/** The image for thumbnails and snapshots: the 400px thumbnail, else the full cutout. */
export function thumbUri(item: { cutoutUri: string | null; thumbUri: string | null }): string | null {
  return item.thumbUri ?? item.cutoutUri;
}

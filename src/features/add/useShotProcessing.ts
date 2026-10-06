import { useEffect, useState } from 'react';

import { loadCutout } from '@/components/ui';
import type { DetectedColor } from '@/lib/color-extract';

import type { Shot } from './flow';
import { detectGarmentColors } from './pixels';
import { prepareWorkingPhoto } from './photo';
import { removeBackground, SegmentationError, type Cutout, type Photo, type SegmentationFailure } from './segmentation';

/** The shimmer runs at least this long, so the reveal reads as a moment rather than a flicker. */
const MIN_SCAN_MS = 1100;

export type Processing =
  | { phase: 'loading' }
  | { phase: 'preparing'; photo: Photo; progress: number }
  | { phase: 'scanning'; photo: Photo }
  | {
      phase: 'done';
      photo: Photo;
      cutout: Cutout | null;
      colors: DetectedColor[];
      failure: SegmentationFailure | null;
    }
  | { phase: 'error'; message: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Turns a captured photo into a cutout plus detected colours: a working copy
 * (upright, ≤2048px), background removal (downloading the model first if
 * needed), then colours from the cutout, or from the middle of the photo when
 * there's no cutout.
 */
export function useShotProcessing(shot: Shot | null): { state: Processing; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; value: Processing }>({ key: '', value: { phase: 'loading' } });
  const key = shot ? `${shot.id}:${attempt}` : '';

  useEffect(() => {
    if (!shot) return;
    let alive = true;
    const set = (value: Processing) => {
      if (alive) setState({ key, value });
    };

    (async () => {
      let photo: Photo;
      try {
        photo = await prepareWorkingPhoto(shot.uri);
      } catch {
        set({ phase: 'error', message: 'This photo couldn’t be opened.' });
        return;
      }
      set({ phase: 'scanning', photo });
      const started = Date.now();

      let cutout: Cutout | null = null;
      let failure: SegmentationFailure | null = null;
      try {
        cutout = await removeBackground(photo, {
          onPreparing: (progress) =>
            set(progress === null ? { phase: 'scanning', photo } : { phase: 'preparing', photo, progress }),
        });
        // Decode it now, so the reveal starts with the image ready.
        await loadCutout(cutout.cutoutUri);
      } catch (error) {
        failure = error instanceof SegmentationError ? error.reason : 'failed';
      }

      const colors = await detectGarmentColors(cutout?.cutoutUri ?? photo.uri, { cutout: cutout !== null });
      await wait(Math.max(0, MIN_SCAN_MS - (Date.now() - started)));
      set({ phase: 'done', photo, cutout, colors, failure });
    })();

    return () => {
      alive = false;
    };
    // `key` covers the shot and each retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    state: state.key === key ? state.value : { phase: 'loading' },
    retry: () => setAttempt((a) => a + 1),
  };
}

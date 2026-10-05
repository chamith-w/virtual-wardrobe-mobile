import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';

import { usePreferences } from '@/store/preferences';

import { springs } from './tokens';

/**
 * True when motion should be reduced: the OS "Reduce Motion" setting or the
 * in-app override in Settings. Physics and 3D effects become simple fades.
 */
export function useMotionReduced(): boolean {
  const osReduced = useReducedMotion();
  const override = usePreferences((s) => s.reduceMotion);
  return osReduced || override;
}

type SpringName = keyof typeof springs;

/**
 * A spring config that honours the user's motion setting. When reduced, the
 * spring is skipped by Reanimated and the value jumps — callers that need a
 * visible transition should cross-fade instead.
 */
export function useSpring(name: SpringName = 'snappy') {
  const reduced = useMotionReduced();
  return { ...springs[name], reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System };
}

export { springs };

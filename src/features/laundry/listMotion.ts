import { Easing, FadeIn, FadeInDown, FadeOut, Keyframe, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';

/** Prototype `.lcard.leaving`: slides right, shrinks a little and fades (0.42s). */
const LEAVE = new Keyframe({
  0: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateX: 60 }, { scale: 0.95 }], easing: Easing.out(Easing.cubic) },
}).duration(420);

/**
 * Layout animations for the lent and dry-cleaner cards: they rise in, slide
 * away when returned, and the rest close the gap on a spring. Short fades
 * under Reduce Motion.
 */
export function useListMotion() {
  const reduced = useMotionReduced();
  if (reduced) {
    return {
      entering: () => FadeIn.duration(200).reduceMotion(ReduceMotion.Never),
      exiting: FadeOut.duration(200).reduceMotion(ReduceMotion.Never),
      layout: undefined,
    };
  }
  return {
    entering: (index: number) =>
      FadeInDown.springify()
        .damping(18)
        .delay(index * 50),
    exiting: LEAVE,
    layout: LinearTransition.springify().damping(18),
  };
}

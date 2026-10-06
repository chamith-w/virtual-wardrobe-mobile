import { Check, ChevronLeft, Info, Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Skeleton, Text, Toggle } from '@/components/ui';
import type { DetectedColor } from '@/lib/color-extract';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import { failureMessage } from '../segmentation';
import type { Processing } from '../useShotProcessing';
import { reviewStageFrame } from './layout';
import { MagicCutoutStage } from './MagicCutoutStage';

/** DESIGN.md #3: detected colour chips pop in 120ms apart. */
const CHIP_STAGGER = 120;

function ColourChip({ color, index }: { color: DetectedColor; index: number }) {
  const reduced = useMotionReduced();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(
      reduced
        ? withTiming(1, { duration: durations.reducedFade })
        : withDelay(300 + index * CHIP_STAGGER, withSpring(1, springs.bouncy)),
    );
  }, [index, reduced, shown]);
  const style = useAnimatedStyle(() => {
    const p = shown.get();
    if (reduced) return { opacity: p };
    return { opacity: Math.min(1, p * 1.6), transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  return (
    <Animated.View
      style={style}
      className="h-9 flex-row items-center gap-1.5 rounded-pill border border-line-strong bg-surface pl-2 pr-3"
      accessible
      accessibilityLabel={`${color.name}, about ${Math.round(color.coverage * 100)} percent`}
    >
      <View
        className="h-[18px] w-[18px] rounded-pill border border-line-strong"
        style={{ backgroundColor: color.hex }}
      />
      <Text variant="bodySm" weight="medium">
        {color.name}
      </Text>
      <Text variant="caption">{color.measured}</Text>
    </Animated.View>
  );
}

function Dot({ phase }: { phase: number }) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    pulse.set(
      withDelay(
        phase * 140,
        withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 })), -1),
      ),
    );
  }, [phase, pulse, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: reduced ? 0.6 : 0.3 + 0.7 * pulse.get() }));
  return <Animated.View className="h-1 w-1 rounded-pill" style={[{ backgroundColor: colors.ink }, style]} />;
}

/** "Lifting it off the background…" with three breathing dots. */
function WorkingDots() {
  return (
    <View className="flex-row gap-[3px] pl-0.5">
      <Dot phase={0} />
      <Dot phase={1} />
      <Dot phase={2} />
    </View>
  );
}

function StatusPill({ state, keepOriginal }: { state: Processing; keepOriginal: boolean }) {
  const { colors } = useTheme();
  let content;
  if (state.phase === 'loading' || state.phase === 'scanning') {
    content = (
      <>
        <Sparkles size={15} color={colors.ink} strokeWidth={2} />
        <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
          Lifting it off the background
        </Text>
        <WorkingDots />
      </>
    );
  } else if (state.phase === 'preparing') {
    content = (
      <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
        Preparing on-device cutouts · {Math.round(state.progress * 100)}%
      </Text>
    );
  } else if (state.phase === 'done' && state.cutout && !keepOriginal) {
    content = (
      <>
        <View className="h-5 w-5 items-center justify-center rounded-pill bg-success">
          <Check size={12} color={colors.background} strokeWidth={3} />
        </View>
        <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
          Clean cutout · {state.cutout.engine === 'device' ? 'on device' : 'remove.bg'}
        </Text>
      </>
    );
  } else {
    content = (
      <>
        <Info size={15} color={colors.muted} strokeWidth={2} />
        <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
          Keeping the photo as it is
        </Text>
      </>
    );
  }
  return (
    <View
      accessibilityLiveRegion="polite"
      className="h-[34px] flex-row items-center gap-[7px] rounded-pill border border-line bg-surface/90 pl-2.5 pr-3.5"
    >
      {content}
    </View>
  );
}

export type CutoutReviewProps = {
  state: Processing;
  keepOriginal: boolean;
  onKeepOriginal: (keep: boolean) => void;
  batchLabel: string | null;
  onRetake: () => void;
  onSkip: (() => void) | null;
  onRetry: () => void;
  onContinue: () => void;
};

/** Step 2 (AddItem.dc.html, cutout): the magic cutout, detected colours, keep-original, then Continue. */
export function CutoutReview({
  state,
  keepOriginal,
  onKeepOriginal,
  batchLabel,
  onRetake,
  onSkip,
  onRetry,
  onContinue,
}: CutoutReviewProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { width: stageW, height: stageH } = reviewStageFrame(width, height, insets.top);

  const done = state.phase === 'done';
  const photo = state.phase === 'loading' || state.phase === 'error' ? null : state.photo;
  const cutout = done ? state.cutout : null;
  const failure = done ? state.failure : null;
  const message = failure ? failureMessage(failure) : null;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 4 }}>
      <View className="h-11 flex-row items-center justify-between px-4">
        <IconButton icon={ChevronLeft} accessibilityLabel="Retake" onPress={onRetake} />
        <Text variant="title2">New piece</Text>
        <View className="min-w-11 flex-row items-center justify-end gap-2">
          {batchLabel ? (
            <View className="h-7 justify-center rounded-pill bg-surface-tinted px-2.5">
              <Text variant="caption" weight="bold" tone="ink">
                {batchLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {state.phase === 'error' ? (
          <View
            className="items-center justify-center rounded-[30px] bg-surface-tinted px-8"
            style={{ height: stageH }}
          >
            <Text variant="display3" className="text-center" style={{ fontSize: 22 }}>
              Couldn’t open this photo
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-2 text-center">
              {state.message} Try another one.
            </Text>
          </View>
        ) : (
          <MagicCutoutStage
            width={stageW}
            height={stageH}
            photo={photo}
            cutout={cutout}
            scanning={!done}
            keepOriginal={keepOriginal}
            status={<StatusPill state={state} keepOriginal={keepOriginal} />}
          />
        )}

        <Text variant="eyebrow" className="mt-5">
          Detected colours
        </Text>
        <View className="mt-2.5 min-h-9 flex-row flex-wrap gap-2">
          {done ? (
            state.colors.length > 0 ? (
              state.colors.map((c, i) => <ColourChip key={c.name} color={c} index={i} />)
            ) : (
              <Text variant="bodySm" tone="muted">
                None found. Pick them in the next step.
              </Text>
            )
          ) : (
            <>
              <Skeleton width={120} height={36} radius={18} />
              <Skeleton width={96} height={36} radius={18} />
            </>
          )}
        </View>

        {message ? (
          <View className="mt-4 rounded-md bg-surface-tinted p-3.5">
            <Text variant="bodySm" weight="semibold">
              {message.title}
            </Text>
            <Text variant="caption" className="mt-1">
              {message.body}
            </Text>
            {failure !== 'unavailable' ? (
              <Button label="Try again" variant="ghost" size="sm" className="-ml-4 mt-1" onPress={onRetry} />
            ) : null}
          </View>
        ) : null}

        <View className="mt-4 h-[52px] flex-row items-center justify-between rounded-[16px] bg-surface-tinted pl-3.5 pr-2">
          <View className="flex-1">
            <Text variant="bodySm" weight="semibold">
              Keep original
            </Text>
            {!cutout && done ? <Text variant="caption">No cutout for this one</Text> : null}
          </View>
          <Toggle
            value={keepOriginal || (done && !cutout)}
            onValueChange={onKeepOriginal}
            disabled={!cutout}
            accessibilityLabel="Keep the original photo instead of the cutout"
          />
        </View>
      </ScrollView>

      <View className="flex-row gap-2.5 px-6" style={{ paddingBottom: insets.bottom + 16 }}>
        {onSkip ? <Button label="Skip" variant="secondary" onPress={onSkip} /> : null}
        <Button label="Continue" className="flex-1" disabled={!done} onPress={onContinue} />
      </View>
    </View>
  );
}

import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { ReactNode, Ref } from 'react';
import { View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radii } from '@/theme/tokens';

import { Text } from './Text';

export type SheetRef = BottomSheetModal;

export type SheetProps = {
  ref?: Ref<BottomSheetModal>;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  /** Omit for content-sized sheets (the default). */
  snapPoints?: (string | number)[];
  scrollable?: boolean;
  onDismiss?: () => void;
  /**
   * Opening this sheet while another is open: 'switch' (default) tucks the
   * other away until this one closes; 'push' stacks this one on top.
   */
  stackBehavior?: 'push' | 'switch' | 'replace';
};

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.42} pressBehavior="close" />
  );
}

/**
 * Themed bottom sheet. Open with `ref.current?.present()`, close with
 * `ref.current?.dismiss()`. Requires <BottomSheetModalProvider> (root layout).
 */
export function Sheet({
  ref,
  title,
  eyebrow,
  children,
  snapPoints,
  scrollable = false,
  onDismiss,
  stackBehavior,
}: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 22,
    stiffness: 220,
    mass: 0.9,
    overshootClamping: false,
    reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System,
  });

  const Body = scrollable ? BottomSheetScrollView : BottomSheetView;
  const header =
    title || eyebrow ? (
      <View className="mb-4 gap-1.5">
        {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
        {title ? <Text variant="display3">{title}</Text> : null}
      </View>
    ) : null;

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      animationConfigs={animationConfigs}
      backdropComponent={Backdrop}
      onDismiss={onDismiss}
      stackBehavior={stackBehavior}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radii.lg }}
      handleIndicatorStyle={{ backgroundColor: colors.faint, width: 40, height: 5 }}
      accessible={false}
    >
      <Body style={{ paddingHorizontal: layout.screenGutter, paddingTop: 4, paddingBottom: insets.bottom + 24 }}>
        {header}
        {children}
      </Body>
    </BottomSheetModal>
  );
}

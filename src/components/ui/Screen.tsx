import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/navigation/TabBar';

export type ScreenProps = Omit<ScrollViewProps, 'children'> & {
  children: ReactNode;
  /** Scrollable content (default) or a fixed full-screen layout. */
  scroll?: boolean;
  /** Leave room for the floating tab bar. Off for modals. */
  tabBarInset?: boolean;
  className?: string;
};

/** Screen container: safe-area top, generous gutters, room for the floating tab bar. */
export function Screen({
  children,
  scroll = true,
  tabBarInset = true,
  className,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const bottom = tabBarInset ? tabInset + 16 : insets.bottom + 24;
  const top = insets.top + 8;

  if (!scroll) {
    return (
      <View
        className={['flex-1 bg-background', className].filter(Boolean).join(' ')}
        style={{ paddingTop: top, paddingBottom: bottom }}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={[{ paddingTop: top, paddingBottom: bottom }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      {...rest}
    >
      <View className={className}>{children}</View>
    </ScrollView>
  );
}

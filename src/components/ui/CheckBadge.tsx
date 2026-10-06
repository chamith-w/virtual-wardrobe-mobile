import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** The filled tick that marks the chosen row in a picker sheet. */
export function CheckBadge() {
  const { colors } = useTheme();
  return (
    <View className="h-7 w-7 items-center justify-center rounded-pill bg-inverse">
      <Check size={16} color={colors.onInverse} strokeWidth={2.6} />
    </View>
  );
}

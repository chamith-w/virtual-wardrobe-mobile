import { Camera, Images, Settings } from 'lucide-react-native';
import { Linking, View } from 'react-native';

import { HangerGlyph } from '@/components/illustrations/Glyphs';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export type CameraGate = 'ask' | 'denied' | 'unavailable';

const COPY: Record<CameraGate, { title: string; body: string }> = {
  ask: {
    title: 'Photograph your clothes',
    body: 'Snap a piece and My Closet lifts it off the background, right here on your phone. Photos never leave it.',
  },
  denied: {
    title: 'Camera access is off',
    body: 'Turn it on in Settings to photograph pieces, or add them from photos you’ve already taken.',
  },
  unavailable: {
    title: 'The camera isn’t available',
    body: 'It couldn’t start here (the Simulator has none). Add pieces from your photos instead.',
  },
};

/**
 * Shown in the viewfinder before the camera can run: a branded ask before the
 * system prompt (first add only), a way to Settings once access was refused,
 * or a gallery-only fallback without a camera.
 */
export function PermissionCard({
  gate,
  onAllow,
  onPickPhotos,
}: {
  gate: CameraGate;
  onAllow: () => void;
  onPickPhotos: () => void;
}) {
  const { colors } = useTheme();
  const { title, body } = COPY[gate];
  return (
    <View className="flex-1 items-center justify-center px-7">
      <View className="mb-6 h-28 w-28 items-center justify-center rounded-pill bg-surface-tinted">
        <View className="absolute top-7 h-[3px] w-20 rounded-pill" style={{ backgroundColor: colors.rail }} />
        <HangerGlyph width={64} color={colors.faint} />
        <View className="absolute bottom-5 right-5 h-9 w-9 items-center justify-center rounded-pill bg-accent-strong">
          <Camera size={18} color={colors.onAccent} strokeWidth={2} />
        </View>
      </View>
      <Text variant="display3" className="text-center">
        {title}
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-2 text-center">
        {body}
      </Text>
      <View className="mt-6 gap-2.5 self-stretch">
        {gate === 'ask' ? (
          <Button label="Allow camera" variant="accent" icon={Camera} fullWidth onPress={onAllow} />
        ) : gate === 'denied' ? (
          <Button label="Open Settings" icon={Settings} fullWidth onPress={() => Linking.openSettings()} />
        ) : null}
        <Button label="Choose from photos" variant="secondary" icon={Images} fullWidth onPress={onPickPhotos} />
      </View>
    </View>
  );
}

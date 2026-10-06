import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Images, SwitchCamera, X, Zap, ZapOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { newId } from '@/lib/ids';
import { toast } from '@/store/toast';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';

import type { Shot } from '../flow';
import { GuideOverlay, type GuideMode } from './GuideOverlay';
import { PermissionCard, type CameraGate } from './PermissionCard';

/** At most this many photos per gallery batch. */
const BATCH_LIMIT = 10;

function ModeSwitch({ mode, onChange }: { mode: GuideMode; onChange: (mode: GuideMode) => void }) {
  const { colors } = useTheme();
  const option = (value: GuideMode, label: string) => {
    const on = value === mode;
    return (
      <AnimatedPressable
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${label} guide`}
        onPress={() => onChange(value)}
        className="h-[34px] justify-center rounded-pill px-3.5"
        style={on ? { backgroundColor: colors.ink } : undefined}
      >
        <Text variant="bodySm" weight="semibold" tone={on ? 'onInverse' : 'ink'} style={{ fontSize: 13 }}>
          {label}
        </Text>
      </AnimatedPressable>
    );
  };
  return (
    <View
      accessibilityRole="radiogroup"
      className="h-10 flex-row rounded-pill p-[3px]"
      style={{ backgroundColor: withAlpha(colors.ink, 0.12) }}
    >
      {option('hanger', 'Hanger')}
      {option('flat', 'Flat lay')}
    </View>
  );
}

export type CaptureViewProps = {
  /** "Background removed on device" etc., under the viewfinder. */
  caption: string;
  onCaptured: (shots: Shot[]) => void;
  onClose: () => void;
};

/**
 * Step 1 of the add flow (AddItem.dc.html, capture): the camera with a
 * garment guide, flash, flip and shutter, plus the gallery for several
 * photos at once. Rendered inside a dark SchemeScope.
 */
export function CaptureView({ caption, onCaptured, onClose }: CaptureViewProps) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  // `isAvailableAsync` only exists on web (it throws on iOS and Android). On a
  // phone the camera is assumed present; a failed mount flips this to false.
  const [available, setAvailable] = useState<boolean | null>(Platform.OS === 'web' ? null : true);
  const [mode, setMode] = useState<GuideMode>('hanger');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const camera = useRef<CameraView>(null);
  const busy = useRef(false);
  const flashOverlay = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    CameraView.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  const finderTop = insets.top + 56;
  const finderWidth = width - 24;
  const finderHeight = Math.min(height - finderTop - insets.bottom - 200, finderWidth * 1.36);

  // Nothing until both the availability check and the permission status are in.
  const gate: CameraGate | null =
    available === null
      ? null
      : available === false
        ? 'unavailable'
        : permission && !permission.granted
          ? permission.canAskAgain
            ? 'ask'
            : 'denied'
          : null;
  const live = available === true && !!permission?.granted;

  const pickPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: BATCH_LIMIT,
        orderedSelection: true,
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;
      haptics.press();
      onCaptured(
        result.assets.map((a) => ({ id: newId(), uri: a.uri, width: a.width, height: a.height, source: 'library' })),
      );
    } catch {
      toast('Couldn’t open your photos', 'info');
    }
  };

  const shoot = async () => {
    if (!camera.current || !ready || busy.current) return;
    busy.current = true;
    haptics.press();
    if (!reduced) flashOverlay.set(withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 320 })));
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.92 });
      onCaptured([{ id: newId(), uri: picture.uri, width: picture.width, height: picture.height, source: 'camera' }]);
    } catch {
      toast('Couldn’t take the photo, try again', 'info');
    } finally {
      busy.current = false;
    }
  };

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOverlay.get() }));

  return (
    <View className="flex-1 bg-background">
      <View
        className="absolute left-4 right-4 z-10 flex-row items-center justify-between"
        style={{ top: insets.top + 4 }}
      >
        <IconButton icon={X} variant="tinted" accessibilityLabel="Close" onPress={onClose} />
        <ModeSwitch mode={mode} onChange={setMode} />
        <IconButton
          icon={flash === 'on' ? Zap : ZapOff}
          variant={flash === 'on' ? 'inverse' : 'tinted'}
          accessibilityLabel={flash === 'on' ? 'Flash on' : 'Flash off'}
          accessibilityState={{ selected: flash === 'on' }}
          disabled={!live}
          onPress={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
        />
      </View>

      <View
        className="absolute left-3 right-3 overflow-hidden rounded-[30px] bg-surface-tinted"
        style={{ top: finderTop, height: finderHeight }}
      >
        {live ? (
          <>
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              animateShutter={false}
              onCameraReady={() => setReady(true)}
              onMountError={() => setAvailable(false)}
            />
            <GuideOverlay mode={mode} width={finderWidth} height={finderHeight} />
          </>
        ) : gate ? (
          <PermissionCard gate={gate} onAllow={() => requestPermission()} onPickPhotos={pickPhotos} />
        ) : null}
      </View>

      <Text
        variant="eyebrow"
        className="absolute left-0 right-0 text-center"
        style={{ top: finderTop + finderHeight + 16, fontSize: 12 }}
      >
        {caption}
      </Text>

      <View
        className="absolute left-7 right-7 flex-row items-center justify-between"
        style={{ bottom: insets.bottom + 28 }}
      >
        <AnimatedPressable
          accessibilityLabel="Choose from photos"
          accessibilityHint={`Pick up to ${BATCH_LIMIT} photos to add at once`}
          onPress={pickPhotos}
          className="h-14 w-14 items-center justify-center rounded-[16px] bg-surface-tinted"
        >
          <Images size={24} color={colors.ink} strokeWidth={1.8} />
        </AnimatedPressable>
        <AnimatedPressable
          accessibilityLabel="Take photo"
          disabled={!live || !ready}
          haptic="none"
          onPress={shoot}
          scaleTo={0.9}
          className="h-[82px] w-[82px] items-center justify-center rounded-pill border-4 border-ink"
          style={{ opacity: live && ready ? 1 : 0.4 }}
        >
          <View className="h-16 w-16 rounded-pill bg-ink" />
        </AnimatedPressable>
        <IconButton
          icon={SwitchCamera}
          variant="tinted"
          size={56}
          iconSize={22}
          accessibilityLabel="Switch camera"
          disabled={!live}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }, flashStyle]}
      />
    </View>
  );
}

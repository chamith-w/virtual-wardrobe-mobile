import {
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  Shadow,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, shadowOpacity } from '@/theme/tokens';

// ---------------------------------------------------------------- cache --
// Decoded cutouts, newest last. Budgeted by pixels (~48 MB of RGBA) so paging
// through full-size detail images can't balloon memory.
const PIXEL_BUDGET = 12_000_000;
const cache = new Map<string, SkImage>();
const pending = new Map<string, Promise<SkImage | null>>();
let cachedPixels = 0;

const pixels = (img: SkImage) => img.width() * img.height();

function remember(uri: string, img: SkImage) {
  const prev = cache.get(uri);
  if (prev) {
    cache.delete(uri);
    cachedPixels -= pixels(prev);
  }
  cache.set(uri, img);
  cachedPixels += pixels(img);
  for (const [key, old] of cache) {
    if (cachedPixels <= PIXEL_BUDGET || key === uri) break;
    cache.delete(key);
    cachedPixels -= pixels(old);
  }
}

/** Decodes (once) the image at a file URI. Resolves null if it can't be read. */
export function loadCutout(uri: string): Promise<SkImage | null> {
  const hit = cache.get(uri);
  if (hit) {
    remember(uri, hit);
    return Promise.resolve(hit);
  }
  const inflight = pending.get(uri);
  if (inflight) return inflight;
  const task = Skia.Data.fromURI(uri)
    .then((data) => Skia.Image.MakeImageFromEncoded(data))
    .then((img) => {
      if (img) remember(uri, img);
      return img;
    })
    .catch(() => null)
    .finally(() => pending.delete(uri));
  pending.set(uri, task);
  return task;
}

/** The decoded Skia image for a URI, or null while it loads. */
export function useCutoutImage(uri: string | null | undefined): SkImage | null {
  const [loaded, setLoaded] = useState<{ uri: string; image: SkImage } | null>(null);
  const cached = uri ? (cache.get(uri) ?? null) : null;

  useEffect(() => {
    if (!uri || cache.has(uri)) return;
    let alive = true;
    loadCutout(uri).then((image) => {
      if (alive && image) setLoaded({ uri, image });
    });
    return () => {
      alive = false;
    };
  }, [uri]);

  if (!uri) return null;
  return cached ?? (loaded?.uri === uri ? loaded.image : null);
}

// --------------------------------------------------------------- shadow --
export type CutoutShadow = 'none' | 'soft' | 'lifted';

function shadowGeometry(kind: CutoutShadow, height: number) {
  if (kind === 'lifted') {
    const dy = Math.min(18, Math.max(8, height * 0.06));
    return { dy, sigma: dy * 0.45, contactDy: 2, contactSigma: 1.5 };
  }
  const dy = Math.min(12, Math.max(2, height * 0.075));
  return { dy, sigma: dy * 0.45, contactDy: 1, contactSigma: 1 };
}

/** Colour matrix that blends towards luminance grey by `amount` (0–1). */
function desaturateMatrix(amount: number): number[] {
  const s = 1 - amount;
  const [r, g, b] = [0.2126 * amount, 0.7152 * amount, 0.0722 * amount];
  return [r + s, g, b, 0, 0, r, g + s, b, 0, 0, r, g, b + s, 0, 0, 0, 0, 0, 1, 0];
}

export type CutoutProps = {
  uri: string | null | undefined;
  width: number;
  height: number;
  /** `soft` for lists and the closet, `lifted` for detail. */
  shadow?: CutoutShadow;
  /** 0–1: greys the garment out (filtered-out or out-of-wardrobe pieces). */
  desaturate?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A background-removed garment with a soft shadow that follows its silhouette
 * — a Skia drop shadow built from the image's alpha mask, never a box shadow.
 * The canvas bleeds past the layout box so the shadow is never clipped.
 */
export function Cutout({
  uri,
  width,
  height,
  shadow = 'soft',
  desaturate = 0,
  accessibilityLabel,
  style,
}: CutoutProps) {
  const { colors, scheme } = useTheme();
  const reduced = useMotionReduced();
  const image = useCutoutImage(uri);
  const [wasCached] = useState(() => !!uri && cache.has(uri));
  const opacity = useSharedValue(wasCached ? 1 : 0);

  useEffect(() => {
    if (image) opacity.set(withTiming(1, { duration: reduced ? durations.reducedFade : 240 }));
  }, [image, opacity, reduced]);

  const geo = shadowGeometry(shadow, height);
  const pad = shadow === 'none' ? 0 : Math.ceil(geo.dy + geo.sigma * 3);
  const strength = shadowOpacity[scheme];

  return (
    <View
      pointerEvents="none"
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width, height }, style]}
    >
      {image ? (
        <Canvas style={{ position: 'absolute', left: -pad, top: -pad, width: width + pad * 2, height: height + pad * 2 }}>
          <Group opacity={opacity}>
            <SkiaImage image={image} x={pad} y={pad} width={width} height={height} fit="contain">
              {desaturate > 0 ? <ColorMatrix matrix={desaturateMatrix(desaturate)} /> : null}
              {shadow !== 'none' ? (
                <Shadow dx={0} dy={geo.dy} blur={geo.sigma} color={withAlpha(colors.shadow, strength.strong)} />
              ) : null}
              {shadow !== 'none' ? (
                <Shadow
                  dx={0}
                  dy={geo.contactDy}
                  blur={geo.contactSigma}
                  color={withAlpha(colors.shadow, strength.soft)}
                />
              ) : null}
            </SkiaImage>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

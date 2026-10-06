import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

import { loadCutout } from '@/components/ui';
import { detectColors, type DetectedColor } from '@/lib/color-extract';

/**
 * Reads an image as a small RGBA buffer (unpremultiplied) for colour
 * detection: drawn into a ~64px CPU surface, then `readPixels`.
 * `centre` samples only the middle half, for photos without a cutout.
 */
export async function samplePixels(
  uri: string,
  { maxSide = 64, centre = false }: { maxSide?: number; centre?: boolean } = {},
): Promise<Uint8Array | null> {
  const image = await loadCutout(uri);
  if (!image) return null;
  const w = image.width();
  const h = image.height();
  const src = centre ? Skia.XYWHRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5) : Skia.XYWHRect(0, 0, w, h);
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));

  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  canvas.drawImageRect(image, src, Skia.XYWHRect(0, 0, width, height), Skia.Paint());
  surface.flush();
  const pixels = surface
    .makeImageSnapshot()
    .readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  return pixels instanceof Uint8Array ? pixels : null;
}

/** 1–3 named colours of a cutout (or of the middle of a photo when there's no cutout). */
export async function detectGarmentColors(uri: string, { cutout }: { cutout: boolean }): Promise<DetectedColor[]> {
  try {
    const pixels = await samplePixels(uri, { centre: !cutout });
    return pixels ? detectColors(pixels) : [];
  } catch {
    return [];
  }
}

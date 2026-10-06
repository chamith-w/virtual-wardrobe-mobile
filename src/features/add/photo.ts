import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { fitInside, PHOTO_SIDE } from './images';
import type { Photo } from './segmentation';

/**
 * The working copy of a captured or picked photo: upright (EXIF applied),
 * at most 2048px, JPEG. Segmentation reads it and it's kept as the original.
 * HEIC and other formats from the library come out as plain JPEG.
 */
export async function prepareWorkingPhoto(uri: string): Promise<Photo> {
  const upright = await ImageManipulator.manipulate(uri).renderAsync();
  const size = fitInside(upright.width, upright.height, PHOTO_SIDE);
  let image = upright;
  if (size.width !== upright.width || size.height !== upright.height) {
    image = await ImageManipulator.manipulate(upright).resize(size).renderAsync();
    upright.release();
  }
  try {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.88 });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } finally {
    image.release();
  }
}

/** Resizes an image to fit `maxSide` and saves it as WebP (keeps alpha). */
export async function renderWebp(uri: string, maxSide: number, compress: number): Promise<string> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const size = fitInside(source.width, source.height, maxSide);
  let image = source;
  if (size.width !== source.width || size.height !== source.height) {
    image = await ImageManipulator.manipulate(source).resize(size).renderAsync();
    source.release();
  }
  try {
    const saved = await image.saveAsync({ format: SaveFormat.WEBP, compress });
    return saved.uri;
  } finally {
    image.release();
  }
}

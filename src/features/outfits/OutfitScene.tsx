import { FilterMode, Group, Image, MipmapMode, Shadow } from '@shopify/react-native-skia';

import { colors, shadowOpacity } from '@/theme/tokens';
import { withAlpha } from '@/theme/ThemeProvider';

import { imageRectForGarment } from './bounds';
import { BOARD_ASPECT, contentSize, type NormalisedPose, type Rect } from './canvas';
import type { PieceArt } from './pieceArt';

/** Scenes are laid out on a board this many points wide, then scaled to whatever they're drawn at. */
export const SCENE_WIDTH = 360;

/** Mipmapped sampling so 1200px cutouts stay smooth when drawn small. */
export const SMOOTH_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear } as const;

export type SceneShadow = { strong: string; soft: string };

/**
 * Saved snapshots are shown in both themes, so they carry the light theme's
 * warm shadow: true to the cream board, and quiet on the dark one.
 */
export const SNAPSHOT_SHADOW: SceneShadow = {
  strong: withAlpha(colors.light.shadow, shadowOpacity.light.strong),
  soft: withAlpha(colors.light.shadow, shadowOpacity.light.soft),
};

/** The silhouette shadow under a garment `height` points tall (as Cutout's soft shadow). */
export function garmentShadow(height: number) {
  const dy = Math.min(12, Math.max(3, height * 0.07));
  return { dy, blur: dy * 0.45 };
}

/**
 * One garment drawn so its visible bounds fill a `width` × `height` box
 * centred on the origin, with a two-layer shadow from its alpha mask. The
 * builder, the outfit list and saved snapshots all draw garments with this.
 */
export function GarmentArt({
  art,
  width,
  height,
  shadow,
}: {
  art: PieceArt;
  width: number;
  height: number;
  shadow: SceneShadow;
}) {
  const r = imageRectForGarment(art.bounds, width, height);
  const geo = garmentShadow(height);
  return (
    <Image image={art.image} x={r.x} y={r.y} width={r.width} height={r.height} fit="fill" sampling={SMOOTH_SAMPLING}>
      <Shadow dx={0} dy={geo.dy} blur={geo.blur} color={shadow.strong} />
      <Shadow dx={0} dy={1} blur={1} color={shadow.soft} />
    </Image>
  );
}

export type ScenePiece = NormalisedPose & { key: string; z: number; art: PieceArt };

/**
 * A still outfit board: its pieces back to front, cropped to `frame` (in
 * board-width units, see `contentFrame`) and scaled to `width` points. Drawn
 * offscreen for snapshots and on screen while a snapshot is missing, so the
 * two look the same.
 */
export function OutfitScene({
  pieces,
  frame,
  width,
  shadow = SNAPSHOT_SHADOW,
}: {
  pieces: readonly ScenePiece[];
  frame: Rect;
  width: number;
  shadow?: SceneShadow;
}) {
  const k = width / (frame.width * SCENE_WIDTH);
  return (
    <Group transform={[{ scale: k }, { translateX: -frame.x * SCENE_WIDTH }, { translateY: -frame.y * SCENE_WIDTH }]}>
      {[...pieces]
        .sort((a, b) => a.z - b.z)
        .map((piece) => {
          const size = contentSize(piece.art.aspect, 1, SCENE_WIDTH);
          return (
            <Group
              key={piece.key}
              transform={[
                { translateX: piece.x * SCENE_WIDTH },
                { translateY: piece.y * SCENE_WIDTH * BOARD_ASPECT },
                { rotate: (piece.rotation * Math.PI) / 180 },
                { scale: piece.scale },
              ]}
            >
              <GarmentArt art={piece.art} width={size.width} height={size.height} shadow={shadow} />
            </Group>
          );
        })}
    </Group>
  );
}

import { Canvas, Group } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { Layers } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations } from '@/theme/tokens';

import { contentFrame, type Rect } from './canvas';
import { OutfitScene, type ScenePiece } from './OutfitScene';
import { thumbUri, usePieceArts } from './pieceArt';
import { requestSnapshot } from './snapshots';
import type { OutfitPiece } from './useOutfits';

/** The frame fitted inside a box: its drawn size and offset. */
function fit(frame: Rect, width: number, height: number) {
  const aspect = frame.height / frame.width;
  const w = Math.min(width, height / aspect);
  const h = w * aspect;
  return { width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 };
}

/** The board drawn live while its snapshot is being made; it fades in once every piece has loaded. */
function LiveScene({
  pieces,
  frame,
  width,
  height,
}: {
  pieces: OutfitPiece[];
  frame: Rect;
  width: number;
  height: number;
}) {
  const reduced = useMotionReduced();
  const uris = pieces.flatMap((p) => thumbUri(p) ?? []);
  const arts = usePieceArts(uris);
  const opacity = useSharedValue(0);
  const complete = uris.every((u) => arts.has(u));

  useEffect(() => {
    if (complete) opacity.set(withTiming(1, { duration: reduced ? durations.reducedFade : 240 }));
  }, [complete, opacity, reduced]);

  if (!complete) return null;
  const scene: ScenePiece[] = pieces.flatMap((p) => {
    const uri = thumbUri(p);
    const art = uri ? arts.get(uri) : undefined;
    return art ? [{ key: p.itemId, x: p.x, y: p.y, scale: p.scale, rotation: p.rotation, z: p.zIndex, art }] : [];
  });
  return (
    <Canvas style={{ width, height }}>
      <Group opacity={opacity}>
        <OutfitScene pieces={scene} frame={frame} width={width} />
      </Group>
    </Canvas>
  );
}

/**
 * An outfit's board as a thumbnail: its saved snapshot, or, until there is
 * one, the same scene drawn live while the snapshot renders in the
 * background. Without `height` it takes the board's own shape (for masonry);
 * with one, the board is fitted inside.
 */
export function OutfitThumb({
  outfit,
  width,
  height,
}: {
  outfit: { id: string; snapshotUri: string | null; pieces: OutfitPiece[] };
  width: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const { id, snapshotUri, pieces } = outfit;
  const frame = contentFrame(pieces);
  const boxH = height ?? (width * frame.height) / frame.width;
  const art = fit(frame, width, boxH);
  const hasPieces = pieces.length > 0;

  // When a snapshot arrives for a board this card was drawing live, the live
  // scene stays underneath until the image has loaded, so nothing blinks.
  // (A recycled cell that never drew live goes straight to the image.)
  const [liveFor, setLiveFor] = useState<string | null>(snapshotUri ? null : id);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  if (!snapshotUri && liveFor !== id) setLiveFor(id);
  const showLive = hasPieces && (!snapshotUri || (liveFor === id && loadedUri !== snapshotUri));

  useEffect(() => {
    if (!snapshotUri && hasPieces) requestSnapshot(id);
  }, [id, snapshotUri, hasPieces]);

  const place = { position: 'absolute', left: art.left, top: art.top } as const;
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-[18px] bg-surface-tinted"
      style={{ width, height: boxH }}
    >
      {!hasPieces ? <Layers size={28} color={colors.faint} strokeWidth={1.4} /> : null}
      {showLive ? (
        <View style={place}>
          <LiveScene pieces={pieces} frame={frame} width={art.width} height={art.height} />
        </View>
      ) : null}
      {hasPieces && snapshotUri ? (
        <Image
          source={{ uri: snapshotUri }}
          recyclingKey={id}
          contentFit="fill"
          transition={reduced || liveFor === id ? 0 : 160}
          onLoad={() => setLoadedUri(snapshotUri)}
          style={{ ...place, width: art.width, height: art.height }}
          accessible={false}
        />
      ) : null}
    </View>
  );
}

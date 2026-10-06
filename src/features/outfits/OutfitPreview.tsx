import { View } from 'react-native';

import { Cutout } from '@/components/ui';

import type { OutfitPiece } from './useOutfits';

/**
 * A miniature of an outfit board: each piece placed at its saved (normalised)
 * position, scale and rotation, back to front. Phase 5 replaces this with the
 * saved canvas snapshot where one exists.
 */
export function OutfitPreview({ pieces, width, height }: { pieces: OutfitPiece[]; width: number; height: number }) {
  const base = Math.min(width, height) * 0.5;
  return (
    <View className="overflow-hidden rounded-[18px] bg-surface-tinted" style={{ width, height }}>
      {[...pieces]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((p) => {
          const w = base * p.scale;
          const h = w * 1.18;
          return (
            <View
              key={p.itemId}
              style={{
                position: 'absolute',
                left: p.x * width - w / 2,
                top: p.y * height - h / 2,
                transform: [{ rotate: `${p.rotation}deg` }],
              }}
            >
              <Cutout uri={p.thumbUri} width={w} height={h} />
            </View>
          );
        })}
    </View>
  );
}

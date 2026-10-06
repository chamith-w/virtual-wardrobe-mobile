import { router } from 'expo-router';
import { Heart, Layers, X } from 'lucide-react-native';
import { useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { AnimatedPressable, Card, Cutout, EmptyState, IconButton, Screen, Text } from '@/components/ui';
import { openItem } from '@/features/items/openItem';
import { useItem } from '@/features/items/useItem';
import { useHiddenForHero } from '@/store/itemTransition';
import { useTheme } from '@/theme/ThemeProvider';

import { outfitMeta } from './list';
import { setOutfitFavorite } from './mutations';
import { OutfitPreview } from './OutfitPreview';
import { useOutfit, type OutfitPiece } from './useOutfits';

function PieceRow({
  piece,
  last,
  onOpen,
}: {
  piece: OutfitPiece;
  last: boolean;
  onOpen: (thumb: View | null) => void;
}) {
  const thumb = useRef<View>(null);
  const hidden = useHiddenForHero(piece.itemId);
  return (
    <AnimatedPressable
      accessibilityLabel={piece.name}
      accessibilityHint="Opens this piece"
      onPress={() => onOpen(thumb.current)}
      scaleTo={0.98}
      className={['min-h-[76px] flex-row items-center gap-3.5 py-2.5', last ? '' : 'border-b border-line'].join(' ')}
    >
      <View className="h-16 w-14 items-center justify-center rounded-[14px] bg-surface-tinted">
        <View ref={thumb} collapsable={false} style={{ opacity: hidden ? 0 : 1 }}>
          <Cutout uri={piece.thumbUri} width={44} height={52} />
        </View>
      </View>
      <Text variant="body" weight="semibold" className="flex-1" numberOfLines={1}>
        {piece.name}
      </Text>
    </AnimatedPressable>
  );
}

/** A saved outfit: its board, what's in it and its tags. Arranging it is the builder's job (phase 5). */
export function OutfitScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { outfit, loaded } = useOutfit(id);
  const boardW = width - 40;

  if (loaded && !outfit) {
    return (
      <Screen tabBarInset={false} className="px-5">
        <View className="h-11 flex-row items-center">
          <IconButton icon={X} accessibilityLabel="Close" onPress={() => router.back()} />
        </View>
        <View className="pt-10">
          <EmptyState
            title="This outfit is gone"
            body="It may have been deleted."
            illustration="shelf"
            actionLabel="Back"
            onAction={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen tabBarInset={false} className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <IconButton icon={X} accessibilityLabel="Close" onPress={() => router.back()} />
        {outfit ? (
          <AnimatedPressable
            accessibilityLabel="Favourite"
            accessibilityRole="switch"
            accessibilityState={{ checked: outfit.isFavorite }}
            onPress={() => setOutfitFavorite(outfit.id, !outfit.isFavorite)}
            className="h-11 w-11 items-center justify-center rounded-pill border border-line bg-surface"
          >
            <Heart
              size={20}
              strokeWidth={1.8}
              color={outfit.isFavorite ? colors.accent : colors.ink}
              fill={outfit.isFavorite ? colors.accent : 'transparent'}
            />
          </AnimatedPressable>
        ) : null}
      </View>

      {outfit ? (
        <>
          <Text variant="eyebrow" className="mt-4">
            {outfitMeta({ occasion: outfit.occasion, seasons: outfit.seasons, pieceCount: outfit.pieces.length })}
          </Text>
          <Text variant="display2" accessibilityRole="header" className="mt-1.5">
            {outfit.name}
          </Text>
          <View
            className="mt-5"
            accessible
            accessibilityLabel={`Board with ${outfit.pieces.map((p) => p.name).join(', ')}`}
          >
            <OutfitPreview pieces={outfit.pieces} width={boardW} height={boardW * 1.1} />
          </View>

          <Text variant="eyebrow" className="mb-1 mt-7">
            Pieces
          </Text>
          {outfit.pieces.map((p, i) => (
            <PieceRow
              key={p.itemId}
              piece={p}
              last={i === outfit.pieces.length - 1}
              onOpen={(thumb) =>
                openItem(
                  { id: p.itemId, wardrobeId: null, thumbUri: p.thumbUri },
                  { from: thumb, browseIds: outfit.pieces.map((x) => x.itemId) },
                )
              }
            />
          ))}

          <Card tone="tinted" className="mt-6 flex-row items-center gap-3">
            <Layers size={20} color={colors.muted} strokeWidth={1.7} />
            <Text variant="bodySm" tone="muted" className="flex-1">
              Arranging, shuffling and snapshots arrive with the outfit builder in phase 5.
            </Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

/** Placeholder for the builder (phase 5), showing the piece it would start with. */
export function NewOutfitPlaceholder({ itemId }: { itemId?: string }) {
  const { width } = useWindowDimensions();
  const { item } = useItem(itemId);
  const boardW = width - 40;
  return (
    <Screen tabBarInset={false} className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <IconButton icon={X} accessibilityLabel="Close" onPress={() => router.back()} />
        <Text variant="title2">New outfit</Text>
        <View className="w-11" />
      </View>
      {item ? (
        <View className="mt-5 items-center justify-center rounded-[18px] bg-board" style={{ height: boardW * 0.9 }}>
          <Cutout uri={item.thumbUri} width={boardW * 0.42} height={boardW * 0.5} shadow="lifted" />
          <Text variant="caption" className="absolute bottom-3">
            Starting with {item.name.toLowerCase()}
          </Text>
        </View>
      ) : null}
      <View className="mt-5">
        <EmptyState
          title="The builder arrives in phase 5"
          body="Drag pieces onto a board, pinch to scale, rotate, lock and shuffle, then save it with a snapshot."
          illustration="shelf"
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </View>
    </Screen>
  );
}

import { Check, Pencil, Shuffle } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, IconButton, Text } from '@/components/ui';
import { BoardTag, WornBadge } from '@/features/outfits/BoardBadges';
import { LookBoard } from '@/features/outfits/LookBoard';
import type { OutfitPiece } from '@/features/outfits/useOutfits';
import { useTheme } from '@/theme/ThemeProvider';

export const CARD_WIDTH = 304;
export const CARD_GAP = 12;
const PAD = 10;
const BOARD_H = 244;

/**
 * One of Today's outfits: the look on a tinted board with its tags, a name
 * and why it suits the day, then Wear this, Shuffle and Edit.
 */
export function LookCardView({
  pieces,
  eyebrow,
  name,
  meta,
  tags,
  popKey,
  worn,
  onWear,
  onUnwear,
  onShuffle,
  onEdit,
}: {
  pieces: OutfitPiece[];
  eyebrow: string;
  name: string;
  meta: string;
  tags: string[];
  popKey: string;
  worn: boolean;
  onWear: () => void;
  onUnwear: () => void;
  onShuffle: () => void;
  onEdit: () => void;
}) {
  const { colors, scheme } = useTheme();
  const boardW = CARD_WIDTH - PAD * 2;
  return (
    <View
      className="rounded-lg border border-line bg-surface"
      style={{
        width: CARD_WIDTH,
        padding: PAD,
        shadowColor: colors.shadow,
        shadowOpacity: scheme === 'dark' ? 0.4 : 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 16 },
        elevation: 3,
      }}
      accessible={false}
    >
      <View
        className="overflow-hidden rounded-md bg-surface-tinted"
        style={{ height: BOARD_H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${name}: ${pieces.map((p) => p.name).join(', ')}`}
      >
        <LookBoard pieces={pieces} width={boardW} height={BOARD_H} popKey={popKey} />
        <View className="absolute left-2.5 top-2.5 flex-row gap-1.5" pointerEvents="none">
          {tags.map((t) => (
            <BoardTag key={t} label={t} />
          ))}
        </View>
        {worn ? (
          <View className="absolute bottom-2.5 right-2.5" pointerEvents="none">
            <WornBadge />
          </View>
        ) : null}
      </View>
      <View className="px-2 pb-1 pt-3.5">
        <Text variant="eyebrow">{eyebrow}</Text>
        <Text variant="display3" numberOfLines={1} className="mt-1" style={{ fontSize: 24, lineHeight: 27 }}>
          {name}
        </Text>
        <Text variant="caption" numberOfLines={1} className="mt-0.5">
          {meta}
        </Text>
      </View>
      <View className="flex-row gap-2 px-0.5 pt-2.5">
        {worn ? (
          <Button
            label="Logged"
            icon={Check}
            variant="secondary"
            className="flex-1"
            accessibilityHint="Takes it off today’s log"
            onPress={onUnwear}
          />
        ) : (
          <Button
            label="Wear this"
            className="flex-1"
            accessibilityHint="Logs these pieces as worn today"
            onPress={onWear}
          />
        )}
        <IconButton
          icon={Shuffle}
          size={52}
          accessibilityLabel="Shuffle outfit"
          haptic="none"
          disabled={worn}
          style={{ opacity: worn ? 0.4 : 1 }}
          onPress={onShuffle}
        />
        <IconButton icon={Pencil} size={52} accessibilityLabel="Edit outfit" onPress={onEdit} />
      </View>
    </View>
  );
}

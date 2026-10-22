import { router } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { RefObject } from 'react';
import { View } from 'react-native';

import { AnimatedPressable, EmptyState, Sheet, Text, type SheetRef } from '@/components/ui';
import { outfitMeta } from '@/features/outfits/list';
import { OutfitThumb } from '@/features/outfits/OutfitThumb';
import type { OutfitSummary } from '@/features/outfits/useOutfits';
import { useTheme } from '@/theme/ThemeProvider';

/** Pick an outfit (Planner.dc.html): to plan on a day, or to log one that was worn. */
export function PickOutfitSheet({
  ref,
  eyebrow,
  title,
  outfits,
  lead,
  onPick,
}: {
  ref: RefObject<SheetRef | null>;
  eyebrow: string;
  title: string;
  outfits: readonly OutfitSummary[];
  /** A first row that isn't an outfit: "Suggest one for the weather", "Pick pieces instead". */
  lead?: { label: string; hint: string; icon: LucideIcon; onPress: () => void };
  onPick: (outfit: OutfitSummary) => void;
}) {
  const { colors } = useTheme();
  return (
    <Sheet ref={ref} eyebrow={eyebrow} title={title} snapPoints={['72%']} scrollable>
      {lead ? (
        <AnimatedPressable
          accessibilityLabel={`${lead.label}. ${lead.hint}`}
          onPress={lead.onPress}
          scaleTo={0.98}
          className="min-h-[60px] flex-row items-center gap-3 border-b border-line py-2"
        >
          <View className="h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent-soft">
            <lead.icon size={21} color={colors.accentText} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text variant="body" weight="medium">
              {lead.label}
            </Text>
            <Text variant="caption">{lead.hint}</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </AnimatedPressable>
      ) : null}
      {outfits.length === 0 ? (
        <View className="mt-4">
          <EmptyState
            illustration="shelf"
            title="No saved outfits yet"
            body="Build one on the board, then plan it here."
            actionLabel="Build an outfit"
            onAction={() => {
              ref.current?.dismiss();
              router.push({ pathname: '/outfit/[id]', params: { id: 'new' } });
            }}
          />
        </View>
      ) : (
        outfits.map((o) => (
          <AnimatedPressable
            key={o.id}
            accessibilityLabel={`${o.name}, ${o.pieces.length} pieces`}
            onPress={() => onPick(o)}
            scaleTo={0.98}
            className="min-h-[60px] flex-row items-center gap-3 border-b border-line py-2"
          >
            <OutfitThumb outfit={o} width={52} height={52} />
            <View className="min-w-0 flex-1">
              <Text variant="body" weight="medium" numberOfLines={1}>
                {o.name}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {outfitMeta({ occasion: o.occasion, seasons: o.seasons, pieceCount: o.pieces.length })}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </AnimatedPressable>
        ))
      )}
    </Sheet>
  );
}

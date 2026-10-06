import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { Plus, Sparkles } from 'lucide-react-native';
import { useState, type ReactNode, type RefObject } from 'react';
import { View } from 'react-native';

import { AnimatedPressable, Button, CheckBadge, Chip, Sheet, Text, type SheetRef } from '@/components/ui';
import type { Wardrobe } from '@/db/schema';
import { moveToWardrobe } from '@/features/items/actions';
import { ARCHIVE_REASON_LABEL, ARCHIVE_REASONS, type ArchiveReason } from '@/features/items/catalog';
import { isStorageWardrobe } from '@/features/items/placement';
import { toggleItemInOutfit } from '@/features/outfits/mutations';
import { useOutfitPicker } from '@/features/outfits/useOutfits';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

type SheetProps = { ref: RefObject<SheetRef | null> };
type ItemRef = { id: string; name: string; lentTo?: string | null };

function Row({
  title,
  hint,
  last,
  trailing,
  onPress,
  checked,
}: {
  title: string;
  hint: string;
  last: boolean;
  trailing: ReactNode;
  onPress: () => void;
  checked: boolean;
}) {
  return (
    <AnimatedPressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${title}, ${hint}`}
      onPress={onPress}
      scaleTo={0.98}
      className={[
        'min-h-[58px] flex-row items-center justify-between gap-3 py-2',
        last ? '' : 'border-b border-line',
      ].join(' ')}
    >
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="medium">
          {title}
        </Text>
        <Text variant="caption">{hint}</Text>
      </View>
      {trailing}
    </AnimatedPressable>
  );
}

/** Add this piece to (or take it out of) saved outfits, or start a new one around it. */
export function AddToOutfitSheet({ ref, item }: SheetProps & { item: ItemRef }) {
  const { colors } = useTheme();
  const { data: outfits } = useOutfitPicker();
  return (
    <Sheet
      ref={ref}
      title="Add to outfit"
      eyebrow={item.name}
      snapPoints={outfits.length > 5 ? ['72%'] : undefined}
      scrollable={outfits.length > 5}
    >
      <AnimatedPressable
        accessibilityLabel={`New outfit with ${item.name}`}
        accessibilityHint="Opens the outfit builder"
        onPress={() => {
          ref.current?.dismiss();
          router.push({ pathname: '/outfit/[id]', params: { id: 'new', item: item.id } });
        }}
        scaleTo={0.98}
        className="mb-1 min-h-[58px] flex-row items-center gap-3 rounded-md bg-accent-soft px-3.5 py-2"
      >
        <View className="h-9 w-9 items-center justify-center rounded-pill bg-accent-strong">
          <Sparkles size={17} color={colors.onAccent} strokeWidth={2} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="semibold">
            New outfit
          </Text>
          <Text variant="caption">Start a board with this piece</Text>
        </View>
      </AnimatedPressable>
      {outfits.length === 0 ? (
        <Text variant="bodySm" tone="muted" className="mt-3">
          No saved outfits yet. Outfits you build will be listed here.
        </Text>
      ) : (
        outfits.map((o, i) => {
          const included = o.itemIds.includes(item.id);
          const n = o.itemIds.length;
          return (
            <Row
              key={o.id}
              title={o.name}
              hint={`${n} ${n === 1 ? 'piece' : 'pieces'}${included ? ' · includes this' : ''}`}
              last={i === outfits.length - 1}
              checked={included}
              onPress={() => {
                const added = toggleItemInOutfit(o.id, item.id);
                haptics.outfitSaved();
                toast(added ? `Added to ${o.name}` : `Taken out of ${o.name}`);
              }}
              trailing={
                included ? (
                  <CheckBadge />
                ) : (
                  <View className="h-7 w-7 items-center justify-center rounded-pill border-[1.5px] border-line-strong">
                    <Plus size={15} color={colors.ink} strokeWidth={2.2} />
                  </View>
                )
              }
            />
          );
        })
      )}
    </Sheet>
  );
}

/**
 * "Move to…" another wardrobe, for one piece (detail) or a selection (grid).
 * Storage marks pieces as stored; leaving it puts them back in use.
 */
export function MoveSheet({
  ref,
  items,
  wardrobeId,
  wardrobes,
  counts,
  onMoved,
}: SheetProps & {
  items: readonly ItemRef[];
  /** The wardrobe the pieces are in now (ticked), if they share one. */
  wardrobeId: string | null;
  wardrobes: Wardrobe[];
  counts: Record<string, number>;
  onMoved?: () => void;
}) {
  const title = items.length === 1 ? 'Move to…' : `Move ${items.length} pieces to…`;
  return (
    <Sheet ref={ref} title={title}>
      {wardrobes.map((w, i) => {
        const on = w.id === wardrobeId;
        const n = counts[w.id] ?? 0;
        const hint = `${isStorageWardrobe(w) ? 'Storage · counts as stored' : 'Wardrobe'} · ${n} ${n === 1 ? 'piece' : 'pieces'}`;
        return (
          <Row
            key={w.id}
            title={w.name}
            hint={hint}
            last={i === wardrobes.length - 1}
            checked={on}
            onPress={() => {
              if (!on) {
                moveToWardrobe(items, w);
                onMoved?.();
              }
              ref.current?.dismiss();
            }}
            trailing={on ? <CheckBadge /> : null}
          />
        );
      })}
    </Sheet>
  );
}

/** Archive as donated, sold or discarded, with an optional reason. */
export function ArchiveSheet({
  ref,
  onArchive,
}: SheetProps & { onArchive: (reason: ArchiveReason, note: string) => void }) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<ArchiveReason>('donated');
  const [note, setNote] = useState('');
  return (
    <Sheet ref={ref} title="Archive this piece">
      <Text variant="bodySm" tone="muted">
        It leaves your wardrobe, but its wear history stays in Insights.
      </Text>
      <View className="mt-4 flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel="Reason">
        {ARCHIVE_REASONS.map((r) => (
          <Chip
            key={r}
            label={ARCHIVE_REASON_LABEL[r]}
            selected={reason === r}
            accessibilityRole="radio"
            onPress={() => setReason(r)}
          />
        ))}
      </View>
      <Text variant="eyebrow" className="mb-2 mt-4">
        Reason · optional
      </Text>
      <BottomSheetTextInput
        value={note}
        onChangeText={setNote}
        placeholder="Doesn’t fit anymore"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        accessibilityLabel="Reason"
        maxFontSizeMultiplier={1.5}
        style={{
          height: 48,
          borderRadius: 14,
          paddingHorizontal: 14,
          backgroundColor: colors.surfaceTinted,
          fontFamily: fontFamily.sans,
          fontSize: 15,
          color: colors.ink,
        }}
      />
      <Button
        label={`Archive as ${ARCHIVE_REASON_LABEL[reason].toLowerCase()}`}
        variant="danger"
        fullWidth
        className="mt-5"
        onPress={() => onArchive(reason, note)}
      />
    </Sheet>
  );
}

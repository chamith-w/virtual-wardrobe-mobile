import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { CalendarPlus, Check } from 'lucide-react-native';
import { useEffect, type RefObject } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Button, Chip, Sheet, Text, type SheetRef } from '@/components/ui';
import { OCCASION_LABEL, OCCASIONS, SEASON_LABEL, SEASONS, type Occasion, type Season } from '@/features/items/catalog';
import { toggleIn } from '@/features/wardrobe/filters';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, fontFamily, springs } from '@/theme/tokens';

import { OUTFIT_NAME_MAX } from '../defaults';
import { outfitMeta } from '../list';
import { OutfitThumb } from '../OutfitThumb';
import type { OutfitPiece } from '../useOutfits';

export type SaveForm = { name: string; occasion: Occasion | null; seasons: Season[] };

export type SavedOutfitView = {
  id: string;
  name: string;
  snapshotUri: string | null;
  pieces: OutfitPiece[];
  form: SaveForm;
};

function SavedCard({
  saved,
  onPlan,
  onViewOutfits,
}: {
  saved: SavedOutfitView;
  onPlan: () => void;
  onViewOutfits: () => void;
}) {
  const reduced = useMotionReduced();
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.bouncy));
  }, [pop, reduced]);
  const popStyle = useAnimatedStyle(() => {
    const p = pop.get();
    if (reduced) return { opacity: p };
    return { opacity: Math.min(1, p * 1.6), transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  const { colors } = useTheme();

  return (
    <View>
      <View className="flex-row items-center gap-4">
        <Animated.View
          style={[
            {
              borderRadius: 18,
              shadowColor: colors.shadow,
              shadowOpacity: 0.16,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 14 },
              elevation: 6,
            },
            popStyle,
          ]}
        >
          <OutfitThumb outfit={saved} width={146} height={190} />
        </Animated.View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Check size={14} strokeWidth={2.6} color={colors.success} />
            <Text variant="eyebrow" tone="success">
              Saved to outfits
            </Text>
          </View>
          <Text variant="display3" className="mt-1.5" style={{ fontSize: 24, lineHeight: 27 }} numberOfLines={3}>
            {saved.name}
          </Text>
          <Text variant="caption" className="mt-1.5">
            {outfitMeta({ ...saved.form, pieceCount: saved.pieces.length })}
          </Text>
        </View>
      </View>
      <View className="mt-6 flex-row gap-2.5">
        <View className="flex-1">
          <Button label="Plan it" icon={CalendarPlus} variant="secondary" fullWidth onPress={onPlan} />
        </View>
        <View className="flex-1">
          <Button label="View outfits" fullWidth onPress={onViewOutfits} />
        </View>
      </View>
    </View>
  );
}

/**
 * Save outfit (OutfitBuilder.dc.html): a name, an occasion and seasons, then
 * a saved card with its snapshot, Plan it and View outfits.
 */
export function SaveOutfitSheet({
  ref,
  form,
  suggestion,
  onChange,
  saving,
  saved,
  onSave,
  onPlan,
  onViewOutfits,
  onDismiss,
}: {
  ref: RefObject<SheetRef | null>;
  form: SaveForm;
  /** Used when the name is left blank. */
  suggestion: string;
  onChange: (form: SaveForm) => void;
  saving: boolean;
  /** Set once saved: the sheet shows the result instead of the form. */
  saved: SavedOutfitView | null;
  onSave: () => void;
  onPlan: () => void;
  onViewOutfits: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Sheet ref={ref} title={saved ? undefined : 'Save outfit'} onDismiss={onDismiss}>
      {saved ? (
        <SavedCard saved={saved} onPlan={onPlan} onViewOutfits={onViewOutfits} />
      ) : (
        <View>
          <Text variant="eyebrow" className="mb-2">
            Name
          </Text>
          <BottomSheetTextInput
            value={form.name}
            onChangeText={(name) => onChange({ ...form, name })}
            placeholder={suggestion}
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            returnKeyType="done"
            autoCapitalize="sentences"
            maxLength={OUTFIT_NAME_MAX}
            accessibilityLabel="Outfit name"
            accessibilityHint={`Leave blank for “${suggestion}”`}
            maxFontSizeMultiplier={1.5}
            style={{
              height: 50,
              borderRadius: 14,
              paddingHorizontal: 14,
              backgroundColor: colors.surfaceTinted,
              fontFamily: fontFamily.display,
              fontSize: 17,
              color: colors.ink,
            }}
          />

          <Text variant="eyebrow" className="mb-2.5 mt-5">
            Occasion
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <Chip
                key={o}
                label={OCCASION_LABEL[o]}
                selected={form.occasion === o}
                onPress={() => onChange({ ...form, occasion: form.occasion === o ? null : o })}
              />
            ))}
          </View>

          <Text variant="eyebrow" className="mb-2.5 mt-5">
            Seasons
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {SEASONS.map((s) => (
              <Chip
                key={s}
                label={SEASON_LABEL[s]}
                selected={form.seasons.includes(s)}
                onPress={() =>
                  onChange({ ...form, seasons: SEASONS.filter((x) => toggleIn(form.seasons, s).includes(x)) })
                }
              />
            ))}
          </View>
          <Text variant="caption" className="mt-2">
            {form.seasons.length === 0 ? 'No season picked: it’s an all-year outfit.' : ' '}
          </Text>

          <Button
            label={saving ? 'Saving…' : 'Save outfit'}
            disabled={saving}
            fullWidth
            className="mt-4"
            onPress={onSave}
          />
        </View>
      )}
    </Sheet>
  );
}

/** Closing with unsaved changes. */
export function LeaveSheet({
  ref,
  isNew,
  onDiscard,
  onDismiss,
}: {
  ref: RefObject<SheetRef | null>;
  isNew: boolean;
  onDiscard: () => void;
  onDismiss: () => void;
}) {
  return (
    <Sheet ref={ref} title={isNew ? 'Leave this board?' : 'Leave without saving?'} onDismiss={onDismiss}>
      <Text variant="body" tone="muted">
        {isNew ? 'The pieces you’ve arranged won’t be kept.' : 'Your changes to this outfit will be lost.'}
      </Text>
      <Button
        label={isNew ? 'Discard board' : 'Discard changes'}
        variant="danger"
        fullWidth
        className="mt-5"
        onPress={onDiscard}
      />
      <Button label="Keep editing" variant="ghost" fullWidth className="mt-1" onPress={() => ref.current?.dismiss()} />
    </Sheet>
  );
}

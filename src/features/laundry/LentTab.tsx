import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ArrowLeftRight, Plus, Search } from 'lucide-react-native';
import { useRef, useState, type RefObject } from 'react';
import { TextInput, useWindowDimensions, View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, CheckBadge, Cutout, EmptyState, Sheet, Text, type SheetRef } from '@/components/ui';
import { backInWardrobe, changeItemStatus } from '@/features/items/actions';
import type { ZoneType } from '@/features/items/catalog';
import { LendReminderRow } from '@/features/items/components/LendReminder';
import { openItem } from '@/features/items/openItem';
import { LENT_TO_MAX } from '@/features/items/status';
import { renameBorrower } from '@/features/items/statusService';
import { formatShortDay } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

import { lentAge } from './copy';
import { useListMotion } from './listMotion';
import { useLendablePieces, type LendablePiece, type OutPiece } from './useOutPieces';

function Borrower({ item }: { item: OutPiece }) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  if (item.lentTo) {
    return (
      <View className="flex-row items-center gap-2">
        <View className="h-[26px] w-[26px] items-center justify-center rounded-pill bg-inverse">
          <Text variant="display3" tone="onInverse" style={{ fontSize: 13, lineHeight: 16 }}>
            {item.lentTo.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text variant="bodySm" weight="semibold" numberOfLines={1} className="shrink">
          {item.lentTo}
        </Text>
        {item.lentAt ? (
          <Text variant="bodySm" tone="muted">
            · since {formatShortDay(item.lentAt)}
          </Text>
        ) : null}
      </View>
    );
  }
  const save = () => {
    if (name.trim()) renameBorrower(item, name);
  };
  return (
    <TextInput
      value={name}
      onChangeText={setName}
      onBlur={save}
      onSubmitEditing={save}
      placeholder="Who has it?"
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      returnKeyType="done"
      autoCapitalize="words"
      maxLength={LENT_TO_MAX}
      accessibilityLabel={`Who has ${item.name}`}
      maxFontSizeMultiplier={1.5}
      style={{
        height: 40,
        borderRadius: 12,
        paddingHorizontal: 12,
        backgroundColor: colors.surfaceTinted,
        fontFamily: fontFamily.sansMedium,
        fontSize: 15,
        color: colors.ink,
      }}
    />
  );
}

function LentCard({
  item,
  index,
  browseIds,
  zoneType,
}: {
  item: OutPiece;
  index: number;
  browseIds: string[];
  zoneType: ZoneType | undefined;
}) {
  const motion = useListMotion();
  const tile = useRef<View>(null);
  const age = lentAge(item.lentAt, item.remindAt, new Date());

  return (
    <Animated.View
      entering={motion.entering(index)}
      exiting={motion.exiting}
      layout={motion.layout}
      className={[
        'gap-3 rounded-[24px] bg-surface p-3',
        age.overdue ? 'border-[1.5px] border-accent' : 'border border-line',
      ].join(' ')}
    >
      <View className="flex-row items-center gap-3.5">
        <AnimatedPressable
          accessibilityLabel={`Open ${item.name}`}
          onPress={() => openItem(item, { from: tile.current, browseIds })}
          scaleTo={0.95}
          className="h-24 w-[84px] items-center justify-center rounded-[18px] bg-accent-soft"
        >
          <View ref={tile} collapsable={false}>
            <Cutout uri={item.thumbUri} width={64} height={76} />
          </View>
        </AnimatedPressable>
        <View className="flex-1 gap-1.5">
          <Text variant="display3" style={{ fontSize: 21, lineHeight: 24 }} numberOfLines={2}>
            {item.name}
          </Text>
          <Borrower item={item} />
          <Text variant="caption" weight="semibold" tone={age.overdue ? 'accent' : 'muted'}>
            {age.line}
          </Text>
        </View>
      </View>
      <LendReminderRow item={item} />
      <Button
        label="Mark as returned"
        variant="secondary"
        size="sm"
        fullWidth
        accessibilityHint="Puts it back in your wardrobe and cancels the reminder"
        onPress={() => backInWardrobe(item, zoneType)}
      />
    </Animated.View>
  );
}

// ------------------------------------------------------------- lend sheet --

/** Enough to find anything by name; the search narrows the rest. */
const LEND_GRID_MAX = 48;

function LendBody({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data: pieces } = useLendablePieces();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LendablePiece | null>(null);
  const [who, setWho] = useState('');
  const words = query.trim().toLowerCase();
  const matches = (words ? pieces.filter((p) => p.name.toLowerCase().includes(words)) : pieces).slice(0, LEND_GRID_MAX);
  const tile = (width - 40 - 3 * 8) / 4;
  const name = who.trim();

  const lend = () => {
    if (!selected) return;
    if (changeItemStatus(selected, 'lent', { lentTo: name || null })) onDone();
  };

  const field = {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceTinted,
    fontFamily: fontFamily.sansMedium,
    fontSize: 15,
    color: colors.ink,
  };

  return (
    <View>
      <View className="flex-row items-center">
        <BottomSheetTextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${pieces.length} pieces`}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          accessibilityLabel="Search pieces to lend"
          maxFontSizeMultiplier={1.5}
          style={[field, { flex: 1, paddingLeft: 40 }]}
        />
        <View pointerEvents="none" style={{ position: 'absolute', left: 14 }}>
          <Search size={17} color={colors.muted} strokeWidth={2} />
        </View>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {matches.map((p) => {
          const on = selected?.id === p.id;
          return (
            <AnimatedPressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.name}
              onPress={() => setSelected(on ? null : p)}
              scaleTo={0.94}
              className={[
                'items-center justify-center rounded-[16px] bg-surface-tinted',
                on ? 'border-2 border-ink' : '',
              ].join(' ')}
              style={{ width: tile, height: tile * 1.15 }}
            >
              <Cutout uri={p.thumbUri} width={tile * 0.72} height={tile * 0.86} />
              {on ? (
                <View className="absolute right-1 top-1">
                  <CheckBadge />
                </View>
              ) : null}
            </AnimatedPressable>
          );
        })}
      </View>
      {matches.length === 0 ? (
        <Text variant="bodySm" tone="muted" className="mt-2">
          Nothing at hand matches “{query.trim()}”.
        </Text>
      ) : null}
      <Text variant="eyebrow" className="mb-2 mt-5">
        Who’s borrowing it?
      </Text>
      <BottomSheetTextInput
        value={who}
        onChangeText={setWho}
        onSubmitEditing={lend}
        placeholder="Nadia"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        returnKeyType="done"
        autoCapitalize="words"
        maxLength={LENT_TO_MAX}
        accessibilityLabel="Who’s borrowing it"
        maxFontSizeMultiplier={1.5}
        style={field}
      />
      <Button
        label={selected ? `Lend ${selected.name.toLowerCase()}${name ? ` to ${name}` : ''}` : 'Pick a piece to lend'}
        fullWidth
        disabled={!selected}
        className="mt-5"
        onPress={lend}
      />
    </View>
  );
}

function LendSheet({ ref }: { ref: RefObject<SheetRef | null> }) {
  return (
    <Sheet ref={ref} title="Lend something" snapPoints={['88%']} scrollable>
      <LendBody onDone={() => ref.current?.dismiss()} />
    </Sheet>
  );
}

// -------------------------------------------------------------------- tab --

/** Lent pieces, longest away first, with who, since when and the ask-back reminder. */
export function LentTab({
  lent,
  zoneTypeOf,
}: {
  lent: OutPiece[];
  zoneTypeOf: (zoneId: string | null) => ZoneType | undefined;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lendSheet = useRef<SheetRef>(null);
  const browseIds = lent.map((p) => p.id);

  return (
    <>
      <GHScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 40, gap: 12 }}
      >
        {lent.length === 0 ? (
          <EmptyState
            title="Everything’s home"
            body="Nothing is lent out right now."
            illustration={<ArrowLeftRight size={44} color={colors.faint} strokeWidth={1.3} />}
          />
        ) : (
          lent.map((p, i) => (
            <LentCard key={p.id} item={p} index={i} browseIds={browseIds} zoneType={zoneTypeOf(p.zoneId)} />
          ))
        )}
        <AnimatedPressable
          accessibilityLabel="Lend something"
          accessibilityHint="Pick a piece and who’s borrowing it"
          onPress={() => lendSheet.current?.present()}
          scaleTo={0.97}
          className="h-14 flex-row items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-line-strong"
        >
          <Plus size={18} color={colors.accentText} strokeWidth={2} />
          <Text variant="body" weight="semibold" tone="accent">
            Lend something
          </Text>
        </AnimatedPressable>
      </GHScrollView>
      <LendSheet ref={lendSheet} />
    </>
  );
}

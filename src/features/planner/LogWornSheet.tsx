import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { Camera, Check, CloudSun, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Linking, View } from 'react-native';

import { AnimatedPressable, Button, Cutout, Sheet, Text, type SheetRef } from '@/components/ui';
import type { Category } from '@/features/items/catalog';
import type { LookItem } from '@/features/suggestions/useLookItems';
import type { DayKey } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { deleteImage } from '@/lib/images';
import { toast } from '@/store/toast';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

import { logCaption } from './logEffects';
import { PiecePickerSheet } from './PiecePickerSheet';
import { takeSelfie } from './selfie';
import { useLaundryPreview } from './useLaundryPreview';

export type LogPieceView = { id: string; name: string; category: Category; thumbUri: string | null };

/** What the sheet opens with: an outfit to confirm, or a day's log to edit. */
export type LogDraftView = {
  mode: 'log' | 'edit';
  day: DayKey;
  outfitId: string | null;
  pieces: LogPieceView[];
  ticked: string[];
  photoUri: string | null;
  notes: string | null;
};

export type LogSave = { itemIds: string[]; photoUri: string | null; notes: string | null };

const NOTE_MAX = 140;

function Tick({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      className={[
        'h-[26px] w-[26px] items-center justify-center rounded-pill',
        on ? 'bg-accent-secondary' : 'border-[1.5px] border-line-strong',
      ].join(' ')}
    >
      {on ? <Check size={14} strokeWidth={3} color={colors.onAccentSecondary} /> : null}
    </View>
  );
}

function LogBody({
  draft,
  today,
  weatherLine,
  onAddPieces,
  added,
  onSave,
  onDelete,
}: {
  draft: LogDraftView;
  today: DayKey;
  weatherLine: string | null;
  onAddPieces: () => void;
  /** Pieces picked in the picker sheet, appended (ticked) as they arrive. */
  added: readonly LogPieceView[];
  onSave: (save: LogSave) => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(draft.ticked));
  const [photo, setPhoto] = useState(draft.photoUri);
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [seenAdded, setSeenAdded] = useState(0);
  const taken = useRef<string[]>([]);
  const saved = useRef(false);

  // Pieces arriving from the picker come in ticked.
  const pieces = [...draft.pieces, ...added.filter((a) => !draft.pieces.some((p) => p.id === a.id))];
  if (added.length !== seenAdded) {
    setSeenAdded(added.length);
    setTicked((prev) => new Set([...prev, ...added.map((a) => a.id)]));
  }

  // Selfies taken but not kept are deleted when the sheet closes.
  const kept = useRef<string | null>(null);
  useEffect(() => {
    kept.current = photo;
  });
  useEffect(
    () => () => {
      const keep = saved.current ? kept.current : null;
      for (const uri of taken.current) if (uri !== keep) deleteImage(uri);
    },
    [],
  );

  const isToday = draft.day === today;
  const ids = pieces.filter((p) => ticked.has(p.id)).map((p) => p.id);
  const due = useLaundryPreview(ids, draft.day, today);
  const dueNames = pieces.filter((p) => due.has(p.id)).map((p) => p.name);
  const n = ids.length;

  const toggle = (id: string) => {
    haptics.tap();
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelfie = async () => {
    const result = await takeSelfie();
    if ('uri' in result) {
      taken.current.push(result.uri);
      setPhoto(result.uri);
      haptics.tap();
      return;
    }
    if (result.error === 'cancelled') return;
    haptics.warning();
    if (result.error === 'blocked') {
      toast('Camera is off for My Closet in Settings', 'info');
      void Linking.openSettings();
    } else toast(result.error === 'denied' ? 'Camera wasn’t allowed' : 'Couldn’t save the selfie', 'info');
  };

  const save = () => {
    saved.current = true;
    onSave({ itemIds: ids, photoUri: photo, notes: notes.trim() || null });
  };

  return (
    <View>
      <Text variant="bodySm" tone="muted">
        {draft.mode === 'edit'
          ? 'Tick what you wore. Untick anything that wasn’t.'
          : 'Untick anything you swapped out.'}
      </Text>
      <View className="mt-2">
        {pieces.map((p) => {
          const on = ticked.has(p.id);
          return (
            <AnimatedPressable
              key={p.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.name}
              haptic="none"
              onPress={() => toggle(p.id)}
              scaleTo={0.98}
              className="min-h-[56px] flex-row items-center justify-between gap-3 border-b border-line py-1.5"
            >
              <View className="min-w-0 flex-1 flex-row items-center gap-3">
                <View className="h-[42px] w-10 items-center justify-center rounded-sm bg-surface-tinted">
                  <Cutout uri={p.thumbUri} width={30} height={32} shadow="none" />
                </View>
                <Text variant="body" weight="medium" numberOfLines={1} className="flex-1">
                  {p.name}
                </Text>
              </View>
              <Tick on={on} />
            </AnimatedPressable>
          );
        })}
        <AnimatedPressable
          accessibilityLabel="Add a piece you wore"
          onPress={onAddPieces}
          scaleTo={0.98}
          className="min-h-[56px] flex-row items-center gap-3 border-b border-line py-1.5"
        >
          <View className="h-[42px] w-10 items-center justify-center rounded-sm border-[1.5px] border-dashed border-line-strong">
            <Plus size={18} color={colors.muted} strokeWidth={2} />
          </View>
          <Text variant="body" weight="medium" tone="muted">
            Add a piece
          </Text>
        </AnimatedPressable>
      </View>

      <View className="mt-3.5 flex-row gap-2.5">
        {photo ? (
          <View className="h-16 flex-1 flex-row items-center gap-2.5 overflow-hidden rounded-[18px] bg-inverse pl-1.5 pr-1">
            <Image source={{ uri: photo }} style={{ width: 52, height: 52, borderRadius: 14 }} contentFit="cover" />
            <Text variant="bodySm" weight="semibold" tone="onInverse" className="flex-1" numberOfLines={1}>
              Selfie added
            </Text>
            <AnimatedPressable
              accessibilityLabel="Remove the selfie"
              onPress={() => setPhoto(null)}
              className="h-11 w-11 items-center justify-center"
            >
              <X size={18} color={colors.onInverse} strokeWidth={2} />
            </AnimatedPressable>
          </View>
        ) : (
          <AnimatedPressable
            accessibilityLabel="Add a mirror selfie"
            onPress={() => void addSelfie()}
            scaleTo={0.97}
            className="h-16 flex-1 flex-row items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong"
          >
            <Camera size={19} color={colors.ink} strokeWidth={1.8} />
            <Text variant="bodySm" weight="semibold">
              Add mirror selfie
            </Text>
          </AnimatedPressable>
        )}
        <View className="h-16 flex-1 items-center justify-center rounded-[18px] bg-accent-secondary-soft px-2">
          {weatherLine ? (
            <>
              <Text
                variant="bodySm"
                weight="semibold"
                tone="accentSecondary"
                numberOfLines={1}
                style={{ fontSize: 13 }}
              >
                {weatherLine}
              </Text>
              <Text variant="caption" tone="accentSecondary" style={{ fontSize: 11 }}>
                weather attached
              </Text>
            </>
          ) : (
            <>
              <CloudSun size={18} color={colors.accentSecondary} strokeWidth={1.8} />
              <Text variant="caption" tone="accentSecondary" style={{ fontSize: 11 }}>
                No forecast for this day
              </Text>
            </>
          )}
        </View>
      </View>

      <BottomSheetTextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Add a note: where you went, how it felt…"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        maxLength={NOTE_MAX}
        returnKeyType="done"
        accessibilityLabel="Note"
        maxFontSizeMultiplier={1.5}
        style={{
          marginTop: 12,
          minHeight: 44,
          borderRadius: 14,
          paddingHorizontal: 14,
          backgroundColor: colors.surfaceTinted,
          fontFamily: fontFamily.sansMedium,
          fontSize: 15,
          color: colors.ink,
        }}
      />

      <Text variant="caption" className="mt-3">
        {logCaption({ due: dueNames, isToday })}
      </Text>
      {draft.mode === 'edit' && n === 0 ? (
        <Button
          label="Delete this log"
          variant="danger"
          icon={Trash2}
          fullWidth
          className="mt-3.5"
          onPress={onDelete}
        />
      ) : (
        <Button
          label={draft.mode === 'edit' ? 'Save log' : `Log ${n} ${n === 1 ? 'piece' : 'pieces'}`}
          fullWidth
          disabled={n === 0}
          className="mt-3.5"
          onPress={save}
        />
      )}
      {draft.mode === 'edit' && n > 0 && onDelete ? (
        <Button label="Delete this log" variant="ghost" fullWidth className="mt-1" onPress={onDelete} />
      ) : null}
    </View>
  );
}

/**
 * "Log what you wore" (Planner.dc.html): confirm the outfit or tick pieces,
 * add a mirror selfie and a note; the day's weather comes along on its own.
 * Also edits a day's log from the journal.
 */
export function LogWornSheet({
  ref,
  draft,
  today,
  weatherLine,
  candidates,
  onSave,
  onDelete,
}: {
  ref: RefObject<SheetRef | null>;
  draft: LogDraftView | null;
  today: DayKey;
  weatherLine: string | null;
  candidates: readonly LookItem[];
  onSave: (save: LogSave) => void;
  onDelete?: () => void;
}) {
  const picker = useRef<SheetRef>(null);
  const [added, setAdded] = useState<LogPieceView[]>([]);
  return (
    <>
      <Sheet
        ref={ref}
        eyebrow={draft?.mode === 'edit' ? 'Outfit journal' : 'Log worn'}
        title={draft?.mode === 'edit' ? 'Edit what you wore' : 'Log what you wore'}
        scrollable
        onDismiss={() => setAdded([])}
      >
        {draft ? (
          <LogBody
            draft={draft}
            today={today}
            weatherLine={weatherLine}
            added={added}
            onAddPieces={() => picker.current?.present()}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : null}
      </Sheet>
      <PiecePickerSheet
        ref={picker}
        candidates={candidates.filter(
          (c) => !draft?.pieces.some((p) => p.id === c.id) && !added.some((a) => a.id === c.id),
        )}
        onAdd={(ids) => {
          const more = ids.flatMap((id) => candidates.find((c) => c.id === id) ?? []);
          setAdded((prev) => [...prev, ...more]);
          picker.current?.dismiss();
        }}
      />
    </>
  );
}

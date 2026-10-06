import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { GripVertical, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedPressable, Button, Chip, IconButton, Sheet, Text, type SheetRef } from '@/components/ui';
import type { Wardrobe } from '@/db/schema';
import { homeWardrobe, isStorageWardrobe } from '@/features/items/placement';
import { KindPicker, NewWardrobeSheet } from '@/features/wardrobe/components/WardrobeSheets';
import { WardrobeIcon } from '@/features/wardrobe/components/WardrobeHeader';
import { changeWardrobeKind, deleteWardrobe, renameWardrobe, reorderWardrobes } from '@/features/wardrobe/mutations';
import { useActiveWardrobe, useWardrobeCounts } from '@/features/wardrobe/useWardrobeData';
import {
  deletionPlan,
  kindChangeProblem,
  moveInList,
  renameProblem,
  WARDROBE_NAME_MAX,
  WARDROBE_PROBLEM_COPY,
  type WardrobeKind,
} from '@/features/wardrobe/wardrobes';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, fontFamily, springs } from '@/theme/tokens';

const ROW_H = 76;

const kindOf = (w: Pick<Wardrobe, 'icon'>): WardrobeKind => (isStorageWardrobe(w) ? 'storage' : 'wardrobe');
const pieces = (n: number) => `${n} ${n === 1 ? 'piece' : 'pieces'}`;

// ---------------------------------------------------------------- reorder --

function ReorderRow({
  wardrobe,
  index,
  count,
  isHome,
  total,
  order,
  activeId,
  onCommit,
  onMove,
  onPress,
}: {
  wardrobe: Wardrobe;
  /** Position when first shown; afterwards `order` drives it. */
  index: number;
  count: number;
  isHome: boolean;
  total: number;
  order: SharedValue<string[]>;
  activeId: SharedValue<string>;
  onCommit: (ids: string[]) => void;
  onMove: (id: string, by: number) => void;
  onPress: (wardrobe: Wardrobe) => void;
}) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const id = wardrobe.id;
  const top = useSharedValue(index * ROW_H);
  const startTop = useSharedValue(0);

  // Another row moved past this one: glide to the new slot.
  useAnimatedReaction(
    () => order.get().indexOf(id),
    (index, previous) => {
      if (index === previous || activeId.get() === id || index < 0) return;
      const to = index * ROW_H;
      top.set(reduced ? withTiming(to, { duration: durations.reducedFade }) : withSpring(to, springs.gentle));
    },
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      activeId.set(id);
      startTop.set(top.get());
      scheduleOnRN(haptics.press);
    })
    .onUpdate((e) => {
      const y = Math.min(Math.max(startTop.get() + e.translationY, 0), (total - 1) * ROW_H);
      top.set(y);
      const list = order.get();
      const from = list.indexOf(id);
      const to = Math.round(y / ROW_H);
      if (to !== from && from >= 0) {
        const next = list.slice();
        next.splice(from, 1);
        next.splice(to, 0, id);
        order.set(next);
        scheduleOnRN(haptics.tap);
      }
    })
    .onFinalize(() => {
      if (activeId.get() !== id) return;
      activeId.set('');
      const to = order.get().indexOf(id) * ROW_H;
      top.set(reduced ? withTiming(to, { duration: durations.reducedFade }) : withSpring(to, springs.bouncy));
      scheduleOnRN(onCommit, order.get());
    });

  const style = useAnimatedStyle(() => {
    const lifted = activeId.get() === id;
    return {
      zIndex: lifted ? 10 : 0,
      shadowOpacity: withTiming(lifted ? (isDark ? 0.5 : 0.18) : 0, { duration: 160 }),
      transform: [{ translateY: top.get() }, { scale: withSpring(lifted && !reduced ? 1.03 : 1, springs.snappy) }],
    };
  });

  const kind = kindOf(wardrobe);
  let role = 'Wardrobe';
  if (kind === 'storage') role = 'Storage';
  else if (isHome) role = 'Stored pieces come back here';
  const caption = `${pieces(count)} · ${role}`;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          height: ROW_H,
          shadowColor: colors.shadow,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        },
        style,
      ]}
    >
      <View className="mb-2 flex-1 flex-row items-center rounded-md border border-line bg-surface pl-3">
        <AnimatedPressable
          accessibilityLabel={`${wardrobe.name}, ${caption}`}
          accessibilityHint="Rename it, change its kind or delete it"
          accessibilityActions={[
            { name: 'moveUp', label: 'Move up' },
            { name: 'moveDown', label: 'Move down' },
          ]}
          onAccessibilityAction={(e) => onMove(id, e.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
          onPress={() => onPress(wardrobe)}
          scaleTo={0.98}
          className="h-full flex-1 flex-row items-center gap-3.5"
        >
          <View className="h-[46px] w-[46px] items-center justify-center rounded-[16px] bg-surface-tinted">
            <WardrobeIcon icon={wardrobe.icon} size={22} color={colors.ink} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="body" weight="semibold" numberOfLines={1}>
              {wardrobe.name}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {caption}
            </Text>
          </View>
        </AnimatedPressable>
        <GestureDetector gesture={pan}>
          <View
            className="h-full w-12 items-center justify-center"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <GripVertical size={20} color={colors.faint} strokeWidth={1.9} />
          </View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

// ------------------------------------------------------------------- edit --

function EditBody({
  wardrobe,
  all,
  counts,
  onDone,
}: {
  wardrobe: Wardrobe;
  all: Wardrobe[];
  counts: Record<string, number>;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const current = kindOf(wardrobe);
  const [name, setName] = useState(wardrobe.name);
  const [kind, setKind] = useState<WardrobeKind>(current);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const removal = deletionPlan(wardrobe, all);
  const [targetId, setTargetId] = useState(removal.ok ? removal.suggested.id : null);

  const problem = renameProblem(name, wardrobe, all);
  const storageProblem = kindChangeProblem(wardrobe, 'storage', all);
  const n = counts[wardrobe.id] ?? 0;
  const home = homeWardrobe(all.filter((w) => w.id !== wardrobe.id));
  let kindNote: string | null = null;
  if (kind !== current) {
    kindNote =
      kind === 'storage'
        ? `Its ${pieces(n)} will count as stored. Anything that’s out goes to ${home?.name ?? 'home'}.`
        : 'Its stored pieces go back in use.';
  }

  const save = () => {
    setTouched(true);
    if (problem) {
      haptics.warning();
      return;
    }
    if (name.trim() !== wardrobe.name) renameWardrobe(wardrobe.id, name);
    if (kind !== current) changeWardrobeKind(wardrobe.id, kind);
    haptics.statusChanged();
    toast(`${name.trim()} saved`);
    onDone();
  };

  const remove = () => {
    if (!removal.ok || !targetId) return;
    const target = all.find((w) => w.id === targetId);
    const plan = deleteWardrobe(wardrobe.id, targetId);
    const moved = plan.updates.reduce((sum, u) => sum + u.ids.length, 0);
    haptics.statusChanged();
    toast(
      moved > 0 ? `${wardrobe.name} deleted · ${pieces(moved)} moved to ${target?.name}` : `${wardrobe.name} deleted`,
    );
    onDone();
  };

  return (
    <View>
      <Text variant="eyebrow" className="mb-2">
        Name
      </Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        onSubmitEditing={save}
        selectionColor={colors.accent}
        returnKeyType="done"
        autoCapitalize="words"
        maxLength={WARDROBE_NAME_MAX}
        accessibilityLabel="Wardrobe name"
        maxFontSizeMultiplier={1.5}
        style={{
          height: 48,
          borderRadius: 14,
          paddingHorizontal: 14,
          backgroundColor: colors.surfaceTinted,
          fontFamily: fontFamily.sansMedium,
          fontSize: 16,
          color: colors.ink,
        }}
      />
      {touched && problem ? (
        <Text variant="caption" tone="danger" className="mt-1.5">
          {problem}
        </Text>
      ) : null}

      <Text variant="eyebrow" className="mb-2.5 mt-5">
        Kind
      </Text>
      <KindPicker
        value={kind}
        onChange={setKind}
        disabledKind={current === 'wardrobe' && storageProblem ? 'storage' : null}
      />
      {current === 'wardrobe' && storageProblem ? (
        <Text variant="caption" tone="muted" className="mt-2">
          {WARDROBE_PROBLEM_COPY[storageProblem]}
        </Text>
      ) : null}
      {kindNote ? (
        <Text variant="caption" weight="semibold" className="mt-2">
          {kindNote}
        </Text>
      ) : null}

      <Button label="Save" fullWidth className="mt-6" onPress={save} />

      <View className="mt-5 border-t border-line pt-4">
        {!removal.ok ? (
          <Text variant="caption" tone="muted" className="text-center">
            {WARDROBE_PROBLEM_COPY[removal.problem]}
          </Text>
        ) : !confirming ? (
          <Button
            label="Delete wardrobe"
            variant="ghost"
            icon={Trash2}
            className="self-center"
            onPress={() => setConfirming(true)}
          />
        ) : (
          <View className="gap-3 rounded-md bg-danger-soft p-3.5">
            <Text variant="bodySm" weight="semibold">
              {n > 0 ? `Its ${pieces(n)} move to:` : 'It’s empty, so nothing needs moving.'}
            </Text>
            {n > 0 ? (
              <View
                className="flex-row flex-wrap gap-2"
                accessibilityRole="radiogroup"
                accessibilityLabel="Move them to"
              >
                {removal.targets.map((w) => (
                  <Chip
                    key={w.id}
                    label={w.name}
                    accessibilityRole="radio"
                    selected={w.id === targetId}
                    onPress={() => setTargetId(w.id)}
                  />
                ))}
              </View>
            ) : null}
            <View className="flex-row gap-2.5">
              <Button label="Keep it" variant="secondary" size="sm" onPress={() => setConfirming(false)} />
              <Button
                label={`Delete ${wardrobe.name}`}
                variant="danger"
                size="sm"
                className="flex-1"
                onPress={remove}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function EditWardrobeSheet({
  ref,
  wardrobe,
  all,
  counts,
}: {
  ref: RefObject<SheetRef | null>;
  wardrobe: Wardrobe | undefined;
  all: Wardrobe[];
  counts: Record<string, number>;
}) {
  return (
    <Sheet ref={ref} title={wardrobe?.name ?? 'Wardrobe'} eyebrow="Edit wardrobe">
      {wardrobe ? (
        <EditBody wardrobe={wardrobe} all={all} counts={counts} onDone={() => ref.current?.dismiss()} />
      ) : (
        <View className="h-24" />
      )}
    </Sheet>
  );
}

// ----------------------------------------------------------------- screen --

/** Rename, reorder, re-kind and delete wardrobes (Me and the wardrobe switcher). */
export function ManageWardrobesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { wardrobes, setActive } = useActiveWardrobe();
  const counts = useWardrobeCounts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editSheet = useRef<SheetRef>(null);
  const newSheet = useRef<SheetRef>(null);
  const [dragging, setDragging] = useState(false);

  const ids = wardrobes.map((w) => w.id);
  const key = ids.join('|');
  const order = useSharedValue<string[]>(ids);
  const activeId = useSharedValue('');
  useEffect(() => {
    order.set(key ? key.split('|') : []);
  }, [key, order]);
  useAnimatedReaction(
    () => activeId.get() !== '',
    (now, before) => {
      if (now !== before) scheduleOnRN(setDragging, now);
    },
  );

  const commit = (next: string[]) => {
    if (next.join('|') === key) return;
    reorderWardrobes(next);
    haptics.dropSuccess();
  };
  const move = (id: string, by: number) => {
    const from = ids.indexOf(id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = moveInList(ids, from, to);
    order.set(next);
    reorderWardrobes(next);
    haptics.tap();
  };

  const home = homeWardrobe(wardrobes);
  const editing = wardrobes.find((w) => w.id === editingId);

  return (
    <View className="flex-1 bg-background">
      <GHScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 32 }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text variant="eyebrow">Settings</Text>
            <Text variant="display2" className="mt-1.5" accessibilityRole="header">
              Wardrobes
            </Text>
          </View>
          <IconButton icon={X} accessibilityLabel="Close" onPress={() => router.back()} />
        </View>
        <Text variant="bodySm" tone="muted" className="mt-2">
          Drag the handle to reorder. Tap a wardrobe to rename it, make it storage, or delete it.
        </Text>

        <View className="mt-5" style={{ height: wardrobes.length * ROW_H }}>
          {wardrobes.map((w, i) => (
            <ReorderRow
              key={w.id}
              wardrobe={w}
              index={i}
              count={counts[w.id] ?? 0}
              isHome={w.id === home?.id}
              total={wardrobes.length}
              order={order}
              activeId={activeId}
              onCommit={commit}
              onMove={move}
              onPress={(picked) => {
                setEditingId(picked.id);
                editSheet.current?.present();
              }}
            />
          ))}
        </View>

        <AnimatedPressable
          accessibilityLabel="New wardrobe"
          onPress={() => newSheet.current?.present()}
          scaleTo={0.98}
          className="h-[68px] flex-row items-center gap-3.5 rounded-md border-[1.5px] border-dashed border-line-strong px-3"
          style={{ backgroundColor: withAlpha(colors.surface, 0.4) }}
        >
          <View className="h-[46px] w-[46px] items-center justify-center rounded-[16px] bg-surface-tinted">
            <Plus size={20} color={colors.ink} strokeWidth={1.9} />
          </View>
          <Text variant="body" weight="semibold">
            New wardrobe
          </Text>
        </AnimatedPressable>
      </GHScrollView>

      <EditWardrobeSheet ref={editSheet} wardrobe={editing} all={wardrobes} counts={counts} />
      <NewWardrobeSheet ref={newSheet} wardrobes={wardrobes} onCreated={(id) => setActive(id)} />
    </View>
  );
}

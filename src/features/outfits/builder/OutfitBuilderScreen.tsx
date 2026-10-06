import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { Shuffle, Undo2, X } from 'lucide-react-native';
import { useEffect, useReducer, useRef, useState } from 'react';
import { BackHandler, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Cutout, EmptyState, IconButton, Screen, Text, type SheetRef } from '@/components/ui';
import { CATEGORY_ROLE } from '@/features/items/catalog';
import { haptics } from '@/lib/haptics';
import { useWardrobeView } from '@/store/wardrobeView';
import { toast } from '@/store/toast';
import { useMotionReduced } from '@/theme/motion';
import { durations, springs } from '@/theme/tokens';

import { boardKey, boardReducer, EMPTY_BOARD, type BoardPiece } from '../board';
import { BOARD_ASPECT, placeNewPiece, ROLE_POSE, type NormalisedPose } from '../canvas';
import { finalName, suggestOccasion, suggestOutfitName, suggestSeasons } from '../defaults';
import { saveOutfit } from '../mutations';
import { PlanOutfitSheet } from '../OutfitSheets';
import { boardUri, thumbUri, usePieceArts, type PieceArt } from '../pieceArt';
import { isAvailable, shuffleBoard, starterOutfit } from '../shuffle';
import { snapshotOutfit } from '../snapshots';
import type { OutfitPiece } from '../useOutfits';
import { Board } from './Board';
import { LeaveSheet, SaveOutfitSheet, type SavedOutfitView, type SaveForm } from './BuilderSheets';
import { TILE, Tray, type TrayDrag } from './Tray';
import { readPreload, useBuilderItems, useSavedOutfit, type BuilderItem, type SavedOutfit } from './useBuilderData';

const HEADER_H = 56;
const CHIPS_H = 52;
type Rect = { x: number; y: number; w: number; h: number };

/** The piece being dragged up from the tray, under the finger. */
function TrayGhost({
  item,
  x,
  y,
  origin,
  lift,
}: {
  item: BuilderItem;
  x: SharedValue<number>;
  y: SharedValue<number>;
  origin: SharedValue<{ x: number; y: number }>;
  lift: SharedValue<number>;
}) {
  const reduced = useMotionReduced();
  const w = TILE.width * 1.25;
  const h = TILE.height * 1.25;
  const style = useAnimatedStyle(() => {
    const l = lift.get();
    const at = [{ translateX: x.get() - origin.get().x - w / 2 }, { translateY: y.get() - origin.get().y - h * 0.55 }];
    if (reduced) return { opacity: l, transform: at };
    return { opacity: Math.min(1, l * 1.4), transform: [...at, { rotate: `${-6 * l}deg` }, { scale: 0.8 + 0.3 * l }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, style]}>
      <Cutout uri={item.thumbUri} width={w} height={h} shadow="lifted" />
    </Animated.View>
  );
}

function toOutfitPieces(pieces: readonly BoardPiece[], items: ReadonlyMap<string, BuilderItem>): OutfitPiece[] {
  return pieces.flatMap((p) => {
    const item = items.get(p.itemId);
    if (!item) return [];
    return [
      {
        itemId: p.itemId,
        name: item.name,
        thumbUri: item.thumbUri,
        cutoutUri: item.cutoutUri,
        x: p.x,
        y: p.y,
        scale: p.scale,
        rotation: p.rotation,
        zIndex: p.z,
      },
    ];
  });
}

function Builder({ saved, preload }: { saved: SavedOutfit | null; preload: string[] }) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduced = useMotionReduced();
  const { items } = useBuilderItems();

  const [initial] = useState(() => saved?.pieces ?? readPreload(preload));
  const [board, dispatch] = useReducer(boardReducer, EMPTY_BOARD, () =>
    boardReducer(EMPTY_BOARD, { type: 'load', pieces: initial }),
  );
  const [savedKey, setSavedKey] = useState(() => boardKey(board.pieces));
  const [outfitId, setOutfitId] = useState(saved?.id ?? null);
  const [title, setTitle] = useState(saved?.name ?? 'New outfit');
  const [form, setForm] = useState<SaveForm>({
    name: saved?.name ?? '',
    occasion: saved?.occasion ?? null,
    seasons: saved?.seasons ?? [],
  });
  const [formSeeded, setFormSeeded] = useState(!!saved);
  const [saving, setSaving] = useState(false);
  const [savedView, setSavedView] = useState<SavedOutfitView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popIds, setPopIds] = useState<ReadonlySet<string>>(() => new Set(saved ? [] : initial.map((p) => p.itemId)));

  const saveRef = useRef<SheetRef>(null);
  const planRef = useRef<SheetRef>(null);
  const leaveRef = useRef<SheetRef>(null);
  /** Whether a sheet is up, so Android's back closes it rather than the builder. */
  const sheetUp = useRef(false);

  const pieces = board.pieces;
  const onBoard = new Set(pieces.map((p) => p.itemId));
  const selected = selectedId && onBoard.has(selectedId) ? selectedId : null;
  const dirty = boardKey(pieces) !== savedKey;
  const boardItems = pieces.flatMap((p) => items.get(p.itemId) ?? []);
  const suggestion = suggestOutfitName(boardItems);
  const available = [...items.values()].filter(isAvailable);

  // Art: the full cutout for crisp scaling, with the thumbnail standing in while it decodes.
  const uris = boardItems.flatMap((i) => [boardUri(i), thumbUri(i)].filter((u): u is string => !!u));
  const loadedArts = usePieceArts(uris);
  const arts = new Map<string, PieceArt>();
  const names = new Map<string, string>();
  for (const item of boardItems) {
    names.set(item.id, item.name);
    const full = boardUri(item);
    const thumb = thumbUri(item);
    const art = (full && loadedArts.get(full)) || (thumb && loadedArts.get(thumb));
    if (art) arts.set(item.id, art);
  }

  // Layout: the board keeps its shape and fits between the header and the tray.
  const trayBottom = Math.max(insets.bottom, 12) + 4;
  const trayH = CHIPS_H + TILE.height + 2 + trayBottom;
  const room = screenH - insets.top - HEADER_H - trayH - 20;
  const boardW = Math.floor(Math.min(screenW - 24, room / BOARD_ASPECT));

  // ------------------------------------------------------------ editing --

  const markPop = (ids: string[]) => setPopIds((prev) => new Set([...prev, ...ids]));

  const addPiece = (id: string, at?: { x: number; y: number }) => {
    const item = items.get(id);
    if (!item) return;
    if (onBoard.has(id)) {
      const current = pieces.find((p) => p.itemId === id)!;
      if (at) dispatch({ type: 'pose', itemId: id, pose: { ...current, ...at } });
      setSelectedId(id);
      haptics.tap();
      return;
    }
    const spot = placeNewPiece(item.category, pieces);
    const role = ROLE_POSE[CATEGORY_ROLE[item.category]];
    const pose: NormalisedPose = at ? { ...at, scale: role.scale, rotation: role.rotation } : spot;
    markPop([id]);
    dispatch({ type: 'add', piece: { itemId: id, ...pose, locked: false } });
    setSelectedId(id);
    haptics.press();
  };

  const removePiece = (id: string, how: 'trash' | 'toolbar') => {
    dispatch({ type: 'remove', itemId: id });
    if (how === 'toolbar') haptics.press();
    toast(`${items.get(id)?.name ?? 'Piece'} taken off the board`, 'info');
  };

  const shuffle = () => {
    if (pieces.length === 0) {
      const ids = starterOutfit(items);
      if (ids.length === 0) {
        haptics.warning();
        toast('Nothing in the wardrobe to style yet', 'info');
        return;
      }
      const placed: BoardPiece[] = [];
      for (const id of ids) {
        placed.push({ itemId: id, ...placeNewPiece(items.get(id)!.category, placed), z: placed.length, locked: false });
      }
      markPop(ids);
      dispatch({ type: 'addMany', pieces: placed });
      haptics.press();
      return;
    }
    const result = shuffleBoard(pieces, items);
    if (result.kind === 'all-locked') {
      haptics.warning();
      toast('Everything’s locked. Unlock a piece to shuffle it', 'info');
      return;
    }
    if (result.kind === 'no-alternatives') {
      haptics.warning();
      toast('Nothing else in the wardrobe to swap in', 'info');
      return;
    }
    markPop(result.swaps.map((s) => s.to));
    if (selected && result.swaps.some((s) => s.from === selected)) {
      setSelectedId(result.swaps.find((s) => s.from === selected)!.to);
    }
    dispatch({ type: 'swap', swaps: result.swaps });
    haptics.press();
  };

  const undo = () => {
    haptics.tap();
    dispatch({ type: 'undo' });
  };

  // --------------------------------------------------------------- save --

  const openSave = () => {
    if (pieces.length === 0) {
      haptics.warning();
      toast('Add a piece before saving', 'info');
      return;
    }
    if (!formSeeded) {
      setForm({ name: '', occasion: suggestOccasion(boardItems), seasons: suggestSeasons(boardItems) });
      setFormSeeded(true);
    }
    setSavedView(null);
    sheetUp.current = true;
    saveRef.current?.present();
  };

  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    const name = finalName(form.name, suggestion);
    const id = saveOutfit({
      id: outfitId,
      name,
      occasion: form.occasion,
      seasons: form.seasons,
      pieces: pieces.map((p) => ({ ...p })),
    });
    haptics.outfitSaved();
    const savedForm = { ...form, name };
    setOutfitId(id);
    setTitle(name);
    setForm(savedForm);
    setSavedKey(boardKey(pieces));
    const view = { id, name, snapshotUri: null, pieces: toOutfitPieces(pieces, items), form: savedForm };
    setSavedView(view);
    const uri = await snapshotOutfit(id, { urgent: true });
    setSavedView((v) => (v && v.id === id ? { ...v, snapshotUri: uri } : v));
    setSaving(false);
  };

  const viewOutfits = () => {
    saveRef.current?.dismiss();
    useWardrobeView.getState().setMode('outfits');
    router.dismissTo('/wardrobe');
  };

  // -------------------------------------------------------------- close --

  const close = () => {
    if (dirty) {
      haptics.warning();
      sheetUp.current = true;
      leaveRef.current?.present();
      return;
    }
    router.back();
  };

  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetUp.current) {
        planRef.current?.dismiss();
        saveRef.current?.dismiss();
        leaveRef.current?.dismiss();
        sheetUp.current = false;
        return true;
      }
      closeRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  // --------------------------------------------------- drag from the tray --

  const rootRef = useRef<View>(null);
  const boardRef = useRef<View>(null);
  const boardRectJs = useRef<Rect | null>(null);
  const draggingRef = useRef<string | null>(null);
  const [ghost, setGhost] = useState<BuilderItem | null>(null);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const origin = useSharedValue({ x: 0, y: 0 });
  const lift = useSharedValue(0);
  const boardRect = useSharedValue<Rect | null>(null);
  const dropHover = useSharedValue(0);
  const draggingId = useSharedValue('');

  const endGhost = (dropped: boolean) => {
    dropHover.set(0);
    lift.set(
      withTiming(0, { duration: dropped || reduced ? 120 : 220 }, (done) => {
        if (done) scheduleOnRN(setGhost, null);
      }),
    );
    draggingRef.current = null;
  };

  const trayDrag: TrayDrag = {
    draggingId,
    onBegin: (id) => {
      const item = items.get(id);
      if (!item) return;
      draggingRef.current = id;
      setGhost(item);
      haptics.press();
      lift.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.snappy));
      rootRef.current?.measureInWindow((x, y) => origin.set({ x, y }));
      boardRef.current?.measureInWindow((x, y, w, h) => {
        boardRectJs.current = { x, y, w, h };
        boardRect.set({ x, y, w, h });
      });
    },
    onMove: (x, y) => {
      'worklet';
      gx.set(x);
      gy.set(y);
      const r = boardRect.get();
      const over = r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h ? 1 : 0;
      if (over !== dropHover.get()) {
        dropHover.set(over);
        if (over) scheduleOnRN(haptics.tap);
      }
    },
    onEnd: (x, y) => {
      const id = draggingRef.current;
      const r = boardRectJs.current;
      const inside = !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (id && r && inside) addPiece(id, { x: (x - r.x) / r.w, y: (y - r.y) / r.h });
      endGhost(inside);
    },
    onCancel: () => endGhost(false),
  };

  // ------------------------------------------------------------- render --

  const lockedCount = pieces.filter((p) => p.locked).length;
  const countLine =
    pieces.length === 0
      ? 'Nothing on the board yet'
      : `${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}${lockedCount ? ` · ${lockedCount} locked` : ''}`;

  return (
    <BottomSheetModalProvider>
      <View ref={rootRef} collapsable={false} className="flex-1 bg-background">
        <View
          className="flex-row items-center gap-2 px-4"
          style={{ paddingTop: insets.top + 6, height: insets.top + HEADER_H }}
        >
          <IconButton icon={X} accessibilityLabel="Close builder" onPress={close} />
          <View className="min-w-0 flex-1 pl-1">
            <Text
              variant="display3"
              numberOfLines={1}
              style={{ fontSize: 22, lineHeight: 26 }}
              accessibilityRole="header"
            >
              {title}
            </Text>
            <Text variant="caption" numberOfLines={1} className="mt-0.5">
              {countLine}
            </Text>
          </View>
          <IconButton
            icon={Undo2}
            accessibilityLabel="Undo"
            accessibilityState={{ disabled: board.past.length === 0 }}
            disabled={board.past.length === 0}
            haptic="none"
            onPress={undo}
            style={{ opacity: board.past.length === 0 ? 0.35 : 1 }}
          />
          <IconButton icon={Shuffle} accessibilityLabel="Shuffle unlocked pieces" haptic="none" onPress={shuffle} />
          <Button label="Save" variant="accent" size="sm" onPress={openSave} />
        </View>

        <View className="flex-1 items-center justify-center">
          <Board
            ref={boardRef}
            width={boardW}
            pieces={pieces}
            arts={arts}
            names={names}
            popIds={popIds}
            selectedId={selected}
            onSelect={setSelectedId}
            onCommitPose={(id, pose) => dispatch({ type: 'pose', itemId: id, pose })}
            onRemove={removePiece}
            onToggleLock={(id) => {
              haptics.tap();
              dispatch({ type: 'toggleLock', itemId: id });
            }}
            onForward={(id) => dispatch({ type: 'forward', itemId: id })}
            onBackward={(id) => dispatch({ type: 'backward', itemId: id })}
            onShuffle={shuffle}
            dropHover={dropHover}
          />
        </View>

        <Tray
          items={available}
          onBoard={onBoard}
          onTap={(id) => addPiece(id)}
          drag={trayDrag}
          bottomInset={trayBottom}
        />

        {ghost ? <TrayGhost item={ghost} x={gx} y={gy} origin={origin} lift={lift} /> : null}
      </View>

      <SaveOutfitSheet
        ref={saveRef}
        form={form}
        suggestion={suggestion}
        onChange={setForm}
        saving={saving}
        saved={savedView}
        onSave={() => void doSave()}
        onPlan={() => planRef.current?.present()}
        onViewOutfits={viewOutfits}
        onDismiss={() => {
          sheetUp.current = false;
          setSavedView(null);
        }}
      />
      <PlanOutfitSheet ref={planRef} outfit={outfitId ? { id: outfitId, name: title } : null} />
      <LeaveSheet
        ref={leaveRef}
        isNew={!outfitId}
        onDismiss={() => {
          sheetUp.current = false;
        }}
        onDiscard={() => {
          leaveRef.current?.dismiss();
          router.back();
        }}
      />
    </BottomSheetModalProvider>
  );
}

/**
 * The outfit builder (OutfitBuilder.dc.html), for a new outfit (`id` null,
 * optionally starting with `preload` pieces) or an existing one.
 */
export function OutfitBuilderScreen({ id, preload }: { id: string | null; preload: string[] }) {
  const saved = useSavedOutfit(id);
  if (saved === null) {
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
  return <Builder saved={saved ?? null} preload={preload} />;
}

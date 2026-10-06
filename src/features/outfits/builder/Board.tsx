import { Layers, Shuffle } from 'lucide-react-native';
import { useEffect, useState, type Ref } from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { Button, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, hairline, shadowOpacity, springs } from '@/theme/tokens';

import { byZ, isBack, isFront, type BoardPiece } from '../board';
import {
  BOARD_ASPECT,
  clampScale,
  clampToBoard,
  handleTransform,
  hitTest,
  isOnHandle,
  normaliseRotation,
  pieceBounds,
  snapPiece,
  snapRotation,
  snapTargets,
  type NormalisedPose,
  type PlacedPiece,
  type SnapTargets,
} from '../canvas';
import type { PieceArt } from '../pieceArt';
import { BoardCanvas, type BoardMotion, type CanvasPieceSpec, type Entrance, type LiveMap } from './BoardCanvas';
import { BoardToolbar, CornerHandle, LockBadge, TRASH_BOTTOM, TRASH_SIZE, TrashZone } from './BoardOverlays';

/** A finger within this many points of the bin's centre drops the piece in. */
const TRASH_CATCH = 48;

export type DragHint = 'idle' | 'drag' | 'hot';

const HINT: Record<DragHint, string> = {
  idle: 'Drag to move · corner handle scales and rotates',
  drag: 'Drop on the bin to remove',
  hot: 'Release to remove',
};

type Placed = PlacedPiece & { id: string; z: number };

function placedPieces(map: LiveMap, width: number, height: number): Placed[] {
  'worklet';
  return Object.keys(map).map((id) => {
    const p = map[id];
    return { id, z: p.z, cx: p.x * width, cy: p.y * height, scale: p.scale, rotation: p.rotation, aspect: p.aspect };
  });
}

/** A stable ±10° for each piece's pop (prototype popA / popB). */
function popTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h & 1 ? 10 : -10;
}

export type BoardProps = {
  ref?: Ref<View>;
  width: number;
  pieces: readonly BoardPiece[];
  /** Art per piece (the full cutout, or its thumbnail while that loads). */
  arts: ReadonlyMap<string, PieceArt>;
  names: ReadonlyMap<string, string>;
  /** Pieces that pop in when they appear (added or shuffled), rather than fade. */
  popIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommitPose: (id: string, pose: NormalisedPose) => void;
  onRemove: (id: string, how: 'trash' | 'toolbar') => void;
  onToggleLock: (id: string) => void;
  onForward: (id: string) => void;
  onBackward: (id: string) => void;
  onShuffle: () => void;
  /** 1 while a piece from the tray is dragged over the board. */
  dropHover: SharedValue<number>;
};

/**
 * The outfit canvas (OutfitBuilder.dc.html): a neutral board with a dot grid.
 * One gesture set on the board drives everything on the UI thread: pan, pinch
 * and rotation run together on the selected piece, the corner handle scales
 * and rotates, and a tap selects. Moves snap to the centre lines and to other
 * pieces; dragging raises a bin to drop pieces in.
 */
export function Board({
  ref,
  width,
  pieces,
  arts,
  names,
  popIds,
  selectedId,
  onSelect,
  onCommitPose,
  onRemove,
  onToggleLock,
  onForward,
  onBackward,
  onShuffle,
  dropHover,
}: BoardProps) {
  const { colors, scheme } = useTheme();
  const reduced = useMotionReduced();
  const height = width * BOARD_ASPECT;
  const trash = { x: width / 2, y: height - TRASH_BOTTOM - TRASH_SIZE / 2 };
  const [hint, setHint] = useState<DragHint>('idle');

  const motion: BoardMotion = {
    live: useSharedValue<LiveMap>({}),
    selected: useSharedValue(''),
    activeId: useSharedValue(''),
    guideX: useSharedValue(-1),
    guideY: useSharedValue(-1),
    dragging: useSharedValue(0),
    hot: useSharedValue(0),
    lift: useSharedValue(0),
    exitId: useSharedValue(''),
    exitT: useSharedValue(0),
  };
  const { live, selected, activeId, guideX, guideY, dragging, hot, lift, exitId, exitT } = motion;

  // Gesture bookkeeping (UI thread only).
  const mode = useSharedValue<'none' | 'move' | 'handle'>('none');
  const panOn = useSharedValue(false);
  const pinchOn = useSharedValue(false);
  const rotateOn = useSharedValue(false);
  const start = useSharedValue({ cx: 0, cy: 0, scale: 1, rotation: 0, angle: 0, distance: 1, fx: 0, fy: 0 });
  const targets = useSharedValue<SnapTargets>({ xs: [], ys: [] });
  const pinchBase = useSharedValue(1);
  const rotateBase = useSharedValue(0);
  const rotationSnapped = useSharedValue(false);

  // Committed state → the UI thread. A piece mid-gesture keeps its live pose.
  const aspectOf = (id: string) => arts.get(id)?.aspect ?? 1;
  const next: LiveMap = {};
  for (const p of pieces) {
    next[p.itemId] = { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation, z: p.z, aspect: aspectOf(p.itemId) };
  }
  const nextKey = JSON.stringify(next);
  useEffect(() => {
    const incoming = JSON.parse(nextKey) as LiveMap;
    scheduleOnUI((value: LiveMap) => {
      'worklet';
      const moving = activeId.get();
      const current = live.get()[moving];
      if (moving && current && value[moving]) {
        value[moving] = {
          ...value[moving],
          x: current.x,
          y: current.y,
          scale: current.scale,
          rotation: current.rotation,
        };
      }
      live.set(value);
    }, incoming);
  }, [nextKey, live, activeId]);

  useEffect(() => {
    selected.set(selectedId ?? '');
  }, [selectedId, selected]);

  // ------------------------------------------------------------ worklets --

  const select = (id: string) => {
    'worklet';
    if (selected.get() === id) return;
    selected.set(id);
    scheduleOnRN(onSelect, id || null);
  };

  const patch = (id: string, change: Partial<LiveMap[string]>) => {
    'worklet';
    const map = live.get();
    if (!map[id]) return;
    live.set({ ...map, [id]: { ...map[id], ...change } });
  };

  const claim = (id: string) => {
    'worklet';
    if (!activeId.get()) activeId.set(id);
    return activeId.get();
  };

  /** Drops the piece into the bin: it shrinks into it, then leaves the board. */
  const dropInTrash = (id: string) => {
    'worklet';
    exitId.set(id);
    scheduleOnRN(haptics.dropSuccess);
    exitT.set(
      withTiming(1, { duration: reduced ? durations.reducedFade : 240 }, (done) => {
        if (!done) return;
        const map = { ...live.get() };
        delete map[id];
        live.set(map);
        exitId.set('');
        exitT.set(0);
        scheduleOnRN(onRemove, id, 'trash');
      }),
    );
  };

  /** When every gesture on the piece has ended: one commit, so one undo step. */
  const settle = () => {
    'worklet';
    if (panOn.get() || pinchOn.get() || rotateOn.get()) return;
    const id = activeId.get();
    activeId.set('');
    if (!id) return;
    if (hot.get() === 1) {
      hot.set(0);
      dropInTrash(id);
      return;
    }
    const p = live.get()[id];
    if (p) {
      scheduleOnRN(onCommitPose, id, { x: p.x, y: p.y, scale: p.scale, rotation: normaliseRotation(p.rotation) });
    }
  };

  const setGuides = (x: number | null, y: number | null) => {
    'worklet';
    const nx = x ?? -1;
    const ny = y ?? -1;
    const fresh = (nx >= 0 && nx !== guideX.get()) || (ny >= 0 && ny !== guideY.get());
    guideX.set(nx);
    guideY.set(ny);
    if (fresh) scheduleOnRN(haptics.tap);
  };

  const setRotation = (id: string, raw: number) => {
    'worklet';
    const snap = snapRotation(raw);
    if (snap.snapped && !rotationSnapped.get()) scheduleOnRN(haptics.tap);
    rotationSnapped.set(snap.snapped);
    patch(id, { rotation: snap.rotation });
  };

  // ------------------------------------------------------------ gestures --

  const pan = Gesture.Pan()
    .minDistance(4)
    .averageTouches(true)
    .onStart((e) => {
      const sx = e.x - e.translationX;
      const sy = e.y - e.translationY;
      const map = live.get();
      const sel = selected.get();
      const all = placedPieces(map, width, height);
      const selPiece = all.find((p) => p.id === sel);

      if (selPiece && e.numberOfPointers === 1 && isOnHandle(selPiece, { x: sx, y: sy }, width)) {
        mode.set('handle');
        claim(sel);
        rotationSnapped.set(false);
        start.set({
          ...start.get(),
          cx: selPiece.cx,
          cy: selPiece.cy,
          scale: selPiece.scale,
          rotation: selPiece.rotation,
          angle: Math.atan2(sy - selPiece.cy, sx - selPiece.cx),
          distance: Math.max(1, Math.hypot(sx - selPiece.cx, sy - selPiece.cy)),
        });
        panOn.set(true);
        return;
      }

      let id = e.numberOfPointers === 1 ? hitTest(all, { x: sx, y: sy }, width) : null;
      if (!id && e.numberOfPointers > 1 && selPiece) id = sel;
      if (!id) {
        mode.set('none');
        return;
      }
      id = claim(id);
      const piece = all.find((p) => p.id === id);
      if (!piece) return;
      mode.set('move');
      select(id);
      start.set({ ...start.get(), cx: piece.cx, cy: piece.cy, fx: sx, fy: sy });
      targets.set(
        snapTargets(
          all.filter((p) => p.id !== id),
          { width, height },
        ),
      );
      dragging.set(1);
      lift.set(reduced ? 1 : withSpring(1, springs.snappy));
      panOn.set(true);
      scheduleOnRN(setHint, 'drag');
    })
    .onUpdate((e) => {
      const id = activeId.get();
      const p = live.get()[id];
      if (!panOn.get() || !p) return;
      const s = start.get();

      if (mode.get() === 'handle') {
        const out = handleTransform(
          { scale: s.scale, rotation: s.rotation, angle: s.angle, distance: s.distance },
          { x: s.cx, y: s.cy },
          { x: e.x, y: e.y },
        );
        patch(id, { scale: out.scale });
        setRotation(id, out.rotation);
        return;
      }

      const fx = s.fx + e.translationX;
      const fy = s.fy + e.translationY;
      const overTrash = e.numberOfPointers === 1 && Math.hypot(fx - trash.x, fy - trash.y) < TRASH_CATCH ? 1 : 0;
      if (overTrash !== hot.get()) {
        hot.set(overTrash);
        if (overTrash) scheduleOnRN(haptics.tap);
        scheduleOnRN(setHint, overTrash ? 'hot' : 'drag');
      }

      const at = clampToBoard({ x: s.cx + e.translationX, y: s.cy + e.translationY }, { width, height });
      if (overTrash) {
        setGuides(null, null);
        patch(id, { x: at.x / width, y: at.y / height });
        return;
      }
      const snapped = snapPiece(
        { cx: at.x, cy: at.y, scale: p.scale, rotation: p.rotation, aspect: p.aspect },
        targets.get(),
        width,
      );
      setGuides(snapped.guideX, snapped.guideY);
      patch(id, { x: snapped.cx / width, y: snapped.cy / height });
    })
    .onFinalize(() => {
      if (!panOn.get()) return;
      panOn.set(false);
      if (mode.get() === 'move') {
        dragging.set(0);
        lift.set(reduced ? 0 : withSpring(0, springs.gentle));
        setGuides(null, null);
        scheduleOnRN(setHint, 'idle');
      }
      mode.set('none');
      settle();
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      const map = live.get();
      const under = hitTest(placedPieces(map, width, height), { x: e.focalX, y: e.focalY }, width);
      const wanted = under ?? selected.get();
      if (!wanted || !map[wanted]) return;
      const id = claim(wanted);
      select(id);
      pinchBase.set(map[id].scale);
      pinchOn.set(true);
    })
    .onUpdate((e) => {
      if (!pinchOn.get()) return;
      patch(activeId.get(), { scale: clampScale(pinchBase.get() * e.scale) });
    })
    .onFinalize(() => {
      if (!pinchOn.get()) return;
      pinchOn.set(false);
      settle();
    });

  const rotation = Gesture.Rotation()
    .onStart((e) => {
      const map = live.get();
      const under = hitTest(placedPieces(map, width, height), { x: e.anchorX, y: e.anchorY }, width);
      const wanted = under ?? selected.get();
      if (!wanted || !map[wanted]) return;
      const id = claim(wanted);
      select(id);
      rotateBase.set(map[id].rotation);
      rotationSnapped.set(false);
      rotateOn.set(true);
    })
    .onUpdate((e) => {
      if (!rotateOn.get()) return;
      setRotation(activeId.get(), rotateBase.get() + (e.rotation * 180) / Math.PI);
    })
    .onFinalize(() => {
      if (!rotateOn.get()) return;
      rotateOn.set(false);
      settle();
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((e, success) => {
      if (!success) return;
      const map = live.get();
      const all = placedPieces(map, width, height);
      const sel = all.find((p) => p.id === selected.get());
      if (sel && isOnHandle(sel, { x: e.x, y: e.y }, width)) return;
      const id = hitTest(all, { x: e.x, y: e.y }, width);
      if (id) scheduleOnRN(haptics.tap);
      select(id ?? '');
    });

  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch, rotation), tap);

  // ---------------------------------------------------------- rendering --

  const specs: CanvasPieceSpec[] = byZ(pieces).flatMap((p) => {
    const art = arts.get(p.itemId);
    if (!art) return [];
    const entrance: Entrance = popIds.has(p.itemId) ? 'pop' : 'fade';
    return [{ id: p.itemId, art, entrance, tilt: popTilt(p.itemId) }];
  });

  const shadow = {
    strong: withAlpha(colors.shadow, shadowOpacity[scheme].strong),
    soft: withAlpha(colors.shadow, shadowOpacity[scheme].soft),
  };

  const ring = useAnimatedStyle(() => ({
    opacity: withTiming(dropHover.get(), { duration: 160 }),
  }));

  const selectedPiece = pieces.find((p) => p.itemId === selectedId) ?? null;

  /** VoiceOver / TalkBack: each piece is an element with its own actions. */
  const onPieceAction = (piece: BoardPiece, e: AccessibilityActionEvent) => {
    const pose = { x: piece.x, y: piece.y, scale: piece.scale, rotation: piece.rotation };
    switch (e.nativeEvent.actionName) {
      case 'activate':
        onSelect(piece.itemId);
        break;
      case 'lock':
        onToggleLock(piece.itemId);
        break;
      case 'forward':
        onForward(piece.itemId);
        break;
      case 'backward':
        onBackward(piece.itemId);
        break;
      case 'larger':
        onCommitPose(piece.itemId, { ...pose, scale: clampScale(piece.scale + 0.15) });
        break;
      case 'smaller':
        onCommitPose(piece.itemId, { ...pose, scale: clampScale(piece.scale - 0.15) });
        break;
      case 'rotate':
        onCommitPose(piece.itemId, { ...pose, rotation: normaliseRotation(piece.rotation + 15) });
        break;
      case 'remove':
        onRemove(piece.itemId, 'toolbar');
        break;
    }
  };

  return (
    <View
      ref={ref}
      collapsable={false}
      className="overflow-hidden rounded-lg bg-board"
      style={{ width, height, borderWidth: 1, borderColor: withAlpha(colors.ink, hairline.line) }}
    >
      <GestureDetector gesture={gesture}>
        <View style={{ width, height }} accessibilityLabel="Outfit canvas">
          <BoardCanvas
            pieces={specs}
            motion={motion}
            width={width}
            height={height}
            trash={trash}
            shadow={shadow}
            dotColor={withAlpha(colors.ink, hairline.lineStrong)}
            accent={colors.accent}
          />
          {pieces
            .filter((p) => p.locked)
            .map((p) => (
              <LockBadge key={p.itemId} id={p.itemId} motion={motion} width={width} height={height} />
            ))}
          <CornerHandle motion={motion} width={width} height={height} />

          {byZ(pieces).map((p) => {
            const b = pieceBounds(
              { cx: p.x * width, cy: p.y * height, scale: p.scale, rotation: p.rotation, aspect: aspectOf(p.itemId) },
              width,
            );
            const name = names.get(p.itemId) ?? 'Piece';
            return (
              <View
                key={p.itemId}
                pointerEvents="none"
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${name}${p.locked ? ', locked' : ''}`}
                accessibilityState={{ selected: p.itemId === selectedId }}
                accessibilityHint="Swipe up or down for actions"
                accessibilityActions={[
                  { name: 'activate', label: 'Select' },
                  { name: 'lock', label: p.locked ? 'Unlock' : 'Lock for shuffle' },
                  { name: 'forward', label: 'Bring forward' },
                  { name: 'backward', label: 'Send backward' },
                  { name: 'larger', label: 'Make larger' },
                  { name: 'smaller', label: 'Make smaller' },
                  { name: 'rotate', label: 'Rotate' },
                  { name: 'remove', label: 'Remove from outfit' },
                ]}
                onAccessibilityAction={(e) => onPieceAction(p, e)}
                style={{ position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height }}
              />
            );
          })}

          {pieces.length === 0 ? (
            <View className="absolute items-center gap-2.5" style={{ top: height * 0.3, left: 36, right: 36 }}>
              <Layers size={46} color={colors.faint} strokeWidth={1.3} />
              <Text variant="display3" style={{ fontSize: 22, lineHeight: 26 }} className="text-center">
                An empty board
              </Text>
              <Text variant="bodySm" tone="muted" className="text-center">
                Tap pieces in the tray below to start styling, or let Shuffle pick a look.
              </Text>
              <View className="mt-2">
                <Button label="Shuffle a look" icon={Shuffle} variant="secondary" size="sm" onPress={onShuffle} />
              </View>
            </View>
          ) : (
            <Text
              variant="caption"
              weight="semibold"
              tone={hint === 'hot' ? 'danger' : 'muted'}
              className="absolute left-4 top-3.5"
              pointerEvents="none"
              importantForAccessibility="no"
            >
              {HINT[hint]}
            </Text>
          )}
        </View>
      </GestureDetector>

      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', inset: 0, borderRadius: 28, borderWidth: 2, borderColor: colors.accent }, ring]}
      />
      <TrashZone motion={motion} />
      <BoardToolbar
        visible={!!selectedPiece && hint === 'idle'}
        locked={!!selectedPiece?.locked}
        atFront={!!selectedPiece && isFront(pieces, selectedPiece.itemId)}
        atBack={!!selectedPiece && isBack(pieces, selectedPiece.itemId)}
        onLock={() => selectedPiece && onToggleLock(selectedPiece.itemId)}
        onForward={() => selectedPiece && onForward(selectedPiece.itemId)}
        onBackward={() => selectedPiece && onBackward(selectedPiece.itemId)}
        onRemove={() => selectedPiece && onRemove(selectedPiece.itemId, 'toolbar')}
      />
    </View>
  );
}

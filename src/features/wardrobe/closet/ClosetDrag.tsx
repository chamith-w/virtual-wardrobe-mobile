import { ArrowDown } from 'lucide-react-native';
import { createContext, use, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  scrollTo,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTabBarInset } from '@/components/navigation/TabBar';
import { Cutout, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useMotionReduced } from '@/theme/motion';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

/** What's being carried: enough to draw the ghost and commit the move. */
export type DragPiece = {
  id: string;
  name: string;
  thumbUri: string | null;
  zoneId: string | null;
  width: number;
  height: number;
};

type ZoneRect = { id: string; x: number; y: number; w: number; h: number };

/** The basket's hit area reaches half its width beyond its edges (Closet.dc.html). */
const BASKET_PAD = 0.5;

type ClosetDragValue = {
  /** Drop targets register their view so it can be measured when a drag starts. */
  register: (zoneId: string, view: View | null) => void;
  /** The floating laundry basket registers the same way. */
  registerBasket: (view: View | null) => void;
  /** 1 while the carried piece is over the basket. */
  hoverBasket: SharedValue<number>;
  /** Bumped each time a piece lands in the basket (it squashes). */
  basketDrops: SharedValue<number>;
  begin: (piece: DragPiece) => void;
  end: () => void;
  cancel: () => void;
  /** Worklet: feeds the finger position (window coordinates) and hit-tests zones. */
  pointer: (x: number, y: number) => void;
  hoverZone: SharedValue<string>;
  sourceZone: SharedValue<string>;
  draggingId: SharedValue<string>;
};

const ClosetDragContext = createContext<ClosetDragValue | null>(null);

export function useClosetDrag(): ClosetDragValue {
  const ctx = use(ClosetDragContext);
  if (!ctx) throw new Error('useClosetDrag must be used inside <ClosetDragProvider>');
  return ctx;
}

const EDGE = 96;
const MAX_SCROLL_STEP = 16;
/** How long the ghost takes to drop into the basket. */
const BASKET_FALL = 300;

type ProviderProps = {
  children: ReactNode;
  scrollRef: AnimatedRef<ScrollView>;
  scrollY: SharedValue<number>;
  /** Called on a drop over a different zone. */
  onDrop: (piece: DragPiece, zoneId: string) => void;
  /** Called on a drop over the laundry basket; true when the piece went in. */
  onDropBasket: (piece: DragPiece) => boolean;
  onDraggingChange: (dragging: boolean) => void;
};

/**
 * Long-press-and-drag for the closet: lift a piece, carry a tilted ghost of it
 * under the finger, and drop it on another zone or into the floating laundry
 * basket. Zone rects are measured once when the drag starts and corrected for
 * scroll on the UI thread (the basket floats, so it needs no correction), and
 * the page auto-scrolls near the top and bottom edges.
 */
export function ClosetDragProvider({
  children,
  scrollRef,
  scrollY,
  onDrop,
  onDropBasket,
  onDraggingChange,
}: ProviderProps) {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const reduced = useMotionReduced();

  const rootRef = useRef<View>(null);
  const zoneViews = useRef(new Map<string, View>());
  const basketView = useRef<View | null>(null);
  const pieceRef = useRef<DragPiece | null>(null);
  const callbacks = useRef({ onDrop, onDropBasket, onDraggingChange });
  useLayoutEffect(() => {
    callbacks.current = { onDrop, onDropBasket, onDraggingChange };
  });

  const [ghost, setGhost] = useState<DragPiece | null>(null);

  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const lift = useSharedValue(0);
  const rects = useSharedValue<ZoneRect[]>([]);
  const measuredAt = useSharedValue(0);
  const hoverZone = useSharedValue('');
  const sourceZone = useSharedValue('');
  const draggingId = useSharedValue('');
  /** The basket in window coordinates; it floats, so scrolling never moves it. */
  const basketRect = useSharedValue<ZoneRect | null>(null);
  const hoverBasket = useSharedValue(0);
  const basketDrops = useSharedValue(0);
  /** 0 → 1 as the ghost drops into the basket. */
  const landing = useSharedValue(0);

  const pointer = (x: number, y: number) => {
    'worklet';
    px.set(x);
    py.set(y);
    const b = basketRect.get();
    const pad = b ? b.w * BASKET_PAD : 0;
    const overBasket = !!b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
    if (overBasket !== (hoverBasket.get() === 1)) {
      hoverBasket.set(overBasket ? 1 : 0);
      if (overBasket) scheduleOnRN(haptics.tap);
    }
    if (overBasket) {
      hoverZone.set('');
      return;
    }
    const shift = scrollY.get() - measuredAt.get();
    let hit = '';
    for (const r of rects.get()) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y - shift && y <= r.y - shift + r.h) {
        hit = r.id;
        break;
      }
    }
    if (hit !== hoverZone.get()) {
      hoverZone.set(hit);
      if (hit && hit !== sourceZone.get()) scheduleOnRN(haptics.tap);
    }
  };

  const autoScroll = useFrameCallback(() => {
    const y = py.get();
    const top = insets.top + EDGE;
    const bottom = screenH - tabInset - EDGE * 0.6;
    let step = 0;
    if (y < top) step = -Math.min(MAX_SCROLL_STEP, (top - y) * 0.18);
    else if (y > bottom) step = Math.min(MAX_SCROLL_STEP, (y - bottom) * 0.18);
    if (step === 0) return;
    scrollTo(scrollRef, 0, Math.max(0, scrollY.get() + step), false);
    pointer(px.get(), py.get());
  }, false);

  const measureZones = () => {
    measuredAt.set(scrollY.get());
    rootRef.current?.measureInWindow((x, y) => {
      originX.set(x);
      originY.set(y);
    });
    const entries = [...zoneViews.current.entries()];
    Promise.all(
      entries.map(
        ([id, view]) =>
          new Promise<ZoneRect>((resolve) => view.measureInWindow((x, y, w, h) => resolve({ id, x, y, w, h }))),
      ),
    ).then((list) => {
      rects.set(list);
      pointer(px.get(), py.get());
    });
    basketRect.set(null);
    basketView.current?.measureInWindow((x, y, w, h) => {
      basketRect.set(w > 0 ? { id: 'basket', x, y, w, h } : null);
    });
  };

  const begin = (piece: DragPiece) => {
    pieceRef.current = piece;
    sourceZone.set(piece.zoneId ?? '');
    haptics.press();
    setGhost(piece);
    landing.set(0);
    lift.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.bouncy));
    measureZones();
    autoScroll.setActive(true);
    callbacks.current.onDraggingChange(true);
  };

  const finish = (commit: boolean) => {
    const piece = pieceRef.current;
    if (!piece) return;
    pieceRef.current = null;
    autoScroll.setActive(false);
    const zoneId = hoverZone.get();
    const intoBasket = commit && hoverBasket.get() === 1 && callbacks.current.onDropBasket(piece);
    if (commit && !intoBasket && zoneId && zoneId !== piece.zoneId) callbacks.current.onDrop(piece, zoneId);
    hoverZone.set('');
    hoverBasket.set(0);
    sourceZone.set('');
    draggingId.set('');
    rects.set([]);
    let exit: number = durations.reducedFade;
    if (intoBasket) {
      // The ghost drops into the basket, which squashes as it lands.
      exit = reduced ? durations.reducedFade : BASKET_FALL;
      landing.set(
        reduced
          ? withTiming(1, { duration: durations.reducedFade })
          : withTiming(1, { duration: BASKET_FALL, easing: Easing.in(Easing.quad) }),
      );
      setTimeout(() => basketDrops.set(basketDrops.get() + 1), reduced ? 0 : BASKET_FALL - 60);
    } else {
      lift.set(withTiming(0, { duration: durations.reducedFade }));
    }
    setTimeout(() => setGhost((g) => (g?.id === piece.id ? null : g)), exit + 20);
    callbacks.current.onDraggingChange(false);
  };

  const value: ClosetDragValue = {
    register: (zoneId, view) => {
      if (view) zoneViews.current.set(zoneId, view);
      else zoneViews.current.delete(zoneId);
    },
    registerBasket: (view) => {
      basketView.current = view;
    },
    hoverBasket,
    basketDrops,
    begin,
    end: () => finish(true),
    cancel: () => finish(false),
    pointer,
    hoverZone,
    sourceZone,
    draggingId,
  };

  return (
    <ClosetDragContext value={value}>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
        {children}
        {ghost ? (
          <DragOverlay
            piece={ghost}
            px={px}
            py={py}
            originX={originX}
            originY={originY}
            lift={lift}
            landing={landing}
            basket={basketRect}
          />
        ) : null}
      </View>
    </ClosetDragContext>
  );
}

function DragOverlay({
  piece,
  px,
  py,
  originX,
  originY,
  lift,
  landing,
  basket,
}: {
  piece: DragPiece;
  px: SharedValue<number>;
  py: SharedValue<number>;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  lift: SharedValue<number>;
  landing: SharedValue<number>;
  basket: SharedValue<ZoneRect | null>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const w = piece.width * 1.15;
  const h = piece.height * 1.15;

  const ghostStyle = useAnimatedStyle(() => {
    const l = lift.get();
    const k = landing.get();
    const b = basket.get();
    // Centre of the ghost: under the finger, or on its way into the basket.
    let cx = px.get();
    let cy = py.get() - h * 0.45 + h / 2;
    if (b && k > 0) {
      cx += (b.x + b.w / 2 - cx) * k;
      cy += (b.y + b.h * 0.4 - cy) * k;
    }
    const base = [{ translateX: cx - originX.get() - w / 2 }, { translateY: cy - originY.get() - h / 2 }];
    if (reduced) return { opacity: l * (1 - k), transform: base };
    return {
      opacity: Math.min(1, l * 1.4) * (1 - k * k),
      transform: [...base, { rotate: `${-7 * l + 10 * k}deg` }, { scale: (0.92 + 0.16 * l) * (1 - 0.75 * k) }],
    };
  });

  const hintStyle = useAnimatedStyle(() => {
    const shown = lift.get() * (1 - landing.get());
    return { opacity: shown, transform: reduced ? [] : [{ translateY: (1 - shown) * -24 }] };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, ghostStyle]}>
        <Cutout uri={piece.thumbUri} width={w} height={h} shadow="lifted" />
      </Animated.View>
      <Animated.View
        style={[{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center' }, hintStyle]}
      >
        <View
          className="flex-row items-center gap-2 rounded-pill py-2.5 pl-3 pr-4"
          style={{
            backgroundColor: colors.accentSecondary,
            shadowColor: colors.shadow,
            shadowOpacity: 0.24,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 12 },
          }}
        >
          <ArrowDown size={18} color={colors.onAccentSecondary} strokeWidth={2} />
          <Text variant="bodySm" weight="medium" tone="onAccentSecondary">
            Drop on a zone, or in the basket to wash it
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Wraps a zone so pieces can be dropped on it: it registers for measurement
 * and lights up with a green ring while a piece hovers over it.
 */
export function DropZone({
  zoneId,
  radius,
  children,
  style,
  className,
}: {
  zoneId: string;
  radius: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}) {
  const { colors } = useTheme();
  const { register, hoverZone, sourceZone } = useClosetDrag();
  const ref = useRef<View>(null);

  useEffect(() => {
    register(zoneId, ref.current);
    return () => register(zoneId, null);
  }, [register, zoneId]);

  const ringStyle = useAnimatedStyle(() => {
    const on = hoverZone.get() === zoneId && sourceZone.get() !== zoneId;
    return { opacity: withTiming(on ? 1 : 0, { duration: 160 }) };
  });

  return (
    <View ref={ref} collapsable={false} style={style} className={className}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 2,
            borderColor: colors.accentSecondary,
            backgroundColor: withAlpha(colors.accentSecondary, 0.08),
          },
          ringStyle,
        ]}
      />
    </View>
  );
}

/** The long-press pan that lifts a piece. Combine with the piece's own press handling. */
export function useLongPressDrag(piece: DragPiece, enabled: boolean) {
  const { begin, end, cancel, pointer, draggingId } = useClosetDrag();
  return Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(320)
    .onStart((e) => {
      draggingId.set(piece.id);
      pointer(e.absoluteX, e.absoluteY);
      scheduleOnRN(begin, piece);
    })
    .onUpdate((e) => {
      pointer(e.absoluteX, e.absoluteY);
    })
    .onEnd(() => {
      scheduleOnRN(end);
    })
    .onFinalize((_e, success) => {
      if (!success) scheduleOnRN(cancel);
    });
}

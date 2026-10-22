import { ChevronDown, Layers, Trash2, WandSparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedPressable, Button, Screen, Sheet, Text, type SheetRef } from '@/components/ui';
import { useTabBarInset } from '@/components/navigation/TabBar';
import { OutfitThumb } from '@/features/outfits/OutfitThumb';
import { planOutfit } from '@/features/outfits/mutations';
import { planToast } from '@/features/outfits/plan';
import { useOutfitList, type OutfitSummary } from '@/features/outfits/useOutfits';
import type { WearDay } from '@/features/suggestions/engine';
import { useLookItems } from '@/features/suggestions/useLookItems';
import { engineWeatherFor } from '@/features/suggestions/weather';
import { useCurrentDay } from '@/features/today/useCurrentDay';
import { dayForecast } from '@/features/weather/forecast';
import { weatherSnapshotFor } from '@/features/weather/store';
import { formatTemp } from '@/features/weather/units';
import { useWeather } from '@/features/weather/useWeather';
import { describeWeather, type WeatherIconName } from '@/features/weather/wmo';
import { addMonths, fromDayKey, toDayKey, type DayKey } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { deleteImage } from '@/lib/images';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

import {
  calendarRows,
  CELL_HEIGHT,
  dayKind,
  dotColors,
  firstOfMonth,
  loadRange,
  ROW_HEIGHT,
  rowOf,
  stepWeek,
  tripOn,
} from './calendar';
import { CalendarCard, type DayInfo } from './CalendarCard';
import { DayPanel } from './DayPanel';
import { logToast } from './logEffects';
import { LogWornSheet, type LogDraftView, type LogSave } from './LogWornSheet';
import { clearPlan, planLook } from './mutations';
import { DOCK_CARD, DOCK_HEIGHT, OutfitDock, type DockDrag } from './OutfitDock';
import { PickOutfitSheet } from './PickOutfitSheet';
import { suggestForDay, suggestionInputFor } from './suggestForDay';
import { useLogs, usePlans, useUpcomingTrips } from './usePlannerData';
import { deleteWearLog, writeWearLog } from './wearLog';

/** Where the calendar's visible cells are on screen while an outfit is dragged. */
type GridRect = { x: number; y: number; w: number; firstRow: number; rows: number };

/** The outfit under the finger while it's dragged from the dock. */
function DockGhost({
  outfit,
  x,
  y,
  origin,
  lift,
}: {
  outfit: OutfitSummary;
  x: SharedValue<number>;
  y: SharedValue<number>;
  origin: SharedValue<{ x: number; y: number }>;
  lift: SharedValue<number>;
}) {
  const { colors, isDark } = useTheme();
  const reduced = useMotionReduced();
  const { width: w, height: h } = DOCK_CARD;
  const style = useAnimatedStyle(() => {
    const l = lift.get();
    const at = [{ translateX: x.get() - origin.get().x - w / 2 }, { translateY: y.get() - origin.get().y - h * 0.7 }];
    if (reduced) return { opacity: l, transform: at };
    return { opacity: Math.min(1, l * 1.4), transform: [...at, { rotate: `${-5 * l}deg` }, { scale: 0.9 + 0.15 * l }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.62 : 0.24,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 18 },
          elevation: 10,
        },
        style,
      ]}
    >
      <OutfitThumb outfit={outfit} width={w} height={h} />
    </Animated.View>
  );
}

/** The Week / Month toggle, its chevron turning as the calendar opens. */
function ViewToggle({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const turn = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    turn.set(
      reduced
        ? withTiming(expanded ? 1 : 0, { duration: durations.reducedFade })
        : withSpring(expanded ? 1 : 0, springs.bouncy),
    );
  }, [expanded, reduced, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * turn.get()}deg` }] }));
  return (
    <AnimatedPressable
      accessibilityLabel={expanded ? 'Show one week' : 'Show the whole month'}
      accessibilityState={{ expanded }}
      onPress={onPress}
      className="h-11 flex-row items-center gap-1.5 rounded-pill border border-line bg-surface pl-4 pr-3.5"
    >
      <Text variant="bodySm" weight="semibold">
        {expanded ? 'Month' : 'Week'}
      </Text>
      <Animated.View style={style}>
        <ChevronDown size={16} strokeWidth={2} color={colors.ink} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const sortForDock = (outfits: readonly OutfitSummary[]) =>
  [...outfits].filter((o) => o.pieces.length > 0).sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

/**
 * The Planner (Planner.dc.html): a week strip that opens into the month,
 * the selected day below it, and a dock of outfits to drag onto days.
 */
export function PlannerScreen({ initialDay }: { initialDay?: DayKey }) {
  const { width: screenW } = useWindowDimensions();
  const tabInset = useTabBarInset();
  const reduced = useMotionReduced();
  const unit = usePreferences((s) => s.temperatureUnit);
  const now = useCurrentDay();
  const today = toDayKey(now);

  // ------------------------------------------------------------ calendar --
  const [selected, setSelected] = useState<DayKey>(initialDay ?? today);
  const selectedDate = fromDayKey(selected);
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState(() => firstOfMonth(selectedDate));
  const rows = calendarRows(month);
  const [weekRow, setWeekRow] = useState(() =>
    Math.max(0, rowOf(calendarRows(firstOfMonth(selectedDate)), selectedDate)),
  );

  const select = (day: Date) => setSelected(toDayKey(day));
  const toggle = () => {
    if (expanded) {
      const r = rowOf(rows, selectedDate);
      if (r >= 0) setWeekRow(r);
    }
    setExpanded(!expanded);
  };
  const step = (by: 1 | -1) => {
    if (expanded) {
      const next = addMonths(month, by);
      setMonth(next);
      setWeekRow(Math.max(0, rowOf(calendarRows(next), selectedDate)));
      return;
    }
    const next = stepWeek(rows, weekRow, by, selectedDate);
    setMonth(next.month);
    setWeekRow(next.row);
  };

  // ---------------------------------------------------------------- data --
  const range = loadRange(rows, selected);
  const { plans } = usePlans(range.from, range.to);
  const { logs } = useLogs(range.from, range.to);
  const { outfits } = useOutfitList();
  const { items, loaded: itemsLoaded } = useLookItems();
  const { data: trips } = useUpcomingTrips(today);
  const weather = useWeather();
  const outfitById = new Map(outfits.map((o) => [o.id, o]));

  const plannedOn = (day: DayKey) => {
    const plan = plans.get(day);
    return plan ? (outfitById.get(plan.outfitId) ?? null) : null;
  };
  const info = (day: DayKey): DayInfo => {
    const worn = logs.has(day);
    const planned = plannedOn(day);
    return {
      worn,
      dots: !worn && planned ? dotColors(planned.pieces) : [],
      planned: planned?.name ?? null,
      trip: tripOn(day, trips)?.name ?? null,
    };
  };

  const log = logs.get(selected) ?? null;
  const planned = plannedOn(selected);
  const kind = dayKind(selected, today, !!log, !!planned);
  const trip = tripOn(selected, trips);

  const weatherFor = (day: DayKey): { line: string; icon: WeatherIconName } | null => {
    const logged = logs.get(day)?.weather;
    if (logged)
      return { line: `${formatTemp(logged.tempC, unit)} · ${logged.summary}`, icon: describeWeather(logged.code).icon };
    const f = weather.forecast;
    if (!f) return null;
    if (day === today) {
      const w = describeWeather(f.current.code, f.current.isDay);
      return { line: `${formatTemp(f.current.tempC, unit)} · ${w.summary}`, icon: w.icon };
    }
    const d = dayForecast(f, day);
    if (!d) return null;
    const w = describeWeather(d.code);
    return { line: `${formatTemp(d.maxC, unit)} · ${w.summary}`, icon: w.icon };
  };

  // ------------------------------------------------------------ planning --
  const planOn = (outfit: OutfitSummary, day: DayKey, how: 'drop' | 'tap') => {
    if (day < today) {
      haptics.warning();
      toast('That day has passed', 'info');
      return;
    }
    const result = planOutfit(outfit.id, day);
    if (how === 'drop') haptics.dropSuccess();
    else haptics.statusChanged();
    toast(`${outfit.name} · ${planToast(fromDayKey(day), result, now)}`);
    setSelected(day);
  };

  const pickRef = useRef<SheetRef>(null);
  const [pickMode, setPickMode] = useState<'plan' | 'log'>('plan');
  const openPick = (mode: 'plan' | 'log') => {
    setPickMode(mode);
    pickRef.current?.present();
  };

  const suggest = () => {
    if (!itemsLoaded) return;
    const wearDays: WearDay[] = [...logs.values()].map((l) => ({ date: l.date, itemIds: l.pieces.map((p) => p.id) }));
    const planDays: WearDay[] = [...plans.values()].flatMap((p) => {
      const o = outfitById.get(p.outfitId);
      return o ? [{ date: p.date, itemIds: o.pieces.map((x) => x.itemId) }] : [];
    });
    const dayWeather = engineWeatherFor(weather.forecast, selected, now, selected === today ? weather.override : null);
    const input = suggestionInputFor({
      day: selected,
      now,
      items,
      logs: wearDays,
      plans: planDays,
      weather: dayWeather,
      latitude: weather.forecast?.place.latitude ?? null,
    });
    const look = suggestForDay(input, planned?.pieces.map((p) => p.itemId) ?? []);
    pickRef.current?.dismiss();
    if (!look) {
      haptics.warning();
      toast('Nothing in the wardrobe suits that day yet', 'info');
      return;
    }
    const result = planLook(look.itemIds, selected);
    haptics.dropSuccess();
    const line = weatherFor(selected)?.line;
    toast(line ? `${result.name} · suggested for ${line}` : `${result.name} · suggested`);
  };

  // ------------------------------------------------------------- logging --
  const logRef = useRef<SheetRef>(null);
  const deleteRef = useRef<SheetRef>(null);
  const [draft, setDraft] = useState<LogDraftView | null>(null);
  const openLog = (next: LogDraftView) => {
    setDraft(next);
    logRef.current?.present();
  };
  const logOutfit = (outfit: OutfitSummary | null) =>
    openLog({
      mode: 'log',
      day: selected,
      outfitId: outfit?.id ?? null,
      pieces: (outfit?.pieces ?? []).map((p) => ({
        id: p.itemId,
        name: p.name,
        category: p.category,
        thumbUri: p.thumbUri,
      })),
      ticked: (outfit?.pieces ?? []).map((p) => p.itemId),
      photoUri: null,
      notes: null,
    });
  const editLog = () => {
    if (!log) return;
    openLog({
      mode: 'edit',
      day: log.date,
      outfitId: log.outfitId,
      pieces: log.pieces.map((p) => ({ id: p.id, name: p.name, category: p.category, thumbUri: p.thumbUri })),
      ticked: log.pieces.map((p) => p.id),
      photoUri: log.photoUri,
      notes: log.notes,
    });
  };
  const saveLog = (save: LogSave) => {
    if (!draft) return;
    const receipt = writeWearLog(
      {
        date: draft.day,
        itemIds: save.itemIds,
        outfitId: draft.outfitId,
        photoUri: save.photoUri,
        notes: save.notes,
        weather: weatherSnapshotFor(draft.day),
      },
      'replace',
    );
    if (draft.photoUri && draft.photoUri !== save.photoUri) deleteImage(draft.photoUri);
    haptics.statusChanged();
    toast(
      draft.mode === 'edit'
        ? 'Log updated'
        : logToast({
            added: receipt.added.length,
            worn: receipt.worn.length,
            laundry: receipt.laundry.length,
            already: receipt.added.length === 0,
          }),
    );
    logRef.current?.dismiss();
  };
  const confirmDelete = () => {
    logRef.current?.dismiss();
    haptics.warning();
    deleteRef.current?.present();
  };
  const doDelete = () => {
    if (log) deleteWearLog(log.id);
    deleteRef.current?.dismiss();
    haptics.statusChanged();
    toast('Log deleted', 'info');
  };

  // -------------------------------------------------- drag from the dock --
  const rootRef = useRef<View>(null);
  const gridRef = useRef<View>(null);
  const [ghost, setGhost] = useState<OutfitSummary | null>(null);
  const dragging = useRef<string | null>(null);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const origin = useSharedValue({ x: 0, y: 0 });
  const lift = useSharedValue(0);
  const grid = useSharedValue<GridRect | null>(null);
  const hover = useSharedValue(-1);
  const draggingId = useSharedValue('');

  const endGhost = (dropped: boolean) => {
    hover.set(-1);
    lift.set(
      withTiming(0, { duration: dropped || reduced ? 120 : 220 }, (done) => {
        if (done) scheduleOnRN(setGhost, null);
      }),
    );
    dragging.current = null;
  };

  const dockDrag: DockDrag = {
    draggingId,
    onBegin: (id) => {
      const outfit = outfitById.get(id);
      if (!outfit) return;
      dragging.current = id;
      setGhost(outfit);
      haptics.press();
      lift.set(reduced ? withTiming(1, { duration: durations.reducedFade }) : withSpring(1, springs.snappy));
      rootRef.current?.measureInWindow((x, y) => origin.set({ x, y }));
      gridRef.current?.measureInWindow((x, y, w) =>
        grid.set({ x, y, w, firstRow: expanded ? 0 : weekRow, rows: expanded ? rows.length : 1 }),
      );
    },
    onMove: (x, y) => {
      'worklet';
      gx.set(x);
      gy.set(y);
      const r = grid.get();
      let index = -1;
      if (r && r.w > 0) {
        const col = Math.floor(((x - r.x) / r.w) * 7);
        const row = Math.floor((y - r.y) / ROW_HEIGHT);
        const withinCell = y - r.y - row * ROW_HEIGHT <= CELL_HEIGHT;
        if (col >= 0 && col < 7 && row >= 0 && row < r.rows && withinCell) index = (r.firstRow + row) * 7 + col;
      }
      if (index !== hover.get()) {
        hover.set(index);
        if (index >= 0) scheduleOnRN(haptics.tap);
      }
    },
    onEnd: () => {
      const id = dragging.current;
      const index = hover.get();
      const outfit = id ? outfitById.get(id) : undefined;
      const day = index >= 0 ? rows[Math.floor(index / 7)]?.[index % 7] : undefined;
      endGhost(!!day);
      if (outfit && day) planOn(outfit, toDayKey(day), 'drop');
    },
    onCancel: () => endGhost(false),
  };

  // -------------------------------------------------------------- render --
  const dockBottom = tabInset + 12;
  const monthName = month.toLocaleDateString(undefined, { month: 'long' });

  return (
    <View ref={rootRef} collapsable={false} className="flex-1 bg-background">
      <Screen className="px-5" contentContainerStyle={{ paddingBottom: dockBottom + DOCK_HEIGHT + 24 }}>
        <View className="flex-row items-end justify-between">
          <View>
            <Text variant="eyebrow" className="mt-2">
              Planner
            </Text>
            <Text variant="display1" accessibilityRole="header" className="mt-2">
              {monthName}{' '}
              <Text variant="display1" tone="muted" style={{ fontSize: 24, letterSpacing: -0.5 }}>
                {month.getFullYear()}
              </Text>
            </Text>
          </View>
          <ViewToggle expanded={expanded} onPress={toggle} />
        </View>

        <View className="-mx-1.5 mt-4">
          <CalendarCard
            rows={rows}
            month={month}
            expanded={expanded}
            weekRow={weekRow}
            selected={selected}
            today={today}
            info={info}
            hover={hover}
            gridRef={gridRef}
            onSelect={select}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
        </View>

        <View className="pt-5">
          <DayPanel
            date={selectedDate}
            dayKey={selected}
            isToday={selected === today}
            kind={kind}
            weather={weatherFor(selected)}
            trip={trip}
            planned={kind === 'journal' ? null : planned}
            log={log}
            width={screenW - 40}
            onLog={() => logOutfit(planned)}
            onSwap={() => openPick('plan')}
            onClear={() => {
              clearPlan(selected);
              haptics.tap();
              toast('Plan cleared', 'info');
            }}
            onSuggest={suggest}
            onPick={() => openPick('plan')}
            onEditLog={editLog}
            onLogOutfit={() => openPick('log')}
          />
        </View>
      </Screen>

      <OutfitDock
        outfits={sortForDock(outfits)}
        bottom={dockBottom}
        drag={dockDrag}
        onTap={(o) => planOn(o, selected, 'tap')}
      />
      {ghost ? <DockGhost outfit={ghost} x={gx} y={gy} origin={origin} lift={lift} /> : null}

      <PickOutfitSheet
        ref={pickRef}
        eyebrow={selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={pickMode === 'log' ? 'What did you wear?' : 'Pick an outfit'}
        outfits={sortForDock(outfits)}
        lead={
          pickMode === 'log'
            ? {
                label: 'Pick pieces instead',
                hint: 'For a look you never saved',
                icon: Layers,
                onPress: () => {
                  pickRef.current?.dismiss();
                  logOutfit(null);
                },
              }
            : {
                label: 'Suggest one for the weather',
                hint: 'From what’s in your wardrobe',
                icon: WandSparkles,
                onPress: suggest,
              }
        }
        onPick={(o) => {
          pickRef.current?.dismiss();
          if (pickMode === 'log') logOutfit(o);
          else planOn(o, selected, 'tap');
        }}
      />
      <LogWornSheet
        ref={logRef}
        draft={draft}
        today={today}
        weatherLine={draft ? (weatherFor(draft.day)?.line ?? null) : null}
        candidates={items}
        onSave={saveLog}
        onDelete={draft?.mode === 'edit' ? confirmDelete : undefined}
      />
      <Sheet ref={deleteRef} eyebrow="Outfit journal" title="Delete this log?">
        <Text variant="body" tone="muted">
          Its pieces lose this wear, and the selfie goes too. Anything you did today goes back on its hanger.
        </Text>
        <Button label="Delete log" variant="danger" icon={Trash2} fullWidth className="mt-5" onPress={doDelete} />
        <Button
          label="Keep it"
          variant="ghost"
          fullWidth
          className="mt-1"
          onPress={() => deleteRef.current?.dismiss()}
        />
      </Sheet>
    </View>
  );
}

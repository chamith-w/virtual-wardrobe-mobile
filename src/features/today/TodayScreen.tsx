import { router } from 'expo-router';
import { ChevronRight, Clock, Moon, Repeat2, Sun, Thermometer, WashingMachine } from 'lucide-react-native';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import {
  AnimatedPressable,
  Card,
  EmptyState,
  IconButton,
  Screen,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { openItem } from '@/features/items/openItem';
import { lookPieces } from '@/features/outfits/look';
import { suggestOutfitName } from '@/features/outfits/defaults';
import { useOutfitList, type OutfitSummary } from '@/features/outfits/useOutfits';
import { logToast } from '@/features/planner/logEffects';
import { planLook, samePieces, unplanLook, type PlannedLook } from '@/features/planner/mutations';
import { usePlans, useUpcomingTrips } from '@/features/planner/usePlannerData';
import { undoWearLog, writeWearLog, type LogReceipt } from '@/features/planner/wearLog';
import { suggestionMeta, suggestionTags, wearAgainLine } from '@/features/suggestions/copy';
import { idleDays, suggestionKey, suggestOutfits, wearItAgain } from '@/features/suggestions/engine';
import { daySeed } from '@/features/suggestions/random';
import { useLookItems, useWearHistory, type LookItem } from '@/features/suggestions/useLookItems';
import { engineWeatherFor } from '@/features/suggestions/weather';
import { useForgottenCount, useStatusCounts } from '@/features/wardrobe/useWardrobeSummary';
import { DevWeatherSheet } from '@/features/weather/DevWeatherSheet';
import { weatherSnapshotFor } from '@/features/weather/store';
import { formatTemp } from '@/features/weather/units';
import { useWeather } from '@/features/weather/useWeather';
import { WeatherCard } from '@/features/weather/WeatherCard';
import { WeatherPlaceSheet } from '@/features/weather/WeatherPlaceSheet';
import { addDays, formatLongDay, greetingFor, toDayKey } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';
import { useWardrobeView } from '@/store/wardrobeView';
import { useTheme } from '@/theme/ThemeProvider';

import { isWornCard, reconcileCarousel, shuffleCard, startCarousel, type Carousel, type LookCard } from './carousel';
import { CARD_GAP, CARD_WIDTH, LookCardView } from './LookCardView';
import { TripCard } from './TripCard';
import { useCurrentDay } from './useCurrentDay';
import { WearAgainCard } from './WearAgainCard';

function Tile({
  value,
  label,
  icon,
  tint,
  onPress,
}: {
  value: number;
  label: string;
  icon: ReactNode;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${value} ${label}`} className="flex-1 gap-3" padded>
      <View className="h-9 w-9 items-center justify-center rounded-pill" style={{ backgroundColor: tint }}>
        {icon}
      </View>
      <View>
        <Text variant="display3" style={{ fontSize: 30, lineHeight: 32 }}>
          {value}
        </Text>
        <Text variant="caption" weight="semibold" className="mt-1">
          {label}
        </Text>
      </View>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <View className="rounded-lg border border-line bg-surface p-2.5" style={{ width: CARD_WIDTH }}>
      <Skeleton height={244} radius={20} />
      <View className="gap-2 px-2 pb-1 pt-3.5">
        <Skeleton width={70} height={10} radius={5} />
        <Skeleton width="70%" height={22} radius={8} />
      </View>
      <Skeleton height={52} radius={26} className="mt-2.5" />
    </View>
  );
}

function piecesFor(card: Pick<LookCard, 'itemIds'>, byId: ReadonlyMap<string, LookItem>): LookItem[] {
  return card.itemIds.flatMap((id) => byId.get(id) ?? []);
}

function savedOutfitFor(card: Pick<LookCard, 'itemIds'>, outfits: readonly OutfitSummary[]) {
  return (
    outfits.find((o) =>
      samePieces(
        o.pieces.map((p) => p.itemId),
        card.itemIds,
      ),
    ) ?? null
  );
}

/** Today (Today.dc.html): the date, the weather, three outfits for it, and a few nudges. */
export function TodayScreen() {
  const { colors, isDark, setPreference } = useTheme();
  const unit = usePreferences((s) => s.temperatureUnit);
  const now = useCurrentDay();
  const today = toDayKey(now);
  const tomorrowDate = addDays(now, 1);
  const tomorrow = toDayKey(tomorrowDate);

  const weather = useWeather();
  const counts = useStatusCounts();
  const forgotten = useForgottenCount(90);
  const { items, byId, loaded } = useLookItems();
  const { data: history } = useWearHistory(toDayKey(addDays(now, -10)), today);
  const { outfits } = useOutfitList();
  const { plans } = usePlans(today, tomorrow);
  const { data: trips } = useUpcomingTrips(today);

  const placeSheet = useRef<SheetRef>(null);
  const devSheet = useRef<SheetRef>(null);

  // --------------------------------------------------------- suggestions --
  const { forecast, override } = weather;
  const engineWeather = useMemo(
    () => engineWeatherFor(forecast, today, now, override),
    [forecast, today, now, override],
  );
  const temp = engineWeather ? formatTemp(engineWeather.feelsLikeC, unit) : null;
  const input = useMemo(
    () => ({
      items,
      weather: engineWeather,
      recentWear: history,
      today: now,
      latitude: forecast?.place.latitude ?? null,
      seed: daySeed(today),
    }),
    [items, engineWeather, history, now, forecast, today],
  );
  const ranked = useMemo(() => suggestOutfits(input), [input]);

  const wornToday = new Set(history.find((d) => d.date === today)?.itemIds ?? []);
  const [receipts, setReceipts] = useState<Record<string, LogReceipt>>({});
  const isWorn = (card: LookCard) => !!receipts[card.key] || isWornCard(card, wornToday);

  // Today's plan leads the carousel.
  const todayPlan = plans.get(today);
  const planOutfit = todayPlan ? outfits.find((o) => o.id === todayPlan.outfitId) : undefined;
  const lead: LookCard | null =
    planOutfit && planOutfit.pieces.length > 0
      ? {
          key: suggestionKey(planOutfit.pieces.map((p) => p.itemId)),
          itemIds: planOutfit.pieces.map((p) => p.itemId),
          suggestion: null,
          plan: { outfitId: planOutfit.id, name: planOutfit.name },
        }
      : null;

  const band = ranked[0]?.plan;
  const basis = `${today}|${band?.band ?? '-'}|${band?.rain ?? '-'}|${lead?.key ?? ''}|${loaded}`;
  const [carousel, setCarousel] = useState<Carousel | null>(null);
  // A new day, weather band or plan picks again, keeping whatever's been worn;
  // otherwise cards whose pieces went out are replaced.
  const restart = loaded && (!carousel || carousel.basis !== basis);
  const logged = new Set([...wornToday, ...Object.values(receipts).flatMap((r) => r.added)]);
  const shown = restart
    ? startCarousel(ranked, basis, lead, carousel?.cards.filter(isWorn) ?? [])
    : carousel && reconcileCarousel(carousel, ranked, (id) => byId.get(id)?.status === 'in_wardrobe', logged);
  if (shown !== carousel) setCarousel(shown);
  const cards = shown?.cards ?? [];

  const wear = (card: LookCard) => {
    const saved = card.plan ? null : savedOutfitFor(card, outfits);
    const r = writeWearLog(
      {
        date: today,
        itemIds: card.itemIds,
        outfitId: card.plan?.outfitId ?? saved?.id ?? null,
        weather: weatherSnapshotFor(today),
      },
      'add',
    );
    setReceipts((m) => ({ ...m, [card.key]: r }));
    haptics.statusChanged();
    toast(
      logToast({
        added: r.added.length,
        worn: r.worn.length,
        laundry: r.laundry.length,
        already: r.added.length === 0,
      }),
    );
  };

  const unwear = (card: LookCard) => {
    const r = receipts[card.key];
    if (r) undoWearLog(r);
    else writeWearLog({ date: today, itemIds: card.itemIds }, 'remove');
    setReceipts((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== card.key)));
    haptics.statusChanged();
    toast('Taken off today’s log', 'info');
  };

  const shuffle = (index: number) => {
    if (!shown) return;
    const next = shuffleCard(shown, ranked, index);
    if (!next) {
      haptics.warning();
      toast('Nothing else suits the day right now', 'info');
      return;
    }
    haptics.press();
    setCarousel(next);
  };

  const edit = (card: LookCard) => {
    const saved = card.plan ? { id: card.plan.outfitId } : savedOutfitFor(card, outfits);
    if (saved) router.push({ pathname: '/outfit/[id]', params: { id: saved.id } });
    else router.push({ pathname: '/outfit/[id]', params: { id: 'new', items: card.itemIds.join(',') } });
  };

  // ---------------------------------------------------- wear it again --
  // Not a piece the cards already lead with (their first looks, so it stays put while shuffling).
  const firstLooks = (shown?.shown ?? []).map((keys) => keys[0] ?? '').join('|');
  const again = useMemo(() => wearItAgain(input, new Set(firstLooks.split('|'))), [input, firstLooks]);
  const againItem = again ? byId.get(again.item.id) : undefined;
  const tomorrowPlan = plans.get(tomorrow);
  const tomorrowOutfit = tomorrowPlan ? outfits.find((o) => o.id === tomorrowPlan.outfitId) : undefined;
  const againPlanned =
    !!again &&
    !!tomorrowOutfit &&
    samePieces(
      tomorrowOutfit.pieces.map((p) => p.itemId),
      again.outfit.itemIds,
    );
  const [againLook, setAgainLook] = useState<PlannedLook | null>(null);
  const toggleAgain = () => {
    if (!again) return;
    if (againPlanned && tomorrowPlan) {
      unplanLook(againLook ?? { outfitId: tomorrowPlan.outfitId, created: false }, tomorrow);
      setAgainLook(null);
      haptics.tap();
      toast('Taken off tomorrow', 'info');
      return;
    }
    const look = planLook(again.outfit.itemIds, tomorrow);
    setAgainLook(look);
    haptics.dropSuccess();
    const when = tomorrowDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    toast(`${again.item.name} planned for ${when}${look.replaced ? `, instead of ${look.replaced}` : ''}`);
  };

  const openForgotten = () => {
    const view = useWardrobeView.getState();
    view.clearAll();
    view.setSort('least');
    view.setMode('grid');
    router.navigate('/wardrobe');
  };

  const trip = trips[0];

  return (
    <Screen className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <Text variant="display3" italic tone="muted" style={{ fontSize: 20, lineHeight: 24 }}>
          {formatLongDay(now)}
        </Text>
        <View className="flex-row gap-2">
          {__DEV__ ? (
            <IconButton
              icon={Thermometer}
              accessibilityLabel="Weather override (development)"
              onPress={() => devSheet.current?.present()}
            />
          ) : null}
          <IconButton
            icon={isDark ? Sun : Moon}
            accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={() => setPreference(isDark ? 'light' : 'dark')}
          />
        </View>
      </View>
      <Text variant="display1" accessibilityRole="header" className="mt-2">
        {greetingFor(now)}.
      </Text>

      <View className="mt-5">
        <WeatherCard
          weather={weather}
          onChangePlace={() => placeSheet.current?.present()}
          onDevOverride={() => devSheet.current?.present()}
        />
      </View>

      <SectionHeader
        title="Today’s outfit"
        action={
          <AnimatedPressable
            accessibilityLabel="Plan week"
            onPress={() => router.navigate('/planner')}
            className="h-11 flex-row items-center gap-1"
          >
            <Text variant="bodySm" weight="semibold" tone="accent">
              Plan week
            </Text>
            <ChevronRight size={16} color={colors.accentText} strokeWidth={2} />
          </AnimatedPressable>
        }
      />
      {loaded && cards.length === 0 ? (
        <EmptyState
          title="Not enough to style yet"
          body="Add a top, some bottoms and shoes (or a dress) and outfits for the weather show up here."
          actionLabel="Add a piece"
          onAction={() => router.push('/add')}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          className="-mx-5"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 14, gap: CARD_GAP }}
        >
          {!loaded || !shown
            ? [0, 1].map((i) => <CardSkeleton key={i} />)
            : cards.map((card, i) => {
                const pieceItems = piecesFor(card, byId);
                const saved = card.plan ? null : savedOutfitFor(card, outfits);
                const name = card.plan?.name ?? saved?.name ?? suggestOutfitName(pieceItems);
                const s = card.suggestion;
                return (
                  <LookCardView
                    key={`${i}:${card.key}`}
                    pieces={lookPieces(pieceItems)}
                    eyebrow={card.plan ? 'Planned for today' : `Pick ${i + 1} of ${cards.length}`}
                    name={name}
                    meta={s ? suggestionMeta(s, temp) : `${pieceItems.length} pieces · planned`}
                    tags={s ? suggestionTags(s, temp) : ['Planned', ...(temp ? [`Fits ${temp}`] : [])]}
                    popKey={card.key}
                    worn={isWorn(card)}
                    onWear={() => wear(card)}
                    onUnwear={() => unwear(card)}
                    onShuffle={() => shuffle(i)}
                    onEdit={() => edit(card)}
                  />
                );
              })}
        </ScrollView>
      )}

      <View className="mt-2.5 flex-row gap-2.5">
        <Tile
          value={counts.laundry}
          label="In laundry"
          tint={colors.accentSecondarySoft}
          icon={<WashingMachine size={19} color={colors.accentSecondary} strokeWidth={1.8} />}
          onPress={() => router.push('/laundry')}
        />
        <Tile
          value={counts.lent}
          label="Lent out"
          tint={colors.accentSoft}
          icon={<Repeat2 size={19} color={colors.accentText} strokeWidth={1.8} />}
          onPress={() => router.push({ pathname: '/laundry', params: { tab: 'lent' } })}
        />
        <Tile
          value={forgotten}
          label="Forgotten"
          tint={colors.warningSoft}
          icon={<Clock size={19} color={colors.warning} strokeWidth={1.8} />}
          onPress={openForgotten}
        />
      </View>

      {againItem && again ? (
        <View className="mt-[22px]">
          <WearAgainCard
            item={againItem}
            pairs={again.outfit.itemIds.filter((id) => id !== againItem.id).flatMap((id) => byId.get(id) ?? [])}
            line={wearAgainLine(idleDays(againItem, now), !againItem.lastWornAt)}
            planned={againPlanned}
            plannedLabel={`Planned · ${tomorrowDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}`}
            onTogglePlan={toggleAgain}
            onOpenItem={(from) =>
              void openItem(
                { id: againItem.id, wardrobeId: againItem.wardrobeId, thumbUri: againItem.thumbUri },
                { from, browseIds: [againItem.id] },
              )
            }
          />
        </View>
      ) : null}

      {trip ? (
        <View className="mt-3">
          <TripCard
            trip={trip}
            today={now}
            onPress={() => router.navigate({ pathname: '/planner', params: { day: trip.startDate } })}
          />
        </View>
      ) : null}

      <WeatherPlaceSheet ref={placeSheet} />
      {__DEV__ ? <DevWeatherSheet ref={devSheet} /> : null}
    </Screen>
  );
}

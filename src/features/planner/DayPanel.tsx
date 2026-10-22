import { Image } from 'expo-image';
import { CalendarCheck, Luggage, PencilLine, WandSparkles } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, Cutout, EmptyState, PopIn, Text } from '@/components/ui';
import { BoardTag } from '@/features/outfits/BoardBadges';
import { suggestOutfitName } from '@/features/outfits/defaults';
import { lookPieces } from '@/features/outfits/look';
import { LookBoard } from '@/features/outfits/LookBoard';
import { OutfitThumb } from '@/features/outfits/OutfitThumb';
import type { OutfitSummary } from '@/features/outfits/useOutfits';
import { WeatherIcon } from '@/features/weather/WeatherIcon';
import type { WeatherIconName } from '@/features/weather/wmo';
import { formatLongDay } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

import { kindLabel, tripDayLabel, type DayKind } from './calendar';
import type { DayLog, TripSummary } from './usePlannerData';

const BOARD_H = 200;
const ARCH = { width: 118, height: 168 };

/** A past day as a journal page: the selfie (or the pieces), what it was, the note. */
function JournalCard({ log, onEdit }: { log: DayLog; onEdit: () => void }) {
  const { colors } = useTheme();
  const name = log.outfitName ?? suggestOutfitName(log.pieces);
  return (
    <View className="flex-row gap-3.5 rounded-[24px] border border-line bg-surface p-3">
      <View
        className="items-center justify-center overflow-hidden bg-surface-tinted-strong"
        style={{
          width: ARCH.width,
          height: ARCH.height,
          borderTopLeftRadius: 60,
          borderTopRightRadius: 60,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          borderWidth: 4,
          borderColor: colors.surface,
        }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          log.photoUri ? 'Mirror selfie' : `What was worn: ${log.pieces.map((p) => p.name).join(', ')}`
        }
      >
        {log.photoUri ? (
          <Image source={{ uri: log.photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <LookBoard pieces={lookPieces(log.pieces)} width={ARCH.width - 8} height={ARCH.height - 8} />
        )}
        {log.photoUri ? (
          <View className="absolute bottom-2 left-2 h-[22px] justify-center rounded-pill bg-inverse/60 px-2">
            <Text variant="caption" weight="bold" tone="onInverse" style={{ fontSize: 10 }}>
              Mirror selfie
            </Text>
          </View>
        ) : null}
      </View>
      <View className="min-w-0 flex-1 gap-1.5 pt-1">
        <Text variant="eyebrow" tone="success">
          Worn
        </Text>
        <Text variant="display3" numberOfLines={2} style={{ fontSize: 21, lineHeight: 23 }}>
          {name}
        </Text>
        {log.notes ? (
          <Text variant="bodySm" tone="muted" style={{ fontStyle: 'italic' }} numberOfLines={3}>
            “{log.notes}”
          </Text>
        ) : null}
        <View className="mt-auto flex-row flex-wrap gap-1">
          {log.pieces.map((p) => (
            <View
              key={p.id}
              className="items-center justify-center rounded-[10px] bg-surface-tinted"
              style={{ width: 34, height: 36 }}
              accessible
              accessibilityLabel={p.name}
            >
              <Cutout uri={p.thumbUri} width={26} height={28} shadow="none" />
            </View>
          ))}
        </View>
        <Button label="Edit log" icon={PencilLine} variant="secondary" size="sm" className="mt-1" onPress={onEdit} />
      </View>
    </View>
  );
}

/** A planned outfit's board with its name. */
function PlanBoard({ outfit, width }: { outfit: OutfitSummary; width: number }) {
  return (
    <View
      className="overflow-hidden rounded-[24px] bg-surface-tinted"
      style={{ height: BOARD_H }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${outfit.name}: ${outfit.pieces.map((p) => p.name).join(', ')}`}
    >
      <OutfitThumb outfit={outfit} width={width} height={BOARD_H} />
      <View className="absolute left-3 top-3" pointerEvents="none">
        <BoardTag label={outfit.name} />
      </View>
    </View>
  );
}

/**
 * The selected day (Planner.dc.html): what kind of day it is, its weather,
 * and what can be done with it. Planned days show the board; logged days the
 * journal; free days offer a suggestion or a pick.
 */
export function DayPanel({
  date,
  dayKey,
  isToday,
  kind,
  weather,
  trip,
  planned,
  log,
  width,
  onLog,
  onSwap,
  onClear,
  onSuggest,
  onPick,
  onEditLog,
  onLogOutfit,
}: {
  date: Date;
  dayKey: string;
  isToday: boolean;
  kind: DayKind;
  weather: { line: string; icon: WeatherIconName } | null;
  trip: TripSummary | null;
  planned: OutfitSummary | null;
  log: DayLog | null;
  width: number;
  onLog: () => void;
  onSwap: () => void;
  onClear: () => void;
  onSuggest: () => void;
  onPick: () => void;
  onEditLog: () => void;
  onLogOutfit: () => void;
}) {
  const { colors } = useTheme();
  const { label, tone } = kindLabel(kind, isToday);
  return (
    <View>
      <View className="flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text variant="eyebrow" tone={tone}>
            {label}
          </Text>
          <Text
            variant="display3"
            className="mt-1.5"
            style={{ fontSize: 26, lineHeight: 29 }}
            accessibilityRole="header"
          >
            {formatLongDay(date)}
          </Text>
        </View>
        {weather ? (
          <View className="h-7 flex-row items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5">
            <WeatherIcon name={weather.icon} size={15} color={colors.ink} />
            <Text variant="caption" weight="semibold" tone="ink" style={{ fontSize: 11 }}>
              {weather.line}
            </Text>
          </View>
        ) : null}
      </View>

      {trip ? (
        <View className="mt-3 h-11 flex-row items-center gap-2 rounded-[14px] bg-accent-secondary-soft px-3.5">
          <Luggage size={18} color={colors.accentSecondary} strokeWidth={1.8} />
          <Text variant="bodySm" weight="semibold" tone="accentSecondary" numberOfLines={1}>
            {trip.name} trip · {tripDayLabel(dayKey, trip)}
          </Text>
        </View>
      ) : null}

      <PopIn key={`${dayKey}:${kind}:${planned?.id ?? ''}:${log?.id ?? ''}`} from={0.7} style={{ marginTop: 14 }}>
        {kind === 'journal' && log ? (
          <JournalCard log={log} onEdit={onEditLog} />
        ) : planned ? (
          <View>
            <PlanBoard outfit={planned} width={width} />
            <View className="mt-3 flex-row gap-2">
              {kind === 'today' || kind === 'past' ? (
                <>
                  <Button label="Log as worn" icon={CalendarCheck} className="flex-1" onPress={onLog} />
                  <Button
                    label={kind === 'past' ? 'Clear' : 'Swap'}
                    variant="secondary"
                    onPress={kind === 'past' ? onClear : onSwap}
                  />
                </>
              ) : (
                <>
                  <Button label="Swap outfit" className="flex-1" onPress={onSwap} />
                  <Button label="Clear" variant="secondary" onPress={onClear} />
                </>
              )}
            </View>
          </View>
        ) : kind === 'past' ? (
          <View>
            <EmptyState
              outlined
              illustration="shelf"
              title="Nothing logged"
              body="Log what you wore that day and it joins your journal."
            />
            <Button label="Log an outfit" fullWidth className="mt-3" onPress={onLogOutfit} />
          </View>
        ) : (
          <View>
            <EmptyState
              outlined
              title="Nothing planned yet"
              body="Drag an outfit from below onto any day, or let us pick one for the weather."
            />
            <View className="mt-3 flex-row gap-2">
              <Button label="Suggest one" icon={WandSparkles} className="flex-1" onPress={onSuggest} />
              <Button label="Pick an outfit" variant="secondary" className="flex-1" onPress={onPick} />
            </View>
          </View>
        )}
      </PopIn>
    </View>
  );
}

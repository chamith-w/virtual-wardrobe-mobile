import {
  ArrowLeftRight,
  Archive,
  Check,
  Layers,
  PencilLine,
  Shirt,
  SearchCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable, Button, Cutout, Text } from '@/components/ui';
import type { Item } from '@/db/schema';
import { changeItemStatus, toggleWearToday } from '@/features/items/actions';
import { LentCard } from '@/features/items/components/LentCard';
import { StatusSwitcher } from '@/features/items/components/StatusSwitcher';
import { detailRows, detailStats, itemByline, itemEyebrow } from '@/features/items/describe';
import { findMatches } from '@/features/items/matches';
import { OutfitPreview } from '@/features/outfits/OutfitPreview';
import { useItemOutfits } from '@/features/outfits/useOutfits';
import { useWornToday } from '@/features/planner/wearLog';
import { useAllItems, type ClosetItem } from '@/features/wardrobe/useWardrobeData';
import { useMotionReduced } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, springs } from '@/theme/tokens';

export type DetailBodyProps = {
  item: Item;
  showMatches: boolean;
  onToggleMatches: () => void;
  onAddToOutfit: () => void;
  onEdit: () => void;
  onMove: () => void;
  onArchive: () => void;
  onOpenItem: (item: ClosetItem) => void;
  onOpenOutfit: (outfitId: string) => void;
};

/** Prototype `.pop`: 0.6 → ~1.06 → 1, used for sections that appear on demand. */
function PopIn({ index = 0, children }: { index?: number; children: ReactNode }) {
  const reduced = useMotionReduced();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(
      reduced
        ? withTiming(1, { duration: durations.reducedFade })
        : withDelay(index * 50, withSpring(1, springs.bouncy)),
    );
  }, [index, reduced, shown]);
  const style = useAnimatedStyle(() => {
    const p = shown.get();
    if (reduced) return { opacity: p };
    return { opacity: Math.min(1, p * 1.5), transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

function StatTile({ value, label, large }: { value: string; label: string; large: boolean }) {
  return (
    <View
      className="flex-1 gap-1 rounded-[18px] bg-surface-tinted px-3.5 py-3"
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text
        variant="display3"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={large ? { fontSize: 30, lineHeight: 33 } : { fontSize: 22, lineHeight: 26 }}
      >
        {value}
      </Text>
      <Text variant="caption" weight="semibold">
        {label}
      </Text>
    </View>
  );
}

function ActionTile({
  icon: Icon,
  label,
  hint,
  onPress,
  danger = false,
  expanded,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  expanded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      scaleTo={0.96}
      className={[
        'min-h-14 flex-1 flex-row items-center gap-2.5 rounded-[18px] px-3.5',
        danger ? 'bg-danger-soft' : 'bg-surface-tinted',
      ].join(' ')}
    >
      <Icon size={19} color={danger ? colors.danger : colors.ink} strokeWidth={1.8} />
      <Text
        variant="body"
        weight="semibold"
        tone={danger ? 'danger' : 'ink'}
        style={{ fontSize: 15 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

function ColourRow({ colors: swatches }: { colors: Item['colors'] }) {
  if (swatches.length === 0) return null;
  return (
    <View
      className="mt-3.5 flex-row flex-wrap gap-3.5"
      accessible
      accessibilityLabel={`Colours: ${swatches.map((c) => c.name).join(', ')}`}
    >
      {swatches.map((c) => (
        <View key={c.name} className="flex-row items-center gap-1.5">
          <View
            className="h-[18px] w-[18px] rounded-pill border border-line-strong"
            style={{ backgroundColor: c.hex }}
          />
          <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
            {c.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "Pairs well with": complementary pieces from every wardrobe, best first. */
function Matches({ item, onOpenItem }: { item: Item; onOpenItem: (item: ClosetItem) => void }) {
  const { data: all, loaded } = useAllItems();
  const matches = findMatches(item, all, 8);
  return (
    <PopIn>
      <Text variant="eyebrow" className="mb-2.5 mt-6">
        Pairs well with
      </Text>
      {loaded && matches.length === 0 ? (
        <Text variant="bodySm" tone="muted">
          Nothing pairs well yet. Add a few more pieces and look again.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5"
          contentContainerClassName="gap-2.5 px-5 pb-1"
        >
          {matches.map((m, i) => (
            <PopIn key={m.item.id} index={i}>
              <AnimatedPressable
                accessibilityLabel={`${m.item.name}. ${m.reason}`}
                accessibilityHint="Opens this piece"
                onPress={() => onOpenItem(m.item)}
                scaleTo={0.96}
                style={{ width: 112 }}
              >
                <View className="h-[120px] items-center justify-center rounded-[18px] bg-surface-tinted">
                  <Cutout uri={m.item.thumbUri} width={84} height={92} />
                </View>
                <Text variant="bodySm" weight="semibold" numberOfLines={1} className="mt-2">
                  {m.item.name}
                </Text>
                <Text variant="caption" numberOfLines={1} className="mt-0.5">
                  {m.reason}
                </Text>
              </AnimatedPressable>
            </PopIn>
          ))}
        </ScrollView>
      )}
    </PopIn>
  );
}

/** The saved outfits that include this piece, as little boards. */
function InOutfits({
  itemId,
  onOpenOutfit,
  onAddToOutfit,
}: {
  itemId: string;
  onOpenOutfit: (id: string) => void;
  onAddToOutfit: () => void;
}) {
  const { colors } = useTheme();
  const { outfits, loaded } = useItemOutfits(itemId);
  if (!loaded) return null;
  const n = outfits.length;
  return (
    <View>
      <Text variant="eyebrow" className="mb-2.5 mt-7">
        {n === 0 ? 'Outfits' : `In ${n} ${n === 1 ? 'outfit' : 'outfits'}`}
      </Text>
      {n === 0 ? (
        <AnimatedPressable
          accessibilityLabel="Not in any outfit yet. Add to outfit"
          onPress={onAddToOutfit}
          scaleTo={0.98}
          className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-line-strong px-4 py-3.5"
        >
          <Layers size={20} strokeWidth={1.7} color={colors.faint} />
          <View className="flex-1">
            <Text variant="bodySm" weight="semibold">
              Not in any outfit yet
            </Text>
            <Text variant="caption">Add it to one, or start a new board around it.</Text>
          </View>
        </AnimatedPressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5"
          contentContainerClassName="gap-2.5 px-5 pb-1"
        >
          {outfits.map((o) => (
            <AnimatedPressable
              key={o.id}
              accessibilityLabel={`${o.name}, ${o.pieces.length} pieces`}
              accessibilityHint="Opens the outfit"
              onPress={() => onOpenOutfit(o.id)}
              scaleTo={0.96}
              style={{ width: 136 }}
            >
              <OutfitPreview pieces={o.pieces} width={136} height={150} />
              <Text variant="bodySm" weight="semibold" numberOfLines={1} className="mt-2">
                {o.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Everything below the cutout on item detail (ItemDetail.dc.html): name and
 * colours, the four stats, status, actions, matches, outfits and details.
 */
export function DetailBody({
  item,
  showMatches,
  onToggleMatches,
  onAddToOutfit,
  onEdit,
  onMove,
  onArchive,
  onOpenItem,
  onOpenOutfit,
}: DetailBodyProps) {
  const wornToday = useWornToday(item.id);
  const stats = detailStats(item);
  const byline = itemByline(item);
  const rows = detailRows(item);

  return (
    <View>
      <Text variant="eyebrow">{itemEyebrow(item)}</Text>
      <Text variant="display2" accessibilityRole="header" className="mt-1.5">
        {item.name}
      </Text>
      {byline ? (
        <Text variant="bodySm" tone="muted" className="mt-1.5">
          {byline}
        </Text>
      ) : null}
      <ColourRow colors={item.colors} />

      <View className="mt-5 gap-2.5">
        <View className="flex-row gap-2.5">
          <StatTile value={stats.timesWorn} label="Times worn" large />
          <StatTile value={stats.costPerWear} label="Cost per wear" large />
        </View>
        <View className="flex-row gap-2.5">
          <StatTile value={stats.lastWorn} label="Last worn" large={false} />
          <StatTile value={stats.sinceAdded} label="Since added" large={false} />
        </View>
      </View>

      <Text variant="eyebrow" className="mb-2.5 mt-7">
        Status
      </Text>
      <StatusSwitcher status={item.status} onChange={(s) => changeItemStatus(item, s)} />
      {item.status === 'lent' ? (
        <PopIn>
          <LentCard key={item.id} item={item} />
        </PopIn>
      ) : null}

      <Button
        label={wornToday ? 'Worn today' : 'Wear today'}
        icon={wornToday ? Check : Shirt}
        fullWidth
        className="mt-6"
        accessibilityHint={wornToday ? 'Takes it off today’s log' : 'Logs it as worn today'}
        onPress={() => toggleWearToday(item, wornToday)}
      />
      <View className="mt-2 gap-2">
        <View className="flex-row gap-2">
          <ActionTile icon={Layers} label="Add to outfit" onPress={onAddToOutfit} />
          <ActionTile
            icon={SearchCheck}
            label="Find matches"
            hint={showMatches ? 'Hides the matches' : 'Shows pieces that pair well with this one'}
            expanded={showMatches}
            onPress={onToggleMatches}
          />
        </View>
        <View className="flex-row gap-2">
          <ActionTile icon={PencilLine} label="Edit" onPress={onEdit} />
          <ActionTile icon={ArrowLeftRight} label="Move" hint="Moves it to another wardrobe" onPress={onMove} />
        </View>
        <ActionTile icon={Archive} label="Archive · donated, sold or discarded" danger onPress={onArchive} />
      </View>

      {showMatches ? <Matches key={item.id} item={item} onOpenItem={onOpenItem} /> : null}

      <InOutfits itemId={item.id} onOpenOutfit={onOpenOutfit} onAddToOutfit={onAddToOutfit} />

      <Text variant="eyebrow" className="mb-1 mt-7">
        Details
      </Text>
      {rows.map((r, i) => (
        <View
          key={r.label}
          className={[
            'flex-row justify-between gap-4 py-[13px]',
            i < rows.length - 1 ? 'border-b border-line' : '',
          ].join(' ')}
          accessible
          accessibilityLabel={`${r.label}: ${r.value}`}
        >
          <Text variant="bodySm" tone="muted">
            {r.label}
          </Text>
          <Text variant="bodySm" weight="semibold" className="flex-1 text-right">
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

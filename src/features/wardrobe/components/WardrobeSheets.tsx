import type { ReactNode, Ref, RefObject } from 'react';
import { View } from 'react-native';

import { AnimatedPressable, Button, CheckBadge, Chip, Sheet, Swatch, Text, type SheetRef } from '@/components/ui';
import type { Wardrobe, Zone } from '@/db/schema';
import {
  GROUP_LABEL,
  OCCASION_LABEL,
  OCCASIONS,
  SEASON_LABEL,
  SEASONS,
  STATUS_LABEL,
} from '@/features/items/catalog';
import { isStorageWardrobe } from '@/features/items/placement';
import { STATUS_TONE } from '@/features/items/status';
import { SORT_OPTIONS, toggleIn, type Facets } from '@/features/wardrobe/filters';
import { useWardrobeView } from '@/store/wardrobeView';
import { useTheme } from '@/theme/ThemeProvider';

import { wardrobeIcon } from './WardrobeHeader';

// --------------------------------------------------------------- wardrobes --

/** Choose which wardrobe the tab shows (Home, Storage…). */
export function WardrobeSheet({
  ref,
  wardrobes,
  zones,
  counts,
  activeId,
  onPick,
}: {
  ref: Ref<SheetRef>;
  wardrobes: Wardrobe[];
  zones: Zone[];
  counts: Record<string, number>;
  activeId: string | undefined;
  onPick: (wardrobe: Wardrobe) => void;
}) {
  const { colors } = useTheme();
  return (
    <Sheet ref={ref} title="Wardrobes">
      {wardrobes.map((w, i) => {
        const Icon = wardrobeIcon(w.icon);
        const n = counts[w.id] ?? 0;
        const drawers = zones.filter((z) => z.wardrobeId === w.id && z.type === 'drawer').length;
        const hint = isStorageWardrobe(w)
          ? `${n} ${n === 1 ? 'piece' : 'pieces'} · off-season`
          : `${n} ${n === 1 ? 'piece' : 'pieces'}${drawers ? ` · ${drawers} drawers` : ''}`;
        const on = w.id === activeId;
        return (
          <AnimatedPressable
            key={w.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${w.name}, ${hint}`}
            onPress={() => onPick(w)}
            scaleTo={0.98}
            className={[
              'min-h-[68px] flex-row items-center gap-3.5 py-2.5',
              i < wardrobes.length - 1 ? 'border-b border-line' : '',
            ].join(' ')}
          >
            <View className="h-[46px] w-[46px] items-center justify-center rounded-[16px] bg-surface-tinted">
              <Icon size={22} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="semibold">
                {w.name}
              </Text>
              <Text variant="caption">{hint}</Text>
            </View>
            {on ? <CheckBadge /> : null}
          </AnimatedPressable>
        );
      })}
    </Sheet>
  );
}

// ------------------------------------------------------------------- sort --

export function SortSheet({ ref }: { ref: RefObject<SheetRef | null> }) {
  const sort = useWardrobeView((s) => s.sort);
  const setSort = useWardrobeView((s) => s.setSort);
  const dismiss = () => ref.current?.dismiss();
  return (
    <Sheet ref={ref} title="Sort by">
      {SORT_OPTIONS.map((o, i) => {
        const on = o.key === sort;
        return (
          <AnimatedPressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.label}. ${o.hint}`}
            onPress={() => {
              setSort(o.key);
              dismiss();
            }}
            scaleTo={0.98}
            className={[
              'min-h-[58px] flex-row items-center justify-between gap-3 py-2',
              i < SORT_OPTIONS.length - 1 ? 'border-b border-line' : '',
            ].join(' ')}
          >
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="medium">
                {o.label}
              </Text>
              <Text variant="caption">{o.hint}</Text>
            </View>
            {on ? <CheckBadge /> : null}
          </AnimatedPressable>
        );
      })}
    </Sheet>
  );
}

// ---------------------------------------------------------------- filters --

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5">
      <Text variant="eyebrow" className="mb-2.5">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

/** Every filter: category, colour, season, occasion, status and brand. Changes apply live. */
export function FilterSheet({
  ref,
  facets,
  matching,
}: {
  ref: RefObject<SheetRef | null>;
  facets: Facets;
  matching: number;
}) {
  const { colors } = useTheme();
  const filters = useWardrobeView((s) => s.filters);
  const setFilters = useWardrobeView((s) => s.setFilters);
  const clearFilters = useWardrobeView((s) => s.clearFilters);
  const count = (list: { value: string; count: number }[], value: string) =>
    list.find((f) => f.value === value)?.count;
  const dismiss = () => ref.current?.dismiss();

  return (
    <Sheet ref={ref} title="Filters" snapPoints={['86%']} scrollable>
      <Section title="Category">
        {facets.groups.map((g) => (
          <Chip
            key={g.value}
            label={GROUP_LABEL[g.value]}
            count={g.count}
            selected={filters.groups.includes(g.value)}
            onPress={() => setFilters((f) => ({ ...f, groups: toggleIn(f.groups, g.value) }))}
          />
        ))}
      </Section>

      {facets.colors.length > 0 ? (
        <View className="mt-5">
          <Text variant="eyebrow" className="mb-2.5">
            Colour
          </Text>
          <View className="flex-row flex-wrap gap-x-2 gap-y-3">
            {facets.colors.map((c) => (
              <Swatch
                key={c.value}
                hex={c.hex}
                name={c.value}
                size={26}
                showLabel
                selected={filters.colors.includes(c.value)}
                onPress={() => setFilters((f) => ({ ...f, colors: toggleIn(f.colors, c.value) }))}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Section title="Season">
        {SEASONS.map((s) => (
          <Chip
            key={s}
            label={SEASON_LABEL[s]}
            count={count(facets.seasons, s)}
            selected={filters.seasons.includes(s)}
            onPress={() => setFilters((f) => ({ ...f, seasons: toggleIn(f.seasons, s) }))}
          />
        ))}
      </Section>

      <Section title="Occasion">
        {OCCASIONS.map((o) => (
          <Chip
            key={o}
            label={OCCASION_LABEL[o]}
            count={count(facets.occasions, o)}
            selected={filters.occasions.includes(o)}
            onPress={() => setFilters((f) => ({ ...f, occasions: toggleIn(f.occasions, o) }))}
          />
        ))}
      </Section>

      <Section title="Status">
        {facets.statuses.map((s) => (
          <Chip
            key={s.value}
            label={STATUS_LABEL[s.value]}
            dotColor={colors[STATUS_TONE[s.value]]}
            count={s.count}
            selected={filters.statuses.includes(s.value)}
            onPress={() => setFilters((f) => ({ ...f, statuses: toggleIn(f.statuses, s.value) }))}
          />
        ))}
      </Section>

      {facets.brands.length > 0 ? (
        <Section title="Brand">
          {facets.brands.map((b) => (
            <Chip
              key={b.value}
              label={b.value}
              count={b.count}
              selected={filters.brands.includes(b.value)}
              onPress={() => setFilters((f) => ({ ...f, brands: toggleIn(f.brands, b.value) }))}
            />
          ))}
        </Section>
      ) : null}

      <View className="mt-7 flex-row gap-2.5">
        <Button label="Clear all" variant="secondary" onPress={clearFilters} />
        <Button
          label={matching === 1 ? 'Show 1 piece' : `Show ${matching} pieces`}
          className="flex-1"
          onPress={dismiss}
        />
      </View>
    </Sheet>
  );
}

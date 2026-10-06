import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Plus, Settings2 } from 'lucide-react-native';
import { useState, type ReactNode, type Ref, type RefObject } from 'react';
import { View } from 'react-native';

import { AnimatedPressable, Button, CheckBadge, Chip, Sheet, Swatch, Text, type SheetRef } from '@/components/ui';
import type { Wardrobe, Zone } from '@/db/schema';
import { GROUP_LABEL, OCCASION_LABEL, OCCASIONS, SEASON_LABEL, SEASONS, STATUS_LABEL } from '@/features/items/catalog';
import { isStorageWardrobe } from '@/features/items/placement';
import { STATUS_TONE } from '@/features/items/status';
import { SORT_OPTIONS, toggleIn, type Facets } from '@/features/wardrobe/filters';
import { createWardrobe } from '@/features/wardrobe/mutations';
import {
  planWardrobe,
  WARDROBE_KIND_ICON,
  WARDROBE_NAME_MAX,
  wardrobeNameProblem,
  type WardrobeKind,
} from '@/features/wardrobe/wardrobes';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useWardrobeView } from '@/store/wardrobeView';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

import { WardrobeIcon } from './WardrobeHeader';

// --------------------------------------------------------------- wardrobes --

/** Choose which wardrobe the tab shows (Home, Storage…), or start a new one. */
export function WardrobeSheet({
  ref,
  wardrobes,
  zones,
  counts,
  activeId,
  onPick,
  onNew,
  onManage,
}: {
  ref: Ref<SheetRef>;
  wardrobes: Wardrobe[];
  zones: Zone[];
  counts: Record<string, number>;
  activeId: string | undefined;
  onPick: (wardrobe: Wardrobe) => void;
  onNew: () => void;
  onManage: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Sheet ref={ref} title="Wardrobes">
      {wardrobes.map((w, i) => {
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
              <WardrobeIcon icon={w.icon} size={22} color={colors.ink} />
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
      <AnimatedPressable
        accessibilityLabel="New wardrobe"
        accessibilityHint="Adds another place you keep clothes"
        onPress={onNew}
        scaleTo={0.98}
        className="mt-1 min-h-[68px] flex-row items-center gap-3.5 border-t border-line py-2.5"
      >
        <View className="h-[46px] w-[46px] items-center justify-center rounded-[16px] border-[1.5px] border-dashed border-line-strong">
          <Plus size={20} color={colors.ink} strokeWidth={1.9} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="semibold">
            New wardrobe
          </Text>
          <Text variant="caption">A second home, a holiday place, a storage box</Text>
        </View>
      </AnimatedPressable>
      <Button
        label="Rename, reorder or delete"
        variant="ghost"
        size="sm"
        icon={Settings2}
        className="mt-1 self-center"
        onPress={onManage}
      />
    </Sheet>
  );
}

const KINDS: { value: WardrobeKind; label: string; hint: string }[] = [
  { value: 'wardrobe', label: 'Wardrobe', hint: 'Rail, shelves, drawers, shoes and a tray' },
  { value: 'storage', label: 'Storage', hint: 'Off-season: pieces here count as stored' },
];

/** Wardrobe or Storage, as two large radio rows. A kind that can't be chosen is dimmed. */
export function KindPicker({
  value,
  onChange,
  disabledKind,
}: {
  value: WardrobeKind;
  onChange: (kind: WardrobeKind) => void;
  disabledKind?: WardrobeKind | null;
}) {
  const { colors } = useTheme();
  return (
    <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Kind">
      {KINDS.map((k) => {
        const on = k.value === value;
        const disabled = disabledKind === k.value;
        return (
          <AnimatedPressable
            key={k.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={`${k.label}. ${k.hint}`}
            disabled={disabled}
            onPress={() => onChange(k.value)}
            scaleTo={0.98}
            className={[
              'min-h-[64px] flex-row items-center gap-3.5 rounded-md px-3.5 py-2.5',
              on ? 'border-[1.5px] border-ink bg-surface' : 'border border-line bg-surface-tinted',
              disabled ? 'opacity-40' : '',
            ].join(' ')}
          >
            <WardrobeIcon icon={WARDROBE_KIND_ICON[k.value]} size={20} color={colors.ink} />
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="semibold">
                {k.label}
              </Text>
              <Text variant="caption">{k.hint}</Text>
            </View>
            {on ? <CheckBadge /> : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

/** Name a new wardrobe and choose whether it's a wardrobe or storage. */
export function NewWardrobeSheet({
  ref,
  wardrobes,
  onCreated,
}: {
  ref: RefObject<SheetRef | null>;
  wardrobes: Wardrobe[];
  onCreated: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WardrobeKind>('wardrobe');
  const [touched, setTouched] = useState(false);
  const problem = wardrobeNameProblem(name, wardrobes);

  const create = () => {
    setTouched(true);
    const plan = planWardrobe(name, kind, wardrobes);
    if (!plan) {
      haptics.warning();
      return;
    }
    const id = createWardrobe(plan);
    haptics.itemAdded();
    toast(`${plan.wardrobe.name} is ready`);
    ref.current?.dismiss();
    onCreated(id);
  };

  return (
    <Sheet
      ref={ref}
      title="New wardrobe"
      onDismiss={() => {
        setName('');
        setKind('wardrobe');
        setTouched(false);
      }}
    >
      <Text variant="eyebrow" className="mb-2">
        Name
      </Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        onSubmitEditing={create}
        placeholder="Parents’ place"
        placeholderTextColor={colors.muted}
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
      <KindPicker value={kind} onChange={setKind} />
      <Button label="Create wardrobe" fullWidth className="mt-6" onPress={create} />
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
  const count = (list: { value: string; count: number }[], value: string) => list.find((f) => f.value === value)?.count;
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

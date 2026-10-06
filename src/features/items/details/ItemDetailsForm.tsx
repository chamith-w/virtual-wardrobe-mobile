import { ChevronRight, Plus, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View, type TextInputProps } from 'react-native';

import { AnimatedPressable, Chip, Cutout, Swatch, Text } from '@/components/ui';
import type { ItemColor } from '@/db/schema';
import {
  CATEGORIES,
  CATEGORY_GROUP,
  CATEGORY_LABEL,
  GROUP_LABEL,
  OCCASION_LABEL,
  OCCASIONS,
  SEASON_LABEL,
  SEASONS,
} from '@/features/items/catalog';
import { toggleIn } from '@/features/wardrobe/filters';
import { FASHION_PALETTE } from '@/lib/color';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/tokens';

import {
  addTags,
  isFutureMonth,
  MAX_COLORS,
  materialHas,
  NAME_MAX,
  purchaseYears,
  suggestBrands,
  toggleColor,
  toggleMaterial,
  withSuggestedName,
  type DraftErrors,
  type ItemDraft,
} from './draft';
import { CURRENCIES, MATERIALS, PATTERNS, sizeOptions, SUBCATEGORIES } from './options';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="mt-6">
      <View className="mb-2.5 flex-row items-baseline justify-between">
        <Text variant="eyebrow">{title}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}

function Field({
  label,
  error,
  trailing,
  style,
  ...input
}: TextInputProps & { label: string; error?: string; trailing?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View className="flex-1 gap-2">
      <Text variant="eyebrow">{label}</Text>
      <View
        className="flex-row items-center rounded-[14px] bg-surface-tinted"
        style={error ? { borderWidth: 1.5, borderColor: colors.danger } : undefined}
      >
        <TextInput
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          accessibilityLabel={label}
          maxFontSizeMultiplier={1.5}
          style={[
            {
              flex: 1,
              minHeight: 48,
              paddingHorizontal: 14,
              fontFamily: fontFamily.sansMedium,
              fontSize: 15,
              color: colors.ink,
            },
            style,
          ]}
          {...input}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Year chips, then month chips (future months are off): "Aug 2025", or "Not sure". */
function MonthPicker({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  const now = new Date();
  const [year, setYear] = useState(() => (value ? Number(value.slice(0, 4)) : now.getFullYear()));
  const month = value && Number(value.slice(0, 4)) === year ? Number(value.slice(5, 7)) : null;
  return (
    <View className="gap-2.5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5"
        contentContainerClassName="gap-2 px-5"
      >
        <Chip label="Not sure" selected={value === null} onPress={() => onChange(null)} />
        {purchaseYears(now).map((y) => (
          <Chip key={y} label={String(y)} selected={value !== null && y === year} onPress={() => setYear(y)} />
        ))}
      </ScrollView>
      <View className="flex-row flex-wrap gap-2">
        {MONTHS.map((label, i) => {
          const m = i + 1;
          const future = isFutureMonth(year, m, now);
          return (
            <Chip
              key={label}
              label={label}
              selected={month === m}
              disabled={future}
              className={['min-w-[22%] justify-center', future ? 'opacity-30' : ''].join(' ')}
              accessibilityLabel={`${label} ${year}`}
              onPress={() => onChange(`${year}-${String(m).padStart(2, '0')}`)}
            />
          );
        })}
      </View>
    </View>
  );
}

export type ItemDetailsFormProps = {
  draft: ItemDraft;
  onChange: (draft: ItemDraft) => void;
  /** Shown once the user has tried to save. */
  errors: DraftErrors;
  previewUri: string | null;
  /** Colours found in the cutout, offered first. */
  detected?: ItemColor[];
  /** Brands and tags already used in the wardrobe, for suggestions. */
  brands: string[];
  knownTags: string[];
};

/**
 * The details form (AddItem.dc.html, details): mostly chips so it's quick to
 * fill. Used by the add flow and by Edit on item detail.
 */
export function ItemDetailsForm({
  draft,
  onChange,
  errors,
  previewUri,
  detected = [],
  brands,
  knownTags,
}: ItemDetailsFormProps) {
  const { colors } = useTheme();
  const [tagText, setTagText] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const set = (patch: Partial<ItemDraft>) => onChange(withSuggestedName({ ...draft, ...patch }));

  const subOptions = draft.category ? SUBCATEGORIES[draft.category] : [];
  const subs =
    draft.subcategory && !subOptions.includes(draft.subcategory) ? [draft.subcategory, ...subOptions] : subOptions;
  const sizes = sizeOptions(draft.category);
  const brandHints = suggestBrands(draft.brand, brands, 4);
  const tagHints = knownTags.filter((t) => !draft.tags.includes(t)).slice(0, 6);
  const detectedNames = new Set(detected.map((c) => c.name));
  const palette = [
    ...FASHION_PALETTE.filter((c) => detectedNames.has(c.name)),
    ...FASHION_PALETTE.filter((c) => !detectedNames.has(c.name)),
  ];

  return (
    <View>
      <View className="flex-row items-center gap-4">
        <View className="h-[136px] w-[112px] items-center justify-center rounded-[22px] bg-surface-tinted">
          <Cutout uri={previewUri} width={88} height={112} />
        </View>
        <View className="flex-1 gap-2">
          <Text variant="eyebrow">Name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => onChange({ ...draft, name, nameEdited: true })}
            placeholder="Camel wool coat"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            maxLength={NAME_MAX}
            accessibilityLabel="Name"
            maxFontSizeMultiplier={1.3}
            style={{
              fontFamily: fontFamily.display,
              fontSize: 26,
              lineHeight: 30,
              letterSpacing: -0.5,
              color: colors.ink,
              paddingVertical: 4,
              borderBottomWidth: 1.5,
              borderBottomColor: errors.name ? colors.danger : colors.surfaceTintedStrong,
            }}
          />
          {errors.name ? (
            <Text variant="caption" tone="danger">
              {errors.name}
            </Text>
          ) : null}
          <View className="flex-row items-center gap-1">
            {draft.category ? (
              <>
                <Text variant="bodySm" tone="muted" weight="semibold" style={{ fontSize: 13 }}>
                  {GROUP_LABEL[CATEGORY_GROUP[draft.category]]}
                </Text>
                <ChevronRight size={13} color={colors.muted} strokeWidth={2} />
                <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
                  {draft.subcategory || CATEGORY_LABEL[draft.category]}
                </Text>
              </>
            ) : (
              <Text
                variant="bodySm"
                tone={errors.category ? 'danger' : 'muted'}
                weight="semibold"
                style={{ fontSize: 13 }}
              >
                {errors.category ?? 'No category yet'}
              </Text>
            )}
          </View>
        </View>
      </View>

      <Section title="Category">
        <Wrap>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={CATEGORY_LABEL[c]}
              selected={draft.category === c}
              onPress={() => set({ category: c, subcategory: draft.category === c ? draft.subcategory : '' })}
            />
          ))}
        </Wrap>
      </Section>

      {subs.length > 0 ? (
        <Section title="Kind">
          <Wrap>
            {subs.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={draft.subcategory === s}
                onPress={() => set({ subcategory: draft.subcategory === s ? '' : s })}
              />
            ))}
          </Wrap>
        </Section>
      ) : null}

      <Section title="Colours" hint={`Up to ${MAX_COLORS}${detected.length > 0 ? ' · detected first' : ''}`}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5"
          contentContainerClassName="gap-1 px-4"
        >
          {palette.map((c) => {
            const on = draft.colors.some((x) => x.name === c.name);
            return (
              <Swatch
                key={c.name}
                hex={c.hex}
                name={c.name}
                size={26}
                showLabel
                selected={on}
                onPress={() => set({ colors: toggleColor(draft.colors, { name: c.name, hex: c.hex }) })}
              />
            );
          })}
        </ScrollView>
      </Section>

      <Section title="Pattern">
        <Wrap>
          {PATTERNS.map((p) => (
            <Chip
              key={p}
              label={p}
              selected={draft.pattern === p}
              onPress={() => set({ pattern: draft.pattern === p ? null : p })}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="Material">
        <Wrap>
          {MATERIALS.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={materialHas(draft.material, m)}
              onPress={() => set({ material: toggleMaterial(draft.material, m) })}
            />
          ))}
        </Wrap>
        <View className="mt-2.5 flex-row">
          <Field
            label="Composition · optional"
            value={draft.material}
            onChangeText={(material) => set({ material })}
            placeholder="80% wool, 20% cashmere"
            autoCapitalize="none"
          />
        </View>
      </Section>

      <Section title="Seasons" hint={draft.seasons.length === 0 ? 'None picked means all year' : undefined}>
        <Wrap>
          {SEASONS.map((s) => (
            <Chip
              key={s}
              label={SEASON_LABEL[s]}
              selected={draft.seasons.includes(s)}
              onPress={() => set({ seasons: toggleIn(draft.seasons, s) })}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="Occasions">
        <Wrap>
          {OCCASIONS.map((o) => (
            <Chip
              key={o}
              label={OCCASION_LABEL[o]}
              selected={draft.occasions.includes(o)}
              onPress={() => set({ occasions: toggleIn(draft.occasions, o) })}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="Size">
        <Wrap>
          {sizes.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={draft.size === s}
              onPress={() => set({ size: draft.size === s ? '' : s })}
            />
          ))}
        </Wrap>
        <View className="mt-2.5 flex-row">
          <Field
            label="Another size"
            value={sizes.includes(draft.size) ? '' : draft.size}
            onChangeText={(size) => set({ size })}
            placeholder="EU 38, 30/32…"
            maxLength={16}
          />
        </View>
      </Section>

      <View className="mt-6 flex-row gap-2.5">
        <Field
          label="Brand"
          value={draft.brand}
          onChangeText={(brand) => set({ brand })}
          placeholder="Maison Lune"
          autoCapitalize="words"
          maxLength={40}
        />
        <Field
          label="Price"
          value={draft.price}
          onChangeText={(price) => set({ price })}
          placeholder="0"
          keyboardType="decimal-pad"
          error={errors.price}
          trailing={
            <AnimatedPressable
              accessibilityLabel={`Currency, ${draft.currency}`}
              accessibilityHint="Changes the currency"
              onPress={() => setCurrencyOpen((o) => !o)}
              className="mr-1.5 h-9 justify-center rounded-pill bg-surface px-2.5"
            >
              <Text variant="caption" weight="bold" tone="ink">
                {draft.currency}
              </Text>
            </AnimatedPressable>
          }
        />
      </View>
      {brandHints.length > 0 && draft.brand.trim() !== '' ? (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {brandHints.map((b) => (
            <Chip key={b} label={b} onPress={() => set({ brand: b })} />
          ))}
        </View>
      ) : null}
      {currencyOpen ? (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {CURRENCIES.map((cur) => (
            <Chip
              key={cur}
              label={cur}
              selected={draft.currency === cur}
              onPress={() => {
                set({ currency: cur });
                setCurrencyOpen(false);
              }}
            />
          ))}
        </View>
      ) : null}

      <Section title="Purchased">
        <MonthPicker value={draft.purchased} onChange={(purchased) => set({ purchased })} />
      </Section>

      <View className="mt-6 flex-row">
        <Field
          label="Store"
          value={draft.store}
          onChangeText={(store) => set({ store })}
          placeholder="Online"
          maxLength={40}
        />
      </View>

      <View className="mt-6 flex-row">
        <Field
          label="Care notes"
          value={draft.careNotes}
          onChangeText={(careNotes) => set({ careNotes })}
          placeholder="Dry clean only. Steam, don’t iron."
          multiline
          maxLength={400}
          style={{ minHeight: 84, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' }}
        />
      </View>

      <Section title="Tags">
        <Wrap>
          {draft.tags.map((t) => (
            <Chip
              key={t}
              label={t}
              selected
              icon={X}
              accessibilityLabel={`Remove tag ${t}`}
              onPress={() => set({ tags: draft.tags.filter((x) => x !== t) })}
            />
          ))}
          {tagHints.map((t) => (
            <Chip key={t} label={t} icon={Plus} onPress={() => set({ tags: addTags(draft.tags, t) })} />
          ))}
        </Wrap>
        <View className="mt-2.5 flex-row">
          <Field
            label="Add a tag"
            value={tagText}
            onChangeText={setTagText}
            placeholder="investment, winter staple"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => {
              set({ tags: addTags(draft.tags, tagText) });
              setTagText('');
            }}
            onBlur={() => {
              if (!tagText.trim()) return;
              set({ tags: addTags(draft.tags, tagText) });
              setTagText('');
            }}
          />
        </View>
      </Section>
    </View>
  );
}

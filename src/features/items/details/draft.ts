/**
 * The details form as data: defaults, the suggested name, validation and the
 * mapping to item columns. Shared by Add (a new piece) and Edit. Pure — safe
 * to import from tests.
 */
import type { Item, ItemColor } from '@/db/schema';
import type { Category, Occasion, Season } from '@/features/items/catalog';
import { cleanName, capitalize } from '@/lib/text';

import { CATEGORY_NOUN, MATERIALS, NAMING_MATERIALS } from './options';

export const MAX_COLORS = 3;
export const NAME_MAX = 60;
export const TAG_MAX = 24;

export type ItemDraft = {
  name: string;
  /** False while the name is still the suggestion, so it keeps following category and colour. */
  nameEdited: boolean;
  category: Category | null;
  subcategory: string;
  colors: ItemColor[];
  pattern: string | null;
  /** Free text ("80% wool, 20% cashmere"); the chips toggle known materials in it. */
  material: string;
  seasons: Season[];
  occasions: Occasion[];
  size: string;
  brand: string;
  /** As typed; parsed on save. */
  price: string;
  currency: string;
  /** "YYYY-MM", or null when unknown. */
  purchased: string | null;
  store: string;
  careNotes: string;
  tags: string[];
};

// ------------------------------------------------------------------ name --
/** Subcategories that already name the piece on their own ("Navy blazer", not "Navy blazer jacket"). */
const STANDALONE = new Set(
  [
    'blazer',
    'overcoat',
    'trench',
    'puffer',
    'parka',
    'raincoat',
    'cardigan',
    'turtleneck',
    'blouse',
    'camisole',
    'tank',
    'bodysuit',
    'polo',
    'overshirt',
    'sneakers',
    'trainers',
    'boots',
    'chelsea boots',
    'loafers',
    'heels',
    'sandals',
    'flats',
    'tote',
    'crossbody',
    'backpack',
    'clutch',
    'necklace',
    'earrings',
    'ring',
    'bracelet',
    'watch',
    'cap',
    'beanie',
    'bucket hat',
    'leggings',
    'sports bra',
    'bandana',
    'joggers',
    'chino',
  ].map((s) => s.toLowerCase()),
);

/** "Camel wool coat", "Rust slip dress", "Navy blazer", or "New piece" with nothing to go on. */
export function suggestName(d: Pick<ItemDraft, 'colors' | 'category' | 'subcategory' | 'material'>): string {
  const colour = d.colors[0]?.name.toLowerCase() ?? '';
  const sub = d.subcategory.trim().toLowerCase();
  const noun = d.category ? CATEGORY_NOUN[d.category] : '';
  let piece = noun;
  if (sub) piece = STANDALONE.has(sub) || (noun && sub.includes(noun)) ? sub : `${sub} ${noun}`.trim();
  const materials = MATERIALS.filter((m) => materialHas(d.material, m));
  const fabric =
    materials.length === 1 && materials[0] && NAMING_MATERIALS.has(materials[0]) ? materials[0].toLowerCase() : '';
  const words = [colour, fabric && !piece.includes(fabric) ? fabric : '', piece].filter(Boolean);
  if (!piece) return colour ? `${capitalize(colour)} piece` : 'New piece';
  return capitalize(words.join(' '));
}

/** Re-derives the name from the other fields until the user types their own. */
export function withSuggestedName(d: ItemDraft): ItemDraft {
  return d.nameEdited ? d : { ...d, name: suggestName(d) };
}

// ------------------------------------------------------------ defaults --
export function emptyDraft(
  currency: string,
  seed: { category?: Category | null; colors?: ItemColor[] } = {},
): ItemDraft {
  return withSuggestedName({
    name: '',
    nameEdited: false,
    category: seed.category ?? null,
    subcategory: '',
    colors: (seed.colors ?? []).slice(0, MAX_COLORS),
    pattern: null,
    material: '',
    seasons: [],
    occasions: [],
    size: '',
    brand: '',
    price: '',
    currency,
    purchased: null,
    store: '',
    careNotes: '',
    tags: [],
  });
}

export function draftFromItem(item: Item): ItemDraft {
  return {
    name: item.name,
    nameEdited: true,
    category: item.category,
    subcategory: item.subcategory ?? '',
    colors: item.colors.map(({ hex, name }) => ({ hex, name })),
    pattern: item.pattern,
    material: item.material ?? '',
    seasons: [...item.seasons],
    occasions: [...item.occasions],
    size: item.size ?? '',
    brand: item.brand ?? '',
    price: item.price === null ? '' : String(item.price),
    currency: item.currency ?? 'USD',
    purchased: item.purchaseDate ? monthKey(item.purchaseDate) : null,
    store: item.store ?? '',
    careNotes: item.careNotes ?? '',
    tags: [...item.tags],
  };
}

// ---------------------------------------------------------------- price --
/**
 * Reads a typed price: "49.90", "1,299", "€ 49,90". Null when empty, NaN when
 * it isn't a price.
 */
export function parsePrice(text: string): number | null {
  const raw = text.replace(/[^\d.,-]/g, '');
  if (raw === '') return text.trim() === '' ? null : Number.NaN;
  let normalised = raw;
  // A single comma followed by one or two digits is a decimal comma ("49,90").
  if (/^\d+,\d{1,2}$/.test(raw)) normalised = raw.replace(',', '.');
  else normalised = raw.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalised)) return Number.NaN;
  return Math.round(Number(normalised) * 100) / 100;
}

// ------------------------------------------------------------ materials --
const materialToken = (material: string) => new RegExp(`\\b${material}\\b`, 'i');

export function materialHas(text: string, material: string): boolean {
  return materialToken(material).test(text);
}

/** Adds "Silk" to the material text, or removes the part that mentions it ("20% silk"). */
export function toggleMaterial(text: string, material: string): string {
  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.some((p) => materialHas(p, material))) {
    return parts.filter((p) => !materialHas(p, material)).join(', ');
  }
  return [...parts, material].join(', ');
}

// --------------------------------------------------------------- colours --
export function toggleColor(colors: readonly ItemColor[], color: ItemColor): ItemColor[] {
  if (colors.some((c) => c.name === color.name)) return colors.filter((c) => c.name !== color.name);
  if (colors.length >= MAX_COLORS) return [...colors];
  return [...colors, color];
}

// ------------------------------------------------------------------ tags --
/** Adds comma-separated tags: trimmed, lower-case, no "#", no duplicates. */
export function addTags(tags: readonly string[], raw: string): string[] {
  const next = [...tags];
  for (const part of raw.split(',')) {
    const tag = part.replace(/#/g, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, TAG_MAX);
    if (tag && !next.includes(tag)) next.push(tag);
  }
  return next;
}

// ---------------------------------------------------------------- months --
const pad = (n: number) => String(n).padStart(2, '0');

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Noon on the 1st of the month, so no timezone moves it into the previous month. */
export function monthStart(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Number(match[1]), month - 1, 1, 12);
}

/** This year and the five before it, newest first. */
export function purchaseYears(now: Date, count = 6): number[] {
  return Array.from({ length: count }, (_, i) => now.getFullYear() - i);
}

export function isFutureMonth(year: number, month: number, now: Date): boolean {
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
}

// ---------------------------------------------------------------- brands --
/** Brands already in the wardrobe that match what's typed: prefix matches first. */
export function suggestBrands(input: string, brands: readonly string[], limit = 5): string[] {
  const q = input.trim().toLowerCase();
  const unique = [...new Set(brands.filter(Boolean))];
  if (!q) return unique.slice(0, limit);
  const starts = unique.filter((b) => b.toLowerCase().startsWith(q) && b.toLowerCase() !== q);
  const contains = unique.filter((b) => !b.toLowerCase().startsWith(q) && b.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

// ----------------------------------------------------------- validation --
export type DraftErrors = Partial<Record<'name' | 'category' | 'price', string>>;

export function validateDraft(d: ItemDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!cleanName(d.name, NAME_MAX)) errors.name = 'Give it a name';
  if (!d.category) errors.category = 'Pick a category';
  const price = parsePrice(d.price);
  if (price !== null && (Number.isNaN(price) || price < 0)) errors.price = 'Use a number, like 49.90';
  return errors;
}

export const isValid = (errors: DraftErrors) => Object.keys(errors).length === 0;

/** The item columns the form owns (not placement, images or status). */
export type DraftFields = {
  name: string;
  category: Category;
  subcategory: string | null;
  colors: ItemColor[];
  pattern: string | null;
  material: string | null;
  seasons: Season[];
  occasions: Occasion[];
  size: string | null;
  brand: string | null;
  price: number | null;
  currency: string;
  purchaseDate: Date | null;
  store: string | null;
  careNotes: string | null;
  tags: string[];
};

/** Columns for a valid draft, or null if it isn't valid yet. */
export function draftToFields(d: ItemDraft): DraftFields | null {
  if (!isValid(validateDraft(d)) || !d.category) return null;
  const price = parsePrice(d.price);
  const text = (value: string, max = 120) => cleanName(value, max);
  return {
    name: cleanName(d.name, NAME_MAX) ?? suggestName(d),
    category: d.category,
    subcategory: text(d.subcategory, 40),
    colors: d.colors.slice(0, MAX_COLORS).map(({ hex, name }) => ({ hex, name })),
    pattern: d.pattern,
    material: text(d.material),
    seasons: [...d.seasons],
    occasions: [...d.occasions],
    size: text(d.size, 16),
    brand: text(d.brand, 40),
    price: price === null || Number.isNaN(price) ? null : price,
    currency: d.currency,
    purchaseDate: d.purchased ? monthStart(d.purchased) : null,
    store: text(d.store, 40),
    careNotes: d.careNotes.trim() ? d.careNotes.trim().slice(0, 400) : null,
    tags: [...d.tags],
  };
}

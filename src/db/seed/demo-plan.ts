/**
 * Builds the demo wardrobe as plain data — no database, no files — so it can
 * be unit-tested. `seedDemoWardrobe()` turns this plan into rows and images.
 *
 * Wear history is generated, not hard-coded: ~8 months of plausible daily
 * outfits from a seeded PRNG, so wearCount, lastWornAt, cost-per-wear and the
 * "forgotten" (90+ days unworn) items are all internally consistent.
 */
import {
  CATEGORY_DEFAULT_ZONE,
  CATEGORY_ROLE,
  type Category,
  type ItemStatus,
  type Occasion,
  type Season,
  type ZoneType,
} from '@/features/items/catalog';
import { ROLE_POSE } from '@/features/outfits/canvas';
import { paletteColor } from '@/lib/color';
import { addDays, startOfDay, toDayKey, type DayKey } from '@/lib/dates';

import data from './garments.json';

export type SeedGarment = {
  slug: string;
  name: string;
  shape: string;
  colors: string[];
  category: Category;
  subcategory?: string;
  brand: string;
  price: number;
  size: string;
  material: string;
  pattern: string;
  seasons: Season[];
  occasions: Occasion[];
  store: string;
  careNotes?: string;
  weight: number;
  restDays: number;
  addedDaysAgo: number;
  status?: ItemStatus;
  favorite?: boolean;
  lentTo?: string;
  lentDaysAgo?: number;
  /** Dry cleaner: dropped off this many days ago, ready in `readyInDays`. */
  statusDaysAgo?: number;
  readyInDays?: number;
  wornToday?: boolean;
  wardrobe?: 'home' | 'storage';
};

export type SeedWish = {
  slug: string;
  name: string;
  shape: string;
  colors: string[];
  category: Category;
  price: number;
  url: string;
  notes: string | null;
};

export type WardrobeKey = 'home' | 'storage';

export type PlannedZone = { key: string; wardrobe: WardrobeKey; type: ZoneType; name: string; sortOrder: number };

export type PlannedItem = {
  slug: string;
  wardrobe: WardrobeKey;
  zoneKey: string;
  name: string;
  category: Category;
  subcategory: string | null;
  colors: { hex: string; name: string }[];
  pattern: string;
  material: string;
  brand: string;
  size: string;
  seasons: Season[];
  occasions: Occasion[];
  tags: string[];
  price: number;
  currency: string;
  purchaseDate: Date;
  store: string;
  careNotes: string | null;
  status: ItemStatus;
  statusChangedAt: Date | null;
  lentTo: string | null;
  lentAt: Date | null;
  readyAt: Date | null;
  isFavorite: boolean;
  wearCount: number;
  lastWornAt: Date | null;
  createdAt: Date;
};

export type PlannedPiece = { slug: string; x: number; y: number; scale: number; rotation: number; zIndex: number };
export type PlannedOutfit = {
  key: string;
  name: string;
  occasion: Occasion;
  seasons: Season[];
  isFavorite: boolean;
  pieces: PlannedPiece[];
};
export type PlannedWearLog = {
  date: DayKey;
  daysAgo: number;
  slugs: string[];
  outfitKey: string | null;
  notes: string | null;
};

export type DemoPlan = {
  wardrobes: { key: WardrobeKey; name: string; icon: string; sortOrder: number }[];
  zones: PlannedZone[];
  items: PlannedItem[];
  outfits: PlannedOutfit[];
  wearLogs: PlannedWearLog[];
  planned: { date: DayKey; outfitKey: string }[];
  trip: {
    name: string;
    destination: string;
    latitude: number;
    longitude: number;
    startDate: DayKey;
    endDate: DayKey;
    entries: { slug?: string; outfitKey?: string; quantity: number; packed: boolean }[];
  };
  wishlist: (SeedWish & { colorsResolved: { hex: string; name: string }[] })[];
};

export const HISTORY_DAYS = 240;

export const SEED_GARMENTS = data.garments as SeedGarment[];
export const SEED_WISHLIST = data.wishlist as SeedWish[];

/** Small deterministic PRNG (mulberry32). */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Northern-hemisphere meteorological season for a date. */
export function seasonOf(date: Date): Season {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

/** Which zone a garment lands in by default. */
export function zoneKeyFor(category: Category, wardrobe: WardrobeKey): string {
  const type = CATEGORY_DEFAULT_ZONE[category];
  if (wardrobe === 'storage') return `storage-${type === 'drawer' ? 'shelf' : type}`;
  if (type === 'shelf') return category === 'knitwear' || category === 'tshirts' ? 'shelf-knit' : 'shelf-denim';
  if (type === 'drawer')
    return `drawer-${category === 'socks' ? 'socks' : category === 'underwear' ? 'underwear' : 'active'}`;
  return type;
}

const ZONES: PlannedZone[] = [
  { key: 'rail', wardrobe: 'home', type: 'rail', name: 'Hanging rail', sortOrder: 0 },
  { key: 'shelf-knit', wardrobe: 'home', type: 'shelf', name: 'Knitwear & tees', sortOrder: 1 },
  { key: 'shelf-denim', wardrobe: 'home', type: 'shelf', name: 'Denim & trousers', sortOrder: 2 },
  { key: 'drawer-underwear', wardrobe: 'home', type: 'drawer', name: 'Underwear', sortOrder: 3 },
  { key: 'drawer-socks', wardrobe: 'home', type: 'drawer', name: 'Socks', sortOrder: 4 },
  { key: 'drawer-active', wardrobe: 'home', type: 'drawer', name: 'Activewear', sortOrder: 5 },
  { key: 'shoes', wardrobe: 'home', type: 'shoes', name: 'Shoe rack', sortOrder: 6 },
  { key: 'accessories', wardrobe: 'home', type: 'accessories', name: 'Accessories tray', sortOrder: 7 },
  { key: 'storage-rail', wardrobe: 'storage', type: 'rail', name: 'Hanging rail', sortOrder: 0 },
  { key: 'storage-shelf', wardrobe: 'storage', type: 'shelf', name: 'Shelves', sortOrder: 1 },
  { key: 'storage-shoes', wardrobe: 'storage', type: 'shoes', name: 'Shoe rack', sortOrder: 2 },
  { key: 'storage-accessories', wardrobe: 'storage', type: 'accessories', name: 'Accessories tray', sortOrder: 3 },
];

/** Default zones for a brand-new (empty) wardrobe. */
export const DEFAULT_HOME_ZONES = ZONES.filter((z) => z.wardrobe === 'home');
export const DEFAULT_STORAGE_ZONES = ZONES.filter((z) => z.wardrobe === 'storage');

type Slot = 'layer' | 'top' | 'bottom' | 'shoes' | 'acc';
/** The builder's flat-lay spots, so demo outfits look like boards you'd build. */
const SLOT_POSE: Record<Slot, Omit<PlannedPiece, 'slug'>> = {
  bottom: { ...ROLE_POSE.bottom, zIndex: 0 },
  layer: { ...ROLE_POSE.layer, zIndex: 1 },
  top: { ...ROLE_POSE.top, zIndex: 2 },
  shoes: { ...ROLE_POSE.shoes, zIndex: 3 },
  acc: { ...ROLE_POSE.accessory, zIndex: 4 },
};

const OUTFITS: {
  key: string;
  name: string;
  occasion: Occasion;
  seasons: Season[];
  fav: boolean;
  slots: Partial<Record<Slot, string>>;
}[] = [
  {
    key: 'ecru-navy',
    name: 'Ecru & navy',
    occasion: 'work',
    seasons: ['spring', 'autumn'],
    fav: true,
    slots: {
      layer: 'navy-blazer',
      top: 'ecru-linen-shirt',
      bottom: 'stone-chinos',
      shoes: 'black-loafers',
      acc: 'camel-tote',
    },
  },
  {
    key: 'rust-weekend',
    name: 'Rust weekend',
    occasion: 'weekend',
    seasons: ['summer', 'autumn'],
    fav: true,
    slots: { layer: 'denim-jacket', top: 'rust-slip-dress', shoes: 'white-sneakers', acc: 'burgundy-crossbody' },
  },
  {
    key: 'quiet-neutrals',
    name: 'Quiet neutrals',
    occasion: 'weekend',
    seasons: ['spring'],
    fav: false,
    slots: {
      layer: 'olive-utility-jacket',
      top: 'blush-silk-blouse',
      bottom: 'indigo-jeans',
      shoes: 'chelsea-boots',
      acc: 'gold-pendant',
    },
  },
  {
    key: 'gallery-night',
    name: 'Gallery night',
    occasion: 'evening',
    seasons: ['autumn'],
    fav: false,
    slots: { layer: 'camel-wool-coat', top: 'black-midi-dress', shoes: 'black-loafers', acc: 'burgundy-crossbody' },
  },
  {
    key: 'monday-uniform',
    name: 'Monday uniform',
    occasion: 'work',
    seasons: ['autumn', 'winter'],
    fav: true,
    slots: { top: 'charcoal-merino', bottom: 'black-trousers', shoes: 'black-loafers', acc: 'leather-belt' },
  },
  {
    key: 'rainy-errands',
    name: 'Rainy errands',
    occasion: 'weekend',
    seasons: ['autumn'],
    fav: false,
    slots: {
      layer: 'stone-trench',
      top: 'white-tee',
      bottom: 'indigo-jeans',
      shoes: 'chelsea-boots',
      acc: 'olive-bucket-hat',
    },
  },
];

const NOTES = [
  'Back-to-back meetings — comfy and sharp.',
  'Caught in the rain; glad for the layer.',
  'Gallery opening. The bag got compliments.',
  'Farmers market and a long lunch.',
  null,
  null,
  null,
];

export function buildDemoPlan(today: Date, seed = 7): DemoPlan {
  const rand = prng(seed);
  const garments = SEED_GARMENTS;
  const bySlug = new Map(garments.map((g) => [g.slug, g]));

  const roleOf = (g: SeedGarment) =>
    g.category === 'socks' || g.category === 'underwear'
      ? 'socks'
      : g.category === 'activewear'
        ? 'active'
        : CATEGORY_ROLE[g.category];

  const eligible = (g: SeedGarment, daysAgo: number, season: Season) =>
    g.addedDaysAgo >= daysAgo && daysAgo > g.restDays && (g.seasons.length === 0 || g.seasons.includes(season));

  const pick = (pool: SeedGarment[]): SeedGarment | null => {
    const total = pool.reduce((s, g) => s + g.weight, 0);
    if (total <= 0) return null;
    let r = rand() * total;
    for (const g of pool) {
      r -= g.weight;
      if (r <= 0) return g;
    }
    return pool[pool.length - 1] ?? null;
  };

  const outfitKeyFor = (slugs: string[]) => {
    const set = new Set(slugs);
    const match = OUTFITS.find((o) => Object.values(o.slots).every((s) => s && set.has(s)));
    return match?.key ?? null;
  };

  // ---- Generated history (oldest → yesterday) --------------------------
  const wearLogs: PlannedWearLog[] = [];
  for (let d = HISTORY_DAYS; d >= 1; d--) {
    if (rand() < 0.08) continue; // the odd day off the grid
    const date = addDays(today, -d);
    const season = seasonOf(date);
    const pool = garments.filter((g) => eligible(g, d, season));
    const inRole = (role: string) => pool.filter((g) => roleOf(g) === role);
    const chosen: SeedGarment[] = [];
    const add = (g: SeedGarment | null) => {
      if (g && !chosen.includes(g)) chosen.push(g);
    };

    if (rand() < 0.1 && inRole('active').length >= 2) {
      const active = inRole('active');
      add(pick(active.filter((g) => g.shape !== 'leggings')));
      add(pick(active.filter((g) => g.shape === 'leggings')));
      add(pick(inRole('shoes').filter((g) => g.shape === 'sneaker')));
    } else {
      const dresses = inRole('one_piece');
      if (dresses.length > 0 && rand() < 0.16) add(pick(dresses));
      else {
        add(pick(inRole('top')));
        add(pick(inRole('bottom')));
      }
      add(pick(inRole('shoes')));
      const layerChance = { winter: 0.85, autumn: 0.6, spring: 0.35, summer: 0.05 }[season];
      if (rand() < layerChance) add(pick(inRole('layer')));
      if (rand() < 0.45) add(pick(inRole('socks')));
      if (rand() < 0.6) add(pick(inRole('accessory')));
      if (rand() < 0.2) add(pick(inRole('accessory')));
    }
    if (chosen.length < 2) continue;
    const slugs = chosen.map((g) => g.slug);
    wearLogs.push({
      date: toDayKey(date),
      daysAgo: d,
      slugs,
      outfitKey: outfitKeyFor(slugs),
      notes: rand() < 0.08 ? (NOTES[Math.floor(rand() * NOTES.length)] ?? null) : null,
    });
  }

  // Laundry pieces were worn in the last few days.
  for (const g of garments.filter((x) => x.status === 'laundry')) {
    const recent = wearLogs.find((l) => l.daysAgo === 2) ?? wearLogs[wearLogs.length - 1];
    if (recent && !recent.slugs.includes(g.slug)) recent.slugs.push(g.slug);
  }

  // Today: what's marked "worn".
  const wornToday = garments.filter((g) => g.wornToday).map((g) => g.slug);
  if (wornToday.length > 0) {
    wearLogs.push({
      date: toDayKey(today),
      daysAgo: 0,
      slugs: wornToday,
      outfitKey: outfitKeyFor(wornToday),
      notes: null,
    });
  }

  // ---- Items with cached wear stats -------------------------------------
  const counts = new Map<string, number>();
  const last = new Map<string, number>();
  for (const log of wearLogs) {
    for (const s of log.slugs) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
      const prev = last.get(s);
      if (prev === undefined || log.daysAgo < prev) last.set(s, log.daysAgo);
    }
  }

  const noonDaysAgo = (d: number) => {
    const t = addDays(today, -d);
    t.setHours(12, 0, 0, 0);
    return t;
  };

  // When each piece took its current status: worn today, washed two days ago…
  const statusSince = (g: SeedGarment): Date | null => {
    switch (g.status ?? 'in_wardrobe') {
      case 'worn':
        return noonDaysAgo(0);
      case 'laundry':
        return noonDaysAgo(2);
      case 'lent':
        return noonDaysAgo(g.lentDaysAgo ?? 0);
      case 'dry_cleaner':
        return noonDaysAgo(g.statusDaysAgo ?? 3);
      case 'storage':
        return noonDaysAgo(Math.min(g.restDays, g.addedDaysAgo));
      default:
        return null;
    }
  };

  const items: PlannedItem[] = garments.map((g) => {
    const wardrobe = g.wardrobe ?? 'home';
    const lastDays = last.get(g.slug);
    return {
      slug: g.slug,
      wardrobe,
      zoneKey: zoneKeyFor(g.category, wardrobe),
      name: g.name,
      category: g.category,
      subcategory: g.subcategory ?? null,
      colors: g.colors.map((c) => {
        const named = paletteColor(c);
        return { hex: named.hex, name: named.name };
      }),
      pattern: g.pattern,
      material: g.material,
      brand: g.brand,
      size: g.size,
      seasons: g.seasons,
      occasions: g.occasions,
      tags: [],
      price: g.price,
      currency: 'USD',
      purchaseDate: noonDaysAgo(g.addedDaysAgo + 2),
      store: g.store,
      careNotes: g.careNotes ?? null,
      status: g.status ?? 'in_wardrobe',
      statusChangedAt: statusSince(g),
      lentTo: g.lentTo ?? null,
      lentAt: g.lentDaysAgo !== undefined ? noonDaysAgo(g.lentDaysAgo) : null,
      readyAt:
        g.status === 'dry_cleaner' && g.readyInDays !== undefined ? startOfDay(addDays(today, g.readyInDays)) : null,
      isFavorite: g.favorite ?? false,
      wearCount: counts.get(g.slug) ?? 0,
      lastWornAt: lastDays === undefined ? null : noonDaysAgo(lastDays),
      createdAt: noonDaysAgo(g.addedDaysAgo),
    };
  });

  // ---- Outfits, plans, trip, wishlist ------------------------------------
  const outfits: PlannedOutfit[] = OUTFITS.map((o) => ({
    key: o.key,
    name: o.name,
    occasion: o.occasion,
    seasons: o.seasons,
    isFavorite: o.fav,
    pieces: (Object.entries(o.slots) as [Slot, string][])
      .filter(([, slug]) => bySlug.has(slug))
      .map(([slot, slug]) => ({
        slug,
        ...SLOT_POSE[slot],
        // A dress fills the top slot when there are no bottoms.
        ...(slot === 'top' && !o.slots.bottom ? ROLE_POSE.one_piece : {}),
      })),
  }));

  const day = (offset: number) => toDayKey(addDays(today, offset));

  return {
    wardrobes: [
      { key: 'home', name: 'Home', icon: 'home', sortOrder: 0 },
      { key: 'storage', name: 'Storage', icon: 'archive', sortOrder: 1 },
    ],
    zones: ZONES,
    items,
    outfits,
    wearLogs,
    planned: [
      { date: day(1), outfitKey: 'monday-uniform' },
      { date: day(2), outfitKey: 'gallery-night' },
      { date: day(4), outfitKey: 'rust-weekend' },
      { date: day(10), outfitKey: 'rainy-errands' },
    ],
    trip: {
      name: 'Lisbon',
      destination: 'Lisbon, Portugal',
      latitude: 38.7223,
      longitude: -9.1393,
      startDate: day(11),
      endDate: day(15),
      entries: [
        { outfitKey: 'ecru-navy', quantity: 1, packed: false },
        { outfitKey: 'rust-weekend', quantity: 1, packed: false },
        { slug: 'ecru-linen-shirt', quantity: 1, packed: true },
        { slug: 'blush-silk-blouse', quantity: 1, packed: false },
        { slug: 'white-tee', quantity: 2, packed: true },
        { slug: 'sky-oxford-shirt', quantity: 1, packed: false },
        { slug: 'indigo-jeans', quantity: 1, packed: true },
        { slug: 'stone-chinos', quantity: 1, packed: false },
        { slug: 'black-trousers', quantity: 1, packed: true },
        { slug: 'rust-slip-dress', quantity: 1, packed: true },
        { slug: 'white-sneakers', quantity: 1, packed: true },
        { slug: 'black-loafers', quantity: 1, packed: false },
        { slug: 'navy-blazer', quantity: 1, packed: true },
        { slug: 'cream-cable-knit', quantity: 1, packed: false },
        { slug: 'camel-tote', quantity: 1, packed: true },
        { slug: 'gold-pendant', quantity: 1, packed: true },
        { slug: 'olive-bucket-hat', quantity: 1, packed: false },
      ],
    },
    wishlist: SEED_WISHLIST.map((w) => ({
      ...w,
      colorsResolved: w.colors.map((c) => {
        const named = paletteColor(c);
        return { hex: named.hex, name: named.name };
      }),
    })),
  };
}

/**
 * Garment vocabulary shared by the schema, forms, filters and the suggestion
 * engine. Pure data — safe to import from tests.
 */

export const ZONE_TYPES = ['rail', 'shelf', 'drawer', 'shoes', 'accessories'] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const ITEM_STATUSES = ['in_wardrobe', 'worn', 'laundry', 'dry_cleaner', 'lent', 'storage', 'archived'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Statuses where the garment is physically out of its spot (empty hanger + tag). */
export const OUT_STATUSES: readonly ItemStatus[] = ['worn', 'laundry', 'dry_cleaner', 'lent'];

export const ARCHIVE_REASONS = ['donated', 'sold', 'discarded'] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export const CATEGORIES = [
  'tops',
  'shirts',
  'tshirts',
  'knitwear',
  'dresses',
  'jackets',
  'coats',
  'jeans',
  'trousers',
  'skirts',
  'shorts',
  'underwear',
  'socks',
  'activewear',
  'shoes',
  'bags',
  'belts',
  'jewelry',
  'hats',
  'scarves',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Default closet zone per category; users can drag items elsewhere. */
export const CATEGORY_DEFAULT_ZONE: Record<Category, ZoneType> = {
  tops: 'rail',
  shirts: 'rail',
  dresses: 'rail',
  jackets: 'rail',
  coats: 'rail',
  knitwear: 'shelf',
  tshirts: 'shelf',
  jeans: 'shelf',
  trousers: 'shelf',
  skirts: 'rail',
  shorts: 'shelf',
  underwear: 'drawer',
  socks: 'drawer',
  activewear: 'drawer',
  shoes: 'shoes',
  bags: 'accessories',
  belts: 'accessories',
  jewelry: 'accessories',
  hats: 'accessories',
  scarves: 'accessories',
};

/** Outfit-building role of each category. */
export const CATEGORY_ROLE: Record<
  Category,
  'top' | 'bottom' | 'one_piece' | 'layer' | 'shoes' | 'accessory' | 'basic'
> = {
  tops: 'top',
  shirts: 'top',
  tshirts: 'top',
  knitwear: 'top',
  dresses: 'one_piece',
  jackets: 'layer',
  coats: 'layer',
  jeans: 'bottom',
  trousers: 'bottom',
  skirts: 'bottom',
  shorts: 'bottom',
  underwear: 'basic',
  socks: 'basic',
  activewear: 'basic',
  shoes: 'shoes',
  bags: 'accessory',
  belts: 'accessory',
  jewelry: 'accessory',
  hats: 'accessory',
  scarves: 'accessory',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  tops: 'Tops',
  shirts: 'Shirts',
  tshirts: 'T-shirts',
  knitwear: 'Knitwear',
  dresses: 'Dresses',
  jackets: 'Jackets',
  coats: 'Coats',
  jeans: 'Jeans',
  trousers: 'Trousers',
  skirts: 'Skirts',
  shorts: 'Shorts',
  underwear: 'Underwear',
  socks: 'Socks',
  activewear: 'Activewear',
  shoes: 'Shoes',
  bags: 'Bags',
  belts: 'Belts',
  jewelry: 'Jewellery',
  hats: 'Hats',
  scarves: 'Scarves',
};

/** Coarser groups used by the wardrobe filter chips ("Tops", "Outerwear"…). */
export const CATEGORY_GROUPS = [
  'tops',
  'dresses',
  'outerwear',
  'knitwear',
  'bottoms',
  'shoes',
  'accessories',
  'basics',
] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const CATEGORY_GROUP: Record<Category, CategoryGroup> = {
  tops: 'tops',
  shirts: 'tops',
  tshirts: 'tops',
  knitwear: 'knitwear',
  dresses: 'dresses',
  jackets: 'outerwear',
  coats: 'outerwear',
  jeans: 'bottoms',
  trousers: 'bottoms',
  skirts: 'bottoms',
  shorts: 'bottoms',
  underwear: 'basics',
  socks: 'basics',
  activewear: 'basics',
  shoes: 'shoes',
  bags: 'accessories',
  belts: 'accessories',
  jewelry: 'accessories',
  hats: 'accessories',
  scarves: 'accessories',
};

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  tops: 'Tops',
  dresses: 'Dresses',
  outerwear: 'Outerwear',
  knitwear: 'Knitwear',
  bottoms: 'Bottoms',
  shoes: 'Shoes',
  accessories: 'Accessories',
  basics: 'Basics',
};

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

export const OCCASIONS = ['work', 'weekend', 'evening', 'travel', 'active', 'formal'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABEL: Record<Occasion, string> = {
  work: 'Work',
  weekend: 'Weekend',
  evening: 'Evening',
  travel: 'Travel',
  active: 'Active',
  formal: 'Formal',
};

export const ARCHIVE_REASON_LABEL: Record<ArchiveReason, string> = {
  donated: 'Donated',
  sold: 'Sold',
  discarded: 'Discarded',
};

export const STATUS_LABEL: Record<ItemStatus, string> = {
  in_wardrobe: 'In wardrobe',
  worn: 'Worn',
  laundry: 'In laundry',
  dry_cleaner: 'Dry cleaner',
  lent: 'Lent',
  storage: 'In storage',
  archived: 'Archived',
};

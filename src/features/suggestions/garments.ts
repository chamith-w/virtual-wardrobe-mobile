/**
 * How the engine reads a garment: which slot of an outfit it fills, how warm
 * a layer is, and whether it copes with rain. Read from the category, then
 * the kind, material, name and tags. Pure — safe to import from tests.
 */
import type { ItemColor } from '@/db/schema';
import { CATEGORY_ROLE, type Category, type ItemStatus, type Occasion, type Season } from '@/features/items/catalog';

/** What the engine needs to know about a piece. */
export type SuggestItem = {
  id: string;
  name: string;
  category: Category;
  subcategory: string | null;
  material: string | null;
  tags: string[];
  colors: ItemColor[];
  seasons: Season[];
  occasions: Occasion[];
  status: ItemStatus;
  isFavorite: boolean;
  wearCount: number;
  lastWornAt: Date | null;
  createdAt: Date;
};

export type Slot = 'top' | 'bottom' | 'dress' | 'shoes' | 'layer' | 'accessory';

/** The slot a piece fills. Basics (underwear, socks, activewear) aren't styled. */
export function slotOf(item: Pick<SuggestItem, 'category'>): Slot | null {
  switch (CATEGORY_ROLE[item.category]) {
    case 'top':
      return 'top';
    case 'bottom':
      return 'bottom';
    case 'one_piece':
      return 'dress';
    case 'shoes':
      return 'shoes';
    case 'layer':
      return 'layer';
    case 'accessory':
      return 'accessory';
    case 'basic':
      return null;
  }
}

/** Name, kind, material and tags as one lowercase string to match words against. */
function words(item: Pick<SuggestItem, 'name' | 'subcategory' | 'material' | 'tags'>): string {
  return [item.name, item.subcategory, item.material, ...item.tags].filter(Boolean).join(' ').toLowerCase();
}

export function isKnit(item: Pick<SuggestItem, 'category'>): boolean {
  return item.category === 'knitwear';
}

const HEAVY_COAT = /\b(wool|cashmere|down|puffer|parka|overcoat|shearling|teddy|quilted|padded|fleece)\b/;
const LIGHT_COAT = /\b(trench|mac|raincoat|rain|linen|cotton|nylon|windbreaker|shell)\b/;
/** Wool alone doesn't make a jacket warm: a wool blazer is still tailoring. */
const HEAVY_JACKET = /\b(down|puffer|parka|shearling|teddy|quilted|padded|fleece|sherpa)\b/;

/**
 * How warm a layer is. Coats are heavy unless they read as a trench or a
 * rain mac; jackets are light unless padded, down or shearling. A cardigan
 * is a light layer too.
 */
export function layerWarmth(
  item: Pick<SuggestItem, 'category' | 'name' | 'subcategory' | 'material' | 'tags'>,
): 'light' | 'heavy' | null {
  const w = words(item);
  if (item.category === 'coats') return LIGHT_COAT.test(w) && !HEAVY_COAT.test(w) ? 'light' : 'heavy';
  if (item.category === 'jackets') return HEAVY_JACKET.test(w) ? 'heavy' : 'light';
  if (item.category === 'knitwear' && /\bcardigan\b/.test(w)) return 'light';
  return null;
}

const WATERPROOF_LAYER = /\b(trench|mac|raincoat|rain|waterproof|gabardine|parka|anorak|shell|waxed|gore-?tex)\b/;
const WATERPROOF_SHOES = /\b(boots?|rubber|waterproof|wellingtons?|wellies|gore-?tex|galoshes)\b/;
const RAIN_SHY_SHOES = /\b(suede|canvas|mesh|knit|satin|espadrilles?)\b/;

export function isWaterproof(
  item: Pick<SuggestItem, 'category' | 'name' | 'subcategory' | 'material' | 'tags'>,
): boolean {
  const slot = slotOf(item);
  if (slot === 'layer') return WATERPROOF_LAYER.test(words(item));
  if (slot === 'shoes') return WATERPROOF_SHOES.test(words(item));
  return false;
}

export function isBoot(item: Pick<SuggestItem, 'category' | 'name' | 'subcategory' | 'material' | 'tags'>): boolean {
  return slotOf(item) === 'shoes' && /\bboots?\b/.test(words(item));
}

/** Shoes that suffer in the rain. */
export function isRainShy(item: Pick<SuggestItem, 'category' | 'name' | 'subcategory' | 'material' | 'tags'>): boolean {
  return slotOf(item) === 'shoes' && RAIN_SHY_SHOES.test(words(item));
}

/** Tagged only for spring and/or summer. */
export function isSummerOnly(item: Pick<SuggestItem, 'seasons'>): boolean {
  return item.seasons.length > 0 && item.seasons.every((s) => s === 'spring' || s === 'summer');
}

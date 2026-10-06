/**
 * Chip vocabulary for the details form. Pure data — safe to import from tests.
 */
import { CATEGORY_DEFAULT_ZONE, type Category } from '@/features/items/catalog';

/** Common subcategories per category, offered as chips (free text is still allowed). */
export const SUBCATEGORIES: Record<Category, string[]> = {
  tops: ['Blouse', 'Camisole', 'Tank', 'Bodysuit'],
  shirts: ['Button-down', 'Oxford', 'Linen shirt', 'Overshirt'],
  tshirts: ['Crew tee', 'V-neck', 'Long sleeve', 'Polo'],
  knitwear: ['Crewneck', 'Cardigan', 'Cable knit', 'Turtleneck', 'Vest'],
  dresses: ['Midi', 'Maxi', 'Mini', 'Slip', 'Shirt dress', 'Wrap'],
  jackets: ['Blazer', 'Trucker', 'Utility', 'Leather', 'Bomber'],
  coats: ['Overcoat', 'Trench', 'Puffer', 'Parka', 'Raincoat'],
  jeans: ['Straight', 'Slim', 'Wide leg', 'Bootcut'],
  trousers: ['Tailored', 'Chino', 'Wide leg', 'Cargo', 'Joggers'],
  skirts: ['Midi', 'Mini', 'Maxi', 'Pleated', 'Pencil'],
  shorts: ['Denim', 'Tailored', 'Running'],
  underwear: ['Briefs', 'Bra', 'Boxers', 'Slip'],
  socks: ['Ankle', 'Crew', 'Knee-high'],
  activewear: ['Leggings', 'Sports bra', 'Running top', 'Track jacket'],
  shoes: ['Sneakers', 'Trainers', 'Boots', 'Chelsea boots', 'Loafers', 'Heels', 'Sandals', 'Flats'],
  bags: ['Tote', 'Crossbody', 'Shoulder bag', 'Backpack', 'Clutch'],
  belts: ['Leather belt', 'Fabric belt'],
  jewelry: ['Necklace', 'Earrings', 'Ring', 'Bracelet', 'Watch'],
  hats: ['Cap', 'Beanie', 'Bucket hat', 'Wide brim'],
  scarves: ['Wool scarf', 'Silk scarf', 'Bandana'],
};

/** How a piece is called in a suggested name: "Camel coat", "White tee". */
export const CATEGORY_NOUN: Record<Category, string> = {
  tops: 'top',
  shirts: 'shirt',
  tshirts: 'tee',
  knitwear: 'jumper',
  dresses: 'dress',
  jackets: 'jacket',
  coats: 'coat',
  jeans: 'jeans',
  trousers: 'trousers',
  skirts: 'skirt',
  shorts: 'shorts',
  underwear: 'underwear',
  socks: 'socks',
  activewear: 'activewear',
  shoes: 'shoes',
  bags: 'bag',
  belts: 'belt',
  jewelry: 'jewellery',
  hats: 'hat',
  scarves: 'scarf',
};

export const PATTERNS = ['Solid', 'Stripe', 'Check', 'Floral', 'Dots', 'Print', 'Textured'] as const;

export const MATERIALS = [
  'Cotton',
  'Linen',
  'Wool',
  'Cashmere',
  'Silk',
  'Denim',
  'Leather',
  'Suede',
  'Viscose',
  'Polyester',
  'Nylon',
] as const;

/** Materials that read naturally in a name ("Camel wool coat"). */
export const NAMING_MATERIALS = new Set(['Linen', 'Wool', 'Cashmere', 'Silk', 'Denim', 'Leather', 'Suede']);

const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'One size'];
const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44'];
const WAIST_SIZES = ['24', '26', '28', '30', '32', '34'];

/** Size chips that fit the category; any other size can be typed. */
export function sizeOptions(category: Category | null): string[] {
  if (!category) return LETTER_SIZES;
  if (category === 'shoes') return SHOE_SIZES;
  if (category === 'jeans' || category === 'trousers') return [...WAIST_SIZES, ...LETTER_SIZES.slice(0, 5)];
  if (CATEGORY_DEFAULT_ZONE[category] === 'accessories') return ['One size', 'S', 'M', 'L'];
  return LETTER_SIZES;
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'INR', 'LKR'] as const;

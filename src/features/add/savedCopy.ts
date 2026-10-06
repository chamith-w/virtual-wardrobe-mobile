/**
 * The words on the "saved" screen after a piece is added. Pure — safe to
 * import from tests.
 */
import { CATEGORY_GROUP, GROUP_LABEL, type Category, type Season, type ZoneType } from '@/features/items/catalog';
import { seasonsLabel } from '@/features/items/describe';

const HEADLINE: Record<ZoneType, string> = {
  rail: 'Hung on the rail.',
  shelf: 'Folded on the shelf.',
  drawer: 'Tucked in a drawer.',
  shoes: 'On the shoe rack.',
  accessories: 'In the tray.',
};

export function savedHeadline(zone: ZoneType | null): string {
  return zone ? HEADLINE[zone] : 'In your wardrobe.';
}

/** "Camel wool coat is in your Home wardrobe. Filed under Outerwear, for autumn and winter." */
export function savedBody(piece: {
  name: string;
  wardrobeName: string;
  category: Category;
  seasons: readonly Season[];
}): string {
  const group = GROUP_LABEL[CATEGORY_GROUP[piece.category]];
  const seasons = seasonsLabel(piece.seasons);
  const when =
    seasons === 'All year' ? 'for any season' : `for ${seasons.toLowerCase().replace(/, ([^,]*)$/, ' and $1')}`;
  return `${piece.name} is in your ${piece.wardrobeName} wardrobe. Filed under ${group}, ${when}.`;
}

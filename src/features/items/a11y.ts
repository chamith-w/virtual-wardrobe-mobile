/**
 * Screen-reader actions on a piece in the closet or grid: the accessible
 * alternative to dragging it onto the laundry basket.
 */
import type { AccessibilityActionInfo } from 'react-native';

import { backInWardrobe, sendToLaundry } from './actions';
import type { ItemStatus } from './catalog';
import { isOut } from './status';

type Piece = { id: string; name: string; status: ItemStatus; lentTo: string | null };

export function pieceActions(
  item: Piece,
  options: { selectable?: boolean } = { selectable: true },
): AccessibilityActionInfo[] {
  const actions: AccessibilityActionInfo[] = [];
  if (isOut(item.status)) actions.push({ name: 'back', label: 'Back in wardrobe' });
  if (item.status === 'in_wardrobe' || item.status === 'worn')
    actions.push({ name: 'laundry', label: 'Send to laundry' });
  if (options.selectable) actions.push({ name: 'select', label: 'Select' });
  return actions;
}

export function runPieceAction(item: Piece, action: string, onSelect?: () => void) {
  if (action === 'back') backInWardrobe(item);
  else if (action === 'laundry') sendToLaundry(item);
  else if (action === 'select') onSelect?.();
}

import { useState, type RefObject } from 'react';
import { useWindowDimensions, View } from 'react-native';

import {
  AnimatedPressable,
  Button,
  CheckBadge,
  Cutout,
  SearchField,
  Sheet,
  Text,
  type SheetRef,
} from '@/components/ui';
import { CATEGORY_LABEL } from '@/features/items/catalog';
import type { LookItem } from '@/features/suggestions/useLookItems';
import { haptics } from '@/lib/haptics';

/** At most this many tiles; search narrows the rest (as "Lend something" does). */
const SHOWN = 48;

function PickerBody({ candidates, onAdd }: { candidates: readonly LookItem[]; onAdd: (ids: string[]) => void }) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = candidates
    .filter((p) => {
      const hay = [p.name, CATEGORY_LABEL[p.category], ...p.colors.map((c) => c.name)].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .slice(0, SHOWN);
  const tile = Math.floor((width - 40 - 3 * 8) / 4);
  const n = picked.size;

  return (
    <View>
      <SearchField
        inSheet
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${candidates.length} pieces`}
        accessibilityLabel="Search pieces"
      />
      <View className="mt-3 flex-row flex-wrap gap-2">
        {matches.map((p) => {
          const on = picked.has(p.id);
          return (
            <AnimatedPressable
              key={p.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.name}
              haptic="none"
              onPress={() => {
                haptics.tap();
                setPicked((prev) => {
                  const next = new Set(prev);
                  if (on) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                });
              }}
              scaleTo={0.94}
              className={[
                'items-center justify-center rounded-[16px] bg-surface-tinted',
                on ? 'border-2 border-ink' : '',
              ].join(' ')}
              style={{ width: tile, height: tile * 1.15 }}
            >
              <Cutout uri={p.thumbUri} width={tile * 0.72} height={tile * 0.86} />
              {on ? (
                <View className="absolute right-1 top-1">
                  <CheckBadge />
                </View>
              ) : null}
            </AnimatedPressable>
          );
        })}
      </View>
      {matches.length === 0 ? (
        <Text variant="bodySm" tone="muted" className="mt-2">
          Nothing matches “{query.trim()}”.
        </Text>
      ) : null}
      <Button
        label={n === 0 ? 'Pick what you wore' : `Add ${n} ${n === 1 ? 'piece' : 'pieces'}`}
        fullWidth
        disabled={n === 0}
        className="mt-5"
        onPress={() => onAdd([...picked])}
      />
    </View>
  );
}

/** Add pieces to a log that weren't in the outfit (a swap). Opens on top of the log sheet. */
export function PiecePickerSheet({
  ref,
  candidates,
  onAdd,
}: {
  ref: RefObject<SheetRef | null>;
  candidates: readonly LookItem[];
  onAdd: (ids: string[]) => void;
}) {
  return (
    <Sheet ref={ref} eyebrow="Log" title="Add what you wore" snapPoints={['80%']} scrollable stackBehavior="push">
      <PickerBody candidates={candidates} onAdd={onAdd} />
    </Sheet>
  );
}

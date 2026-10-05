import { router } from 'expo-router';
import { Heart, Plus, Shuffle, Sparkles, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Screen,
  Segmented,
  Sheet,
  Skeleton,
  Swatch,
  Text,
  Toggle,
  type SheetRef,
} from '@/components/ui';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FASHION_PALETTE } from '@/lib/color';
import { haptics, type HapticName } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { colorTokenNames, typography, type TypeVariant } from '@/theme/tokens';

const SAMPLE: Record<TypeVariant, string> = {
  display1: 'Display 40',
  display2: 'Display 34',
  display3: 'Display 28',
  title1: 'Title 22',
  title2: 'Title 18',
  body: 'Body 16 — the quick camel coat',
  bodySm: 'Body 14 — worn 23 times',
  caption: 'Caption 12 · last worn 6 days ago',
  eyebrow: 'Eyebrow 11',
};

/** Living reference for the Phase 1 primitives. Opened from Me → Design system. */
export default function DesignSystemScreen() {
  const { colors, scheme, setPreference } = useTheme();
  const [chips, setChips] = useState<Record<string, boolean>>({ Minimal: true, Tailored: true });
  const [swatch, setSwatch] = useState('Camel');
  const [seg, setSeg] = useState<'closet' | 'grid' | 'outfits'>('closet');
  const [toggle, setToggle] = useState(true);
  const sheet = useRef<SheetRef>(null);

  return (
    <Screen tabBarInset={false} className="px-5">
      <View className="h-11 flex-row items-center justify-between">
        <Text variant="eyebrow">Design system · {scheme}</Text>
        <IconButton icon={X} accessibilityLabel="Close" onPress={() => router.back()} />
      </View>
      <Text variant="display1" accessibilityRole="header" className="mt-2">
        Editorial{'\n'}Boutique
      </Text>
      <View className="mt-4 flex-row gap-2">
        <Button
          label="Light"
          size="sm"
          variant={scheme === 'light' ? 'primary' : 'secondary'}
          onPress={() => setPreference('light')}
        />
        <Button
          label="Dark"
          size="sm"
          variant={scheme === 'dark' ? 'primary' : 'secondary'}
          onPress={() => setPreference('dark')}
        />
        <Button label="System" size="sm" variant="ghost" onPress={() => setPreference('system')} />
      </View>

      <SectionHeader title="Type" />
      <View className="gap-3">
        {(Object.keys(typography) as TypeVariant[]).map((v) => (
          <Text key={v} variant={v}>
            {SAMPLE[v]}
          </Text>
        ))}
        <Text variant="display2" italic>
          Fraunces italic
        </Text>
      </View>

      <SectionHeader title="Colour tokens" meta={`${colorTokenNames.length} per scheme`} />
      <View className="flex-row flex-wrap gap-2">
        {colorTokenNames.map((t) => (
          <View key={t} className="w-[31%] gap-1.5 rounded-sm border border-line bg-surface p-2">
            <View className="h-10 rounded-[8px] border border-line" style={{ backgroundColor: colors[t] }} />
            <Text variant="caption" weight="semibold" numberOfLines={1}>
              {t}
            </Text>
            <Text variant="caption" style={{ fontSize: 10 }}>
              {colors[t]}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Buttons" />
      <View className="gap-2.5">
        <Button label="Wear this" fullWidth />
        <Button label="Load demo wardrobe" variant="accent" fullWidth />
        <View className="flex-row flex-wrap gap-2">
          <Button label="Add another" variant="secondary" />
          <Button label="Later" variant="ghost" />
          <Button label="Archive" variant="danger" />
          <Button label="New outfit" size="sm" variant="accent" icon={Plus} />
          <Button label="Disabled" size="sm" disabled />
        </View>
        <View className="flex-row gap-2">
          <IconButton icon={Shuffle} accessibilityLabel="Shuffle" />
          <IconButton icon={Heart} accessibilityLabel="Favourite" variant="tinted" />
          <IconButton icon={Sparkles} accessibilityLabel="Suggest" variant="inverse" />
          <IconButton icon={Plus} accessibilityLabel="Add" variant="accent" />
        </View>
      </View>

      <SectionHeader title="Chips" />
      <View className="flex-row flex-wrap gap-2">
        {['Minimal', 'Tailored', 'Classic', 'Streetwear', 'Romantic', 'Sporty'].map((label) => (
          <Chip
            key={label}
            label={label}
            selected={!!chips[label]}
            onPress={() => setChips((c) => ({ ...c, [label]: !c[label] }))}
          />
        ))}
        <Chip label="In laundry" dotColor={colors.accentSecondary} />
        <Chip label="Lent · Nadia" dotColor={colors.accent} />
        <Chip label="Camel" swatch="#B98B5E" count={4} />
      </View>

      <SectionHeader title="Swatches" meta={swatch} />
      <View className="flex-row flex-wrap gap-1">
        {FASHION_PALETTE.slice(0, 12).map((c) => (
          <Swatch
            key={c.name}
            hex={c.hex}
            name={c.name}
            selected={swatch === c.name}
            onPress={() => setSwatch(c.name)}
          />
        ))}
      </View>

      <SectionHeader title="Controls" />
      <Segmented
        accessibilityLabel="Wardrobe view"
        value={seg}
        onChange={setSeg}
        options={[
          { value: 'closet', label: 'Closet' },
          { value: 'grid', label: 'Grid' },
          { value: 'outfits', label: 'Outfits' },
        ]}
      />
      <View className="mt-4 flex-row items-center justify-between">
        <Text variant="body">Remind me to ask for it back</Text>
        <Toggle value={toggle} onValueChange={setToggle} accessibilityLabel="Remind me to ask for it back" />
      </View>

      <SectionHeader title="Cards" />
      <View className="gap-2.5">
        <Card>
          <Text variant="title2">Surface card</Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            White on cream, hairline edge.
          </Text>
        </Card>
        <Card tone="tinted" onPress={() => {}} accessibilityLabel="Pressable tinted card">
          <Text variant="title2">Tinted, pressable</Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            Springs on press with a haptic tick.
          </Text>
        </Card>
        <Card tone="secondary" radius="lg">
          <Text variant="eyebrow" tone="onAccentSecondary">
            Best cost per wear
          </Text>
          <Text variant="display2" tone="onAccentSecondary" className="mt-2">
            $0.70
          </Text>
        </Card>
      </View>

      <SectionHeader title="Skeletons" />
      <View className="flex-row gap-3">
        <Skeleton width={96} height={120} radius={20} />
        <View className="flex-1 justify-center gap-2.5">
          <Skeleton width="80%" height={18} radius={8} />
          <Skeleton width="55%" height={12} radius={6} />
          <Skeleton width="65%" height={12} radius={6} />
        </View>
      </View>

      <SectionHeader title="Empty states" />
      <View className="gap-3">
        <EmptyState
          title="The rail is bare"
          body="Add a piece, or drag one here."
          actionLabel="Add a piece"
          actionIcon={Plus}
          onAction={() => router.push('/add')}
        />
        <EmptyState illustration="basket" title="Basket’s empty" body="Everything’s clean and back on the rail." />
        <EmptyState outlined illustration="shelf" title="Nothing on this shelf" />
      </View>

      <SectionHeader title="Sheet & haptics" />
      <View className="flex-row flex-wrap gap-2">
        <Button label="Open sheet" size="sm" onPress={() => sheet.current?.present()} />
        {(['itemAdded', 'statusChanged', 'dropSuccess', 'declutterSwipe'] as HapticName[]).map((h) => (
          <Button key={h} label={h} size="sm" variant="secondary" haptic="none" onPress={() => haptics[h]()} />
        ))}
      </View>

      <Sheet ref={sheet} eyebrow="Status" title="Camel wool coat">
        <View className="flex-row flex-wrap gap-2">
          {['In wardrobe', 'Worn', 'In laundry', 'Dry cleaner', 'Lent', 'In storage'].map((s, i) => (
            <Chip key={s} label={s} selected={i === 0} />
          ))}
        </View>
        <View className="mt-5 flex-row gap-2.5">
          <Button label="Open details" className="flex-1" />
          <Button label="Wear today" variant="secondary" className="flex-1" onPress={() => sheet.current?.dismiss()} />
        </View>
      </Sheet>
    </Screen>
  );
}

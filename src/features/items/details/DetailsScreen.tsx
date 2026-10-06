import type { LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Text } from '@/components/ui';
import type { ItemColor } from '@/db/schema';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';

import { draftToFields, validateDraft, type DraftFields, type ItemDraft } from './draft';
import { ItemDetailsForm } from './ItemDetailsForm';
import { useVocabulary } from './useVocabulary';

export type DetailsScreenProps = {
  title: string;
  leading: { icon: LucideIcon; label: string; onPress: () => void };
  draft: ItemDraft;
  onChange: (draft: ItemDraft) => void;
  previewUri: string | null;
  detected?: ItemColor[];
  submitLabel: string;
  submitting: boolean;
  onSubmit: (fields: DraftFields) => void;
};

/**
 * The details form as a full screen: header, keyboard-aware scroll and a
 * pinned save bar. Errors appear only after a first save attempt.
 */
export function DetailsScreen({
  title,
  leading,
  draft,
  onChange,
  previewUri,
  detected,
  submitLabel,
  submitting,
  onSubmit,
}: DetailsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [tried, setTried] = useState(false);
  const { brands, tags } = useVocabulary();
  const errors = tried ? validateDraft(draft) : {};

  const submit = () => {
    const fields = draftToFields(draft);
    if (!fields) {
      setTried(true);
      haptics.warning();
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    onSubmit(fields);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <View className="h-11 flex-row items-center justify-between px-4" style={{ marginTop: insets.top + 4 }}>
        <IconButton icon={leading.icon} accessibilityLabel={leading.label} onPress={leading.onPress} />
        <Text variant="title2" accessibilityRole="header">
          {title}
        </Text>
        <View className="w-11" />
      </View>
      <ScrollView
        ref={scroll}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
      >
        <ItemDetailsForm
          draft={draft}
          onChange={onChange}
          errors={errors}
          previewUri={previewUri}
          detected={detected}
          brands={brands}
          knownTags={tags}
        />
      </ScrollView>
      <View className="border-t border-line bg-background px-5 pt-3.5" style={{ paddingBottom: insets.bottom + 14 }}>
        <Button
          label={submitting ? 'Saving…' : submitLabel}
          variant="accent"
          fullWidth
          disabled={submitting}
          onPress={submit}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useReducer, useRef, useState } from 'react';

import type { SheetRef } from '@/components/ui';
import type { Category } from '@/features/items/catalog';
import { DetailsScreen } from '@/features/items/details/DetailsScreen';
import { emptyDraft, type DraftFields, type ItemDraft } from '@/features/items/details/draft';
import { toItemColors } from '@/lib/color-extract';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { useWardrobeView } from '@/store/wardrobeView';
import { SchemeScope } from '@/theme/ThemeProvider';

import { CaptureView } from './capture/CaptureView';
import { classifyGarment, isConfident } from './classify';
import { addFlow, batchLabel, currentShot, initialAddState, remaining, type SavedPiece } from './flow';
import { CategoryPickSheet } from './review/CategoryPickSheet';
import { CutoutReview } from './review/CutoutReview';
import { SavedView } from './saved/SavedView';
import { saveNewPiece } from './save';
import { segmentationStatus, type EngineId } from './segmentation';
import { useShotProcessing } from './useShotProcessing';

function captionFor(engine: EngineId | null | undefined): string {
  if (engine === undefined || engine === 'device') return 'Background removed on device';
  if (engine === 'remove.bg') return 'Background removed by remove.bg · dev';
  return 'Background removal needs a real phone';
}

/**
 * The "+" flow (docs/design/AddItem.dc.html): capture → magic cutout →
 * details → fly-in, looping through a batch of gallery photos. The route is a
 * native full-screen modal, so it hosts its own bottom-sheet provider.
 */
export function AddFlow() {
  return (
    <BottomSheetModalProvider>
      <Flow />
    </BottomSheetModalProvider>
  );
}

function Flow() {
  const currency = usePreferences((s) => s.currency);
  const [state, dispatch] = useReducer(addFlow, initialAddState);
  const shot = state.step === 'cutout' || state.step === 'details' ? currentShot(state) : null;
  const { state: processing, retry } = useShotProcessing(shot);

  const [engine, setEngine] = useState<EngineId | null | undefined>(undefined);
  const [keep, setKeep] = useState({ shotId: '', value: false });
  const [draft, setDraft] = useState<{ shotId: string; value: ItemDraft } | null>(null);
  const [suggested, setSuggested] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const pickSheet = useRef<SheetRef>(null);

  useEffect(() => {
    segmentationStatus()
      .then((s) => setEngine(s.engine))
      .catch(() => setEngine(null));
  }, []);

  const shotId = shot?.id ?? '';
  const done = processing.phase === 'done' ? processing : null;
  const keepOriginal = (keep.shotId === shotId && keep.value) || (done !== null && !done.cutout);
  const currentDraft = draft && draft.shotId === shotId ? draft.value : null;

  const startDetails = (category: Category | null) => {
    if (!done) return;
    setDraft({
      shotId,
      value: emptyDraft(currency, { category, colors: toItemColors(done.colors) }),
    });
    dispatch({ type: 'details' });
  };

  const onContinue = async () => {
    if (!done) return;
    // Back from details: keep what was typed.
    if (currentDraft) {
      dispatch({ type: 'details' });
      return;
    }
    const image = done.cutout ?? done.photo;
    const guess = await classifyGarment({
      imageUri: done.cutout?.cutoutUri ?? done.photo.uri,
      width: image.width,
      height: image.height,
      colors: toItemColors(done.colors),
    });
    if (guess && isConfident(guess)) {
      startDetails(guess.category);
      return;
    }
    setSuggested(guess?.category ?? null);
    pickSheet.current?.present();
  };

  const onSave = async (fields: DraftFields) => {
    if (!done || saving) return;
    setSaving(true);
    try {
      const piece = await saveNewPiece({ photo: done.photo, cutout: done.cutout, keepOriginal, fields });
      setDraft(null);
      dispatch({ type: 'saved', piece });
    } catch {
      haptics.warning();
      toast('Couldn’t save it. Try again.', 'info');
    } finally {
      setSaving(false);
    }
  };

  const viewInWardrobe = (piece: SavedPiece) => {
    useSession.getState().setActiveWardrobe(piece.wardrobeId);
    const view = useWardrobeView.getState();
    view.setMode('closet');
    view.clearAll();
    router.dismissTo('/wardrobe');
  };

  if (state.step === 'capture') {
    return (
      <SchemeScope scheme="dark">
        <StatusBar style="light" />
        <CaptureView
          caption={captionFor(engine)}
          onCaptured={(shots) => dispatch({ type: 'captured', shots })}
          onClose={() => router.back()}
        />
      </SchemeScope>
    );
  }

  if (state.step === 'saved') {
    const piece = state.saved[state.saved.length - 1];
    if (!piece) return null;
    return (
      <SavedView
        key={piece.id}
        piece={piece}
        remaining={remaining(state)}
        batchLabel={batchLabel(state)}
        onNext={() => dispatch({ type: 'next' })}
        onDone={() => router.back()}
        onAddAnother={() => dispatch({ type: 'again' })}
        onViewWardrobe={() => viewInWardrobe(piece)}
      />
    );
  }

  if (state.step === 'details' && currentDraft && done) {
    return (
      <DetailsScreen
        title="Details"
        leading={{ icon: ChevronLeft, label: 'Back to the cutout', onPress: () => dispatch({ type: 'back' }) }}
        draft={currentDraft}
        onChange={(value) => setDraft({ shotId, value })}
        previewUri={keepOriginal ? done.photo.uri : (done.cutout?.cutoutUri ?? done.photo.uri)}
        detected={toItemColors(done.colors)}
        submitLabel="Save to wardrobe"
        submitting={saving}
        onSubmit={onSave}
      />
    );
  }

  return (
    <>
      <CutoutReview
        key={shotId}
        state={processing}
        keepOriginal={keepOriginal}
        onKeepOriginal={(value) => setKeep({ shotId, value })}
        batchLabel={batchLabel(state)}
        onRetake={() => dispatch({ type: 'retake' })}
        onSkip={state.shots.length > 1 ? () => dispatch({ type: 'skip' }) : null}
        onRetry={retry}
        onContinue={onContinue}
      />
      <CategoryPickSheet
        ref={pickSheet}
        suggested={suggested}
        onPick={(category) => {
          pickSheet.current?.dismiss();
          startDetails(category);
        }}
      />
    </>
  );
}

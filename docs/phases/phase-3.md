# Phase 3: Add item

> Paste into Claude Code from the project root, or run `/phase 3`.

---

Build **phase 3 of My Closet**: the "+" flow that turns a photo into a hung garment.

**Read first:** `docs/SPEC.md` §4 Add item and "Motion and interaction principles"; `docs/DESIGN.md` signature moments 3 (magic cutout) and 4 (fly-in); prototype `docs/design/AddItem.dc.html`.

**Audit first.** List what already exists that this phase can reuse: mutations, `Cutout`, zone placement, detail sheets, haptics.

## Decide before coding (ask me)

1. **Background removal.** We need on-device subject segmentation: the iOS Vision foreground instance mask (`VNGenerateForegroundInstanceMaskRequest`, iOS 17+) and Android ML Kit Subject Segmentation. Research maintained Expo modules or community libraries that support **Expo SDK 57 / the New Architecture**. Give me 2–3 options with trade-offs, one of which is writing our own local Expo Module in `modules/subject-segmentation` (Swift plus Kotlin, Expo Modules API) that returns a PNG with alpha. Note that the ML Kit model downloads through Play services on first use, so we need a "preparing" state.
2. **Onboarding.** Do I want it built in this phase (next to the camera-permission flow) or in phase 8? Default: phase 8.

## Build

**Capture (`src/app/add.tsx`, full-screen modal)**

- [ ] `expo-camera` preview with a garment-outline guide overlay (hanger and flat-lay modes), flash toggle, shutter and flip camera.
- [ ] Camera permission requested on the first add only, behind a branded explainer card. A denied state links to Settings.
- [ ] Gallery: `expo-image-picker` with multi-select. Several photos become a batch queue ("1 of 4").

**Background removal**

- [ ] One interface in `src/features/add/segmentation/`: `removeBackground(uri) → { cutoutUri, width, height }`.
  - On-device implementation as the default.
  - A remove.bg adapter, enabled only when `EXPO_PUBLIC_REMOVE_BG_KEY` is set. Flag in code that a client-side key is extractable and dev-only.
- [ ] A "Keep original" toggle (always save `originalUri`).
- [ ] The magic cutout animation (DESIGN.md #3): shimmer sweep while processing, background dissolve, the garment lifting with its silhouette shadow.
- [ ] Stretch goal: an eraser/restore brush on the mask using Skia paths. If skipped, leave a typed stub and note it.

**Auto-detect**

- [ ] Colour extraction as pure functions in `src/lib/color-extract.ts`:
  - Downsample to about 64px and ignore pixels with alpha < 128.
  - k-means (k ≤ 3) in LAB; drop clusters under ~8% coverage.
  - Map each cluster to `FASHION_PALETTE` by ΔE (CIEDE2000 preferred) and return 1–3 `{ hex, name }`.
  - Read pixels with Skia (`Image.readPixels`).
- [ ] `classifyGarment(input): Promise<{ category; confidence } | null>`, pluggable. The default returns null, which triggers a quick-pick sheet of large category chips.

**Details sheet (reused by Edit on item detail)**

- [ ] Mostly chips: category/subcategory, colours (detected ones preselected, plus the palette), pattern, material, seasons, occasions, size.
- [ ] Text fields: name (suggested from colour and category, e.g. "Camel coat"), brand (autocomplete from existing brands), price and currency, purchase date, store, care notes, tags.
- [ ] For the date picker, use `npx expo install @react-native-community/datetimepicker` (a native rebuild) or a chip-based month picker. Say which.

**Save**

- [ ] With `expo-image-manipulator` (check the SDK 57 API and that alpha survives), write `documents/items/<id>/` with `thumb` (~400px) and `cutout` (~1200px) as WebP or PNG with alpha.
- [ ] Insert the item into its default zone and fire the `itemAdded` haptic.
- [ ] Fly-in (DESIGN.md #4): the cutout shrinks and flies into its zone, then the hanger swings. Offer "Add another" and "View in wardrobe".
- [ ] Item detail → Edit opens the same details sheet.

## Tests

Colour extraction and naming (LAB conversion, ΔE, cluster filtering on synthetic pixel arrays), path naming, form validation and defaults, and the classify fallback.

## Done when

- `npm run check` passes.
- On a real phone in airplane mode: photographing a garment produces a clean cutout, sensible colour chips, a saved item in the right zone with a fly-in, and correct thumbnails in Grid.
- Gallery multi-add works.
- Denied camera permission is handled gracefully.

Then update `docs/PROGRESS.md`, stop and report. Say clearly whether `npm run ios` / `npm run android` is needed (a new native module or the date picker means yes). Commit only when I ask.

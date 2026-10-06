# Phase 5: Outfits

> Paste into Claude Code from the project root, or run `/phase 5`.

---

Build **phase 5 of My Closet**: the outfit builder and the outfits list.

**Read first:** `docs/SPEC.md` §6 Outfit builder; `docs/DESIGN.md`; prototypes `docs/design/OutfitBuilder.dc.html` (canvas, handle, snap guides, lock, shuffle, trash) and `Grid.dc.html` (Outfits segment).

**Audit first.** `features/outfits/` (`useOutfits`, `mutations`, `OutfitPreview`) and `features/items/matches.ts` exist. Report done / partial / missing.

## Build

**Route**

- [ ] `src/app/outfit/[id].tsx`, where `new` creates an outfit and `?item=<id>` preloads one piece.
- [ ] Wire the entry points: item detail "Add to outfit", Today "Edit", outfits list.

**Canvas**

- [ ] A neutral board (`bg-board`, faint dot grid) with pieces rendered through `Cutout`.
- [ ] Gesture Handler v2: Pan, Pinch and Rotation running **simultaneously** on the selected piece; Tap selects. Everything runs on the UI thread.
- [ ] The selected piece gets a dashed outline and a corner handle (drag to scale and rotate), plus a floating toolbar: lock, bring forward, send back, remove.
- [ ] Snap guides to the canvas centre lines and to other pieces' centres and edges (within 8pt), with a light haptic on snap.
- [ ] A trash zone that rises while dragging; dropping on it removes the piece with a haptic.
- [ ] Optional: single-step undo.

**Tray**

- [ ] A bottom tray with category tabs (Tops, Bottoms, Layers, Dresses, Shoes, Accessories), showing only available (in-wardrobe) pieces.
- [ ] Tapping or dragging a piece up places it on the canvas with a spring pop.

**Shuffle and lock**

- [ ] Each piece has a lock.
- [ ] Shuffle replaces unlocked pieces with compatible alternatives: same role, available, colour-harmony aware (reuse `matches.ts`; phase 6's engine can take over later). Pieces swap in with a pop.

**Save**

- [ ] A save sheet for name, occasion and season tags.
- [ ] Store normalised `x`, `y`, `scale`, `rotation`, `zIndex` and `locked` in `outfit_items`.
- [ ] Render a snapshot PNG of the canvas into `documents/outfits/<id>.png` (`snapshotUri`). Prefer Skia `makeImageFromView` (check the API in Skia 2.6); fall back to `react-native-view-shot`, which needs `npx expo install` and a rebuild.
- [ ] Fire the `outfitSaved` haptic.
- [ ] Editing an existing outfit re-renders its snapshot.

**Outfits list (Wardrobe → Outfits)**

- [ ] A masonry FlashList of snapshots. Seeded outfits have no snapshot, so render a live mini-composition and generate the snapshot lazily.
- [ ] Filters for occasion, season and favourites; a favourite toggle.
- [ ] A long-press menu: duplicate, delete (soft), plan for a day (that hand-off finishes in phase 6).

## Tests

Normalised ↔ canvas coordinate maths (round trip), snap-guide detection, z-order operations, and shuffle selection (respects locks, availability and roles; never duplicates a piece).

## Done when

- `npm run check` passes.
- On a mid-range Android device (or the emulator) the canvas feels smooth.
- Building an outfit from the tray, scaling, rotating, snapping, locking, shuffling and saving all work, and it appears in the Outfits list with its snapshot.
- Reopening it restores the layout exactly.

Then update `docs/PROGRESS.md`, stop and report, including whether a native rebuild is needed. Commit only when I ask.

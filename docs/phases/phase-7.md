# Phase 7: Me hub

> Paste into Claude Code from the project root, or run `/phase 7`.

---

Build **phase 7 of My Closet**: the Me hub, with insights, declutter, packing lists, seasonal rotation, the wishlist, notifications, settings and backup.

**Read first:** `docs/SPEC.md` §8 Me hub; `docs/DESIGN.md`; prototypes `docs/design/Me.dc.html`, `Declutter.dc.html`, `Packing.dc.html` and `Laundry.dc.html`.

**Audit first.** The laundry, lent and dry-cleaner screens (phase 4), the weather service (phase 6) and the settings rows on Me already exist. Report done / partial / missing.

## Build

**Hub layout**

- [ ] A header with counts.
- [ ] Tiles for Laundry, Lent, Dry cleaner, Declutter, Packing, Wishlist and Seasonal rotation.
- [ ] Then Insights, then Settings.

**Insights (victory-native, Skia)**

- [ ] A colour palette ring of the wardrobe by colour share; tap a segment to focus it.
- [ ] Category breakdown.
- [ ] Most and least worn.
- [ ] Best cost per wear.
- [ ] Percentage of the wardrobe worn in the last 30 and 90 days.
- [ ] Spending per month (bars, tap a month).
- [ ] All maths as pure functions in `src/features/insights/compute.ts`. Charts follow the design tokens and stay readable in dark mode.

**Declutter**

- [ ] A swipeable card deck of pieces unworn for 90+ days (or never worn and added more than 90 days ago).
- [ ] Swipe right to Keep, left to Donate, up to Sell, down to Decide later, with stamps and the `declutterSwipe` haptic.
- [ ] Undo the last swipe; a summary at the end.
- [ ] Donate and Sell archive the piece with a reason; Keep snoozes it for 90 days.
- [ ] Buttons as the accessible alternative to swiping.

**Packing lists**

- [ ] Trips CRUD: name, destination (Open-Meteo geocoding), dates.
- [ ] The destination's forecast for the trip dates, or "too far out" when it's past the forecast window.
- [ ] Add single pieces or whole outfits; packed toggles with a progress ring.
- [ ] Suggestions from trip length and weather (e.g. tops ≈ nights; rain → a waterproof layer and closed shoes).
- [ ] A "Plan outfits for this trip" link into the Planner.

**Seasonal rotation**

- [ ] One action moves every piece tagged only for the off-season into the Storage wardrobe: preview the list, confirm, undo. A reverse action brings them back.

**Wishlist**

- [ ] Add by photo (reuse the phase 3 pipeline) or by link (URL, optional title and image).
- [ ] Price and notes.
- [ ] "Pairs with N items you own", using the engine's harmony scoring.
- [ ] "I bought it" turns the entry into a wardrobe item.

**Notifications**

- [ ] One place to manage local notifications (lent reminders, the optional plan-tomorrow reminder) with on/off toggles. Local only; the Personal Team setup means no push.

**Settings**

- [ ] Theme, currency, temperature units, reduce-motion override, the auto-laundry rules (phase 6).
- [ ] A **zone layout editor** to rename, reorder, add and remove zones per wardrobe.
- [ ] **Backup / export:**
  1. Checkpoint SQLite's WAL.
  2. Zip the DB file, `documents/items/`, `outfits/`, `wishlist/` and a `manifest.json` (app version, schema version, counts). Use `fflate` (pure JS).
  3. Share with `expo-sharing` (needs `npx expo install` and a rebuild).
- [ ] **Import:** pick the file with `expo-document-picker`, validate the manifest and schema version, confirm "replace all data", restore, then reopen the DB.

## Tests

The insight calculators, declutter queue selection and snooze, packing suggestions, seasonal-rotation selection, manifest creation and import validation (including a wrong-version zip being rejected).

## Done when

- `npm run check` passes.
- Insights match the seed data (spot-check two numbers by hand).
- Declutter swiping archives pieces correctly.
- A trip shows its forecast and suggestions.
- Rotation moves summer pieces to Storage and back.
- Export produces a zip that imports cleanly on a fresh install.

Then update `docs/PROGRESS.md`, stop and report, including whether a native rebuild is needed. Commit only when I ask.

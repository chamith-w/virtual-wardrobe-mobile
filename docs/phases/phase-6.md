# Phase 6: Today and Planner

> Paste into Claude Code from the project root, or run `/phase 6`.

---

Build **phase 6 of My Closet**: weather, the suggestion engine, the Today screen, the Planner and wear logging.

**Read first:** `docs/SPEC.md` §2 Today, §7 Planner and "Outfit suggestion engine"; `docs/DESIGN.md`; prototypes `docs/design/Today.dc.html` and `Planner.dc.html`.

**Audit first.** `features/planner/wearLog.ts` and `wearCache.ts`, plus `features/items/matches.ts`, exist. Reuse them and report done / partial / missing.

## Build

**Weather**

- [ ] Ask for location permission the first time weather is shown, behind an explainer card. Offer a manual city fallback using Open-Meteo geocoding.
- [ ] Open-Meteo forecast (no key): current temperature, feels-like, WMO weather code, precipitation probability, daily highs and lows. Expose a long-range forecast function for trips in phase 7.
- [ ] Units come from preferences. Cache the last result in the kv-store and show it offline with an "updated 3h ago" note. Use a Skeleton while loading.
- [ ] Map WMO codes to a summary and a lucide icon.

**Suggestion engine (pure TypeScript, `src/features/suggestions/`)**

- [ ] Follow the spec exactly:
  1. **Layers:** hot, mild, cold and rain thresholds from config.
  2. **Candidates:** top + bottom + shoes, or dress + shoes, plus any layers and an accessory, drawn only from available items.
  3. **Scoring:**
     - colour harmony: HSL; neutrals pair with everything; bonus for complementary and analogous hues; penalty for clashing saturated hues
     - season and occasion match
     - freshness: penalise anything worn in the last 7 days, boost under-worn pieces
     - a favourites bonus
  4. **Top 3 diverse:** no two outfits share more than one item.
- [ ] All weights live in `config.ts`. The engine is deterministic with a seed; Shuffle takes the next-best diverse candidate.
- [ ] Item detail → "Find matches" moves onto the engine.

**Today**

- [ ] Greeting and date in display type.
- [ ] A weather card: temperature, conditions, feels-like.
- [ ] A carousel of 3 suggested outfits, each with Wear this, Shuffle and Edit (Edit opens the builder).
- [ ] Quick tiles for laundry, lent and forgotten pieces, linking to their screens.
- [ ] A "Wear it again" nudge: one under-worn piece plus engine pairings.
- [ ] An upcoming-trip card.

**Planner**

- [ ] A week strip that springs open into a month calendar, with dots for planned and worn days.
- [ ] Drag an outfit from a dock onto a day, with the `dropSuccess` haptic.
- [ ] Tapping a day lets you pick an outfit or tap "Suggest" (the engine with that day's forecast).
- [ ] Past days read as an outfit journal: outfit, selfie, notes, weather.

**Log worn**

- [ ] Confirm the planned outfit or tick individual pieces; optionally add a mirror selfie (`expo-image-picker` camera). The day's weather attaches automatically.
- [ ] Logging increments `wearCount`, updates `lastWornAt` and sets each piece's status to **worn**. Deleting or undoing a log recomputes the caches.
- [ ] **Auto-laundry:** a per-category setting, "move to laundry after N wears", applied when logging. Defaults: tees, underwear, socks and activewear after 1; shirts after 2; knitwear after 3; jeans after 4; outerwear never. Edit the defaults in Me → Settings.
- [ ] Optional: a local "plan tomorrow's outfit" reminder.

## Tests

Unit tests for the engine, one per rule: layering per temperature band and rain, the harmony cases, freshness, favourites, the diversity constraint, and determinism. Also WMO mapping, unit conversion, the auto-laundry rule, and wear-log create/undo cache maths.

## Done when

- `npm run check` passes.
- Today shows real local weather (cached offline) and three sensible, different outfits that change with the temperature (add a debug temperature override in dev).
- Wear this logs the outfit and pieces go to worn or laundry per the rules.
- The Planner drag, suggest and journal flows work.

Then update `docs/PROGRESS.md`, stop and report, including whether a native rebuild is needed. Commit only when I ask.

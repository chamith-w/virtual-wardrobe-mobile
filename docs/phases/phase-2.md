# Phase 2: Wardrobe (finish and close out)

> Paste into Claude Code from the project root, or run `/phase 2`.

---

We're finishing **phase 2 of My Closet**: the Wardrobe tab and item detail.

**Read first:** `docs/SPEC.md` §3 Wardrobe, §5 Item detail and "Motion and interaction principles"; `docs/DESIGN.md`, signature moments 1 (doors), 2 (swaying hangers), 5 (colour-tinted detail) and 7 (empty hangers); prototypes `docs/design/Closet.dc.html`, `Grid.dc.html` and `ItemDetail.dc.html`.

**Much of this phase already exists.** See commits `1083fb1` ("Add closet flow and item actions") and `ef60baa`, uncommitted work in `src/app/(tabs)/wardrobe.tsx`, and `src/features/wardrobe/**` and `src/features/items/**`. **Start with an audit.** Compare the code against the checklist below and reply with a table of done / partial / missing before you write any code. Don't rebuild what works, and don't throw away my uncommitted changes in `wardrobe.tsx`.

## Checklist

**Closet view (direction A, stacked zones; tell me if I've switched to B or C)**

- [ ] Zones stacked vertically, each scrolling horizontally:
  - hanging rail: tops, shirts, dresses, jackets, coats, skirts
  - shelves as tinted bands: knitwear, tees, folded denim and trousers
  - drawers that spring open: underwear, socks, activewear
  - shoe rack
  - accessories tray
- [ ] New items go to their category's default zone (`CATEGORY_DEFAULT_ZONE`). Long-press and drag moves a piece to another zone; the move persists to `items.zoneId`, auto-scrolls near the edges and fires the `dropSuccess` haptic.
- [ ] Swaying hangers: tilt follows scroll velocity on the UI thread and settles with the sway spring (DESIGN.md #2).
- [ ] Wardrobe doors open the first time the tab is shown each session (DESIGN.md #1); with Reduce Motion they fade instead.
- [ ] Pieces that are out show an empty hanger or ghost outline with a status tag (DESIGN.md #7).

**Grid view**

- [ ] Masonry grid on FlashList v2, with thumbnails only, memoised cells and dimmed tiles plus a tag for pieces that are out.
- [ ] The Outfits segment shows saved outfits (a basic list; the builder is phase 5).

**Search, filter, sort (shared by Closet and Grid)**

- [ ] Text search across name, brand and colour name.
- [ ] Filter chips for category, colour swatches, season, occasion, status and brand. Non-matching pieces dim in Closet and are hidden in Grid.
- [ ] Sort sheet: recent, most worn, least worn, cost per wear, colour (hue order, neutrals grouped).
- [ ] Wardrobe switcher (Home, Storage, + New).

**Cutout rendering**

- [ ] A shared `Cutout` component with a Skia silhouette shadow built from the image's alpha mask, not a box shadow. Thumbnails in lists; the full ~1200px cutout only on detail.

**Item detail**

- [ ] A real route, `src/app/item/[id].tsx`, reached from Closet, Grid and the quick sheet, with a shared-element-style transition from the thumbnail. Use Reanimated shared transitions if they're stable in the installed version; otherwise build a custom overlay transition.
- [ ] Background tinted from the garment's dominant colour (`mixHex`, DESIGN.md #5), cross-fading when paging between items.
- [ ] Pinch to zoom, double-tap zoom, and a flip to the original photo (hidden when there's no `originalUri`).
- [ ] Stats: times worn, last worn, cost per wear, days since added.
- [ ] Status switcher: In wardrobe / Worn / In laundry / Dry cleaner / Lent (who and since) / In storage.
- [ ] Actions:
  - Wear today
  - Add to outfit (routes to a placeholder until phase 5)
  - Find matches
  - Edit (a minimal name/category editor for now; the full details sheet is phase 3)
  - Move to another wardrobe
  - Archive as donated, sold or discarded, with a reason
- [ ] A list of the outfits that include this item.

## Notes

- `docs/PROGRESS.md` is stale. Record what the earlier commits built, plus these decisions:
  - The bundle ID is now `com.chamithwijesooriya.mycloset`.
  - `plugins/withoutPushEntitlement.js` strips the push capability so a free Personal Team can sign the app. Local notifications only.
- Out of scope: the camera/add flow (phase 3), the laundry screen and the "wash done" animation (phase 4), and the outfit builder (phase 5).

## Tests

Extend the existing tests in `filters`, `closet`, `stats`, `status`, `placement` and `matches` to cover anything new: sort orders (especially colour), CPW edge cases (no price, zero wears) and zone moves.

## Done when

- `npm run check` passes.
- On the simulator:
  - The doors play once.
  - The rail sways and settles.
  - Dragging a coat to the shelves persists after a restart.
  - Filters and sort behave the same in Closet and Grid.
  - Tapping any piece opens a tinted detail screen with working zoom, flip and status changes.
  - Out pieces show empty hangers.
  - Both themes and Reduce Motion look right.

Then update `docs/PROGRESS.md`, stop, and report what you built, your decisions, and whether `npm run ios` is needed. Commit only when I ask.

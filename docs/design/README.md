# Design prototypes

These are the source files of the interactive design canvas (Design Component `.dc.html` files). They are **reference material**, not app code, and they don't run on their own. Each one is an HTML template plus a small `class Component` script.

Use them for:

- **Layout and spacing:** absolute sizes on a 390×844 artboard.
- **Copy:** labels, empty-state text, button wording.
- **Motion values:** CSS keyframes and the spring constants in the scripts (also summarised in `docs/DESIGN.md`).
- **Behaviour:** what each tap does, such as status changes, drag to basket, swipe thresholds or shuffle.
- **Garment silhouettes:** the `lib()` path library, which `scripts/generate-assets.mjs` reuses for the demo cutouts.

To see them rendered and clickable, open the canvas: https://claude.ai/artifact/9DHnP8N1L9qLAufYUJ1SMt

| File | Screen |
|---|---|
| `Main.dc.html` | 01 Onboarding |
| `Today.dc.html` | 02 Today |
| `Closet.dc.html` | 03 Wardrobe: Closet, direction A (stacked zones, doors, sway, drag to basket) |
| `Grid.dc.html` | 04 Wardrobe: Grid and Outfits (masonry, filters, sort sheet) |
| `ItemDetail.dc.html` | 05 Item detail (tint, flip, zoom, status, archive) |
| `AddItem.dc.html` | 06 Add item (capture, magic cutout, details, fly-in) |
| `OutfitBuilder.dc.html` | 07 Outfit builder (drag, scale/rotate handle, snap guides, lock, shuffle, trash) |
| `Planner.dc.html` | 08 Planner (week/month, drag outfit to day, log worn) |
| `Me.dc.html` | 09 Me hub and Insights |
| `Laundry.dc.html` | 10 Laundry, Lent, Dry cleaner |
| `Declutter.dc.html` | 11 Declutter (swipe cards) |
| `Packing.dc.html` | 12 Packing list |
| `ClosetB.dc.html` | 03B Closet: Elevation direction |
| `ClosetC.dc.html` | 03C Closet: Editorial direction |

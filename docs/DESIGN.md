# My Closet — design notes

Direction: **Editorial Boutique**, a fashion magazine meets a boutique dressing room. The garments are the hero; the chrome stays quiet but carefully made.

- Interactive canvas (all 14 screens, light/dark, clickable): https://claude.ai/artifact/9DHnP8N1L9qLAufYUJ1SMt (private to the owner)
- Source for every screen: `docs/design/*.dc.html` (see `docs/design/README.md`)
- Tokens in code: `src/theme/tokens.ts`. **That file wins** if this document and the code disagree.

## Tokens

| Token                      | Light                       | Dark                        | Use                                          |
| -------------------------- | --------------------------- | --------------------------- | -------------------------------------------- |
| background                 | #F7F3EE                     | #121110                     | screen ground                                |
| surface                    | #FFFFFF                     | #1D1B19                     | cards, sheets                                |
| surfaceTinted              | #EFE8DF                     | #26231F                     | garment tiles, empty states, segmented track |
| surfaceTintedStrong        | #E4D9CB                     | #312C27                     | shelf bands                                  |
| board                      | #ECE5DB                     | #1A1816                     | outfit canvas                                |
| ink                        | #1C1A17                     | #F3EEE8                     | primary text, primary button                 |
| muted                      | #6E6860                     | #9C958C                     | secondary text (**contrast fix**, see below) |
| faint                      | #8A847C                     | #6F6962                     | icons, hanger glyph, hairline art, disabled  |
| rail                       | #B9AE9F                     | #4E4740                     | rail line, shoe rack bars                    |
| wicker / Shade / Deep      | #C8B08C / #A88E69 / #8C7455 | #9C8664 / #7D6A4F / #62523D | laundry basket weave (illustration only)     |
| accent                     | #E2553F                     | #FF7A5C                     | dots, rings, focus, the "+" button           |
| accentStrong               | #C2412C                     | #FF7A5C                     | filled buttons with text                     |
| accentText                 | #B23A26                     | #FF8F75                     | accent-coloured text                         |
| accentSoft                 | #F8E0D8                     | #3B231C                     | accent tints                                 |
| accentSecondary            | #2F4B3A                     | #8DB89C                     | weather card, toggles, laundry               |
| success / warning / danger | #2F6B45 / #8A5A12 / #A8321F | #86C59B / #E2B565 / #F08A75 | status (each has a `Soft` tint)              |

Hairlines are `ink` at 9% (`border-line`) and 17% (`border-line-strong`).

**Contrast fixes** (enforced by `src/theme/tokens.test.ts`):

- The spec's muted `#8A847C` is about 3.4:1 on the cream background, which fails AA for text. Text uses `#6E6860`, and `#8A847C` survives as `faint` for non-text art.
- White text on the spec accent `#E2553F` is about 3.6:1. Filled buttons use `accentStrong #C2412C`, and the spec accent stays for dots, rings and the "+" button.

**Type:** Fraunces 500 (display, plus italic for dates and editorial touches) and DM Sans 400/500/600/700.
Scale: display 40/34/28, title 22/18, body 16/14, caption 12, eyebrow 11 (uppercase, +1.5 tracking). Display sizes cap Dynamic Type at 1.3×.

**Shape and space:** radii 12 / 20 / 28 and full pills; 4pt grid; 20px screen gutters; 44pt minimum targets.

**Shadows:** cutouts get a soft silhouette shadow, `drop-shadow(0 10px 9px shadow@24%)` plus a 1px contact shadow (62%/40% in dark). In the app this is a Skia shadow built from the image's alpha mask, never a box shadow.

## Components (phase 1, `src/components/ui`)

AnimatedPressable · Text · Button (primary / accent / secondary / ghost / danger; md 52, sm 44) · IconButton · Chip (selected inverts to ink; dot, swatch, count) · Card (surface / tinted / inverse / accentSoft / secondary; pressable) · Sheet (content-sized, spring) · Swatch · Skeleton (shimmer; a breathe under Reduce Motion) · EmptyState (hanger / basket / shelf art) · Segmented (sliding thumb) · Toggle · Screen · SectionHeader · TabBar.

To see them all, open **Me → Design system** in the app.

## Signature moments: motion spec

Numbers come from the prototypes. Under Reduce Motion every one of these becomes a ≤200ms fade.

1. **Wardrobe doors** (`Closet.dc.html`). Plays once per session (`useSession.wardrobeDoorsPlayed`). Two door panels in `tint-strong` with inset panel outlines and vertical pulls. Perspective 1400, origins at the outer edges, 1.4s `cubic-bezier(.45,.05,.25,1)`. Keyframes: 0° → ±7° at 14% (unlatch) → ±106° at 72% → ±96° at 86% → ±100° and fade out. A shade overlay deepens to 0.35. The closet underneath scales 0.94 → 1 and fades 0.4 → 1 over 1.5s. When the doors finish, give the rail a sway impulse.
2. **Swaying hangers.** Each garment pivots at its hanger hook. Tilt is `sway × k`, where k is 0.7 for long coats and up to 1.35 for silk and dresses. While scrolling, the target is `clamp(−velocity_px_per_ms × 7, ±12°)`. A spring (k 170, c 9) settles it once |x| < 0.03 and |v| < 0.05.
3. **Magic cutout** (`AddItem.dc.html`). While segmenting, a diagonal (105°) shimmer band sweeps across every 1.25s (`ease-in-out`). When the mask is ready, the background blurs to 10px, scales 1.06 and fades over 1.1s. A transparency checkerboard shows briefly and fades after 0.9s. The garment lifts −8px and scales 1.02 as its silhouette shadow grows, with a spring overshoot. Detected colour chips then pop in, staggered by 120ms.
4. **Fly-in.** 1.35s total. The cutout leaves the preview at about 3.1× scale, lifts at 18% (−21px, 3.3×, −2°), overshoots its slot at 70% (+10px, 0.9×, 5°), then settles. The empty hanger pops in at about 1.45s, a ring pulses for 0.8s, and the landed hanger swings −5° → 3.5° → −1.5° over 1.3s.
5. **Colour-tinted detail** (`ItemDetail.dc.html`). Background is `mix(garmentHex, background, 0.76 light / 0.72 dark)`, and the disc behind the cutout is `mix(…, 0.55 / 0.5)`, cross-fading over 0.8s when paging between items. The cutout flips in 3D (0.9s spring) to show the original photo; double-tap zooms to 1.65×.
6. **Laundry basket** (`Laundry.dc.html`, `Closet.dc.html`). The dragged ghost scales 1.08–1.1 and rotates −7°. The basket scales to 1.07–1.22 with a green glow while hot. On drop it squashes (1.25, 0.84) → (0.9, 1.12) → (1.05, 0.97) over 0.65s, and the item falls in from −150px with a bounce (0.9s). **Wash done:** pile items fly out staggered 90ms apart, up and to the top right, shrinking to 0.25 over 1s.
7. **Empty hangers.** When a piece is out, its hanger stays on the rail with a status pill: worn uses `warning`, laundry `accentSecondary`, dry cleaner `faint`, lent `accent` ("Lent · Nadia"), storage `muted`. Shelves and the shoe rack show a dashed ghost outline of the folded piece or shoe.

## Screen map

| #         | Screen                                     | Prototype                            | Phase                             |
| --------- | ------------------------------------------ | ------------------------------------ | --------------------------------- |
| 01        | Onboarding                                 | `Main.dc.html`                       | 8 (see PROGRESS → open questions) |
| 02        | Today                                      | `Today.dc.html`                      | 6                                 |
| 03        | Wardrobe: Closet (direction A)             | `Closet.dc.html`                     | 2                                 |
| 03B / 03C | Closet alternatives: Elevation / Editorial | `ClosetB.dc.html`, `ClosetC.dc.html` | decide before 2                   |
| 04        | Wardrobe: Grid and Outfits                 | `Grid.dc.html`                       | 2 / 5                             |
| 05        | Item detail                                | `ItemDetail.dc.html`                 | 2                                 |
| 06        | Add item                                   | `AddItem.dc.html`                    | 3                                 |
| 07        | Outfit builder                             | `OutfitBuilder.dc.html`              | 5                                 |
| 08        | Planner                                    | `Planner.dc.html`                    | 6                                 |
| 09        | Me and Insights                            | `Me.dc.html`                         | 7                                 |
| 10        | Laundry and Lent                           | `Laundry.dc.html`                    | 4                                 |
| 11        | Declutter                                  | `Declutter.dc.html`                  | 7                                 |
| 12        | Packing list                               | `Packing.dc.html`                    | 7                                 |

## Platform

One identical custom UI on iOS and Android. The only difference is the tab bar: it uses an iOS blur, and on Android an opaque glass fill.

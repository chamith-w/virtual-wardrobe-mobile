# Build: My Closet — a Virtual Wardrobe mobile app

## Role

You are a senior React Native engineer and product designer. Build a production-quality, cross-platform (iOS + Android) mobile app. The UI must be polished, modern and highly interactive. It should feel tactile and delightful, never like a generic CRUD app.

## Product summary

My Closet is a virtual wardrobe that behaves like a real one. Users photograph their clothes. The app removes the backgrounds and organizes items into a closet with a hanging rail, shelves, drawers, a shoe rack and an accessories tray. Items have real-world states (clean, worn, in laundry, lent out, in storage) and visibly leave the wardrobe when they're not in it. Users build outfits, plan them on a calendar, get weather-aware suggestions, and see insights about what they actually wear.

Target user: someone with 50–500 garments who wants to get dressed faster, wear more of what they own, and buy less.

## Tech stack

- Expo (latest stable SDK) with development builds, not Expo Go, because native modules are required. TypeScript in strict mode.
- Expo Router for file-based navigation
- NativeWind for styling, driven by a design-token file
- react-native-reanimated + react-native-gesture-handler for all animations and gestures, running on the UI thread
- @shopify/react-native-skia for shadows, blurs, gradients and canvas effects
- expo-haptics, expo-image (caching + blurhash placeholders), @shopify/flash-list
- @gorhom/bottom-sheet for bottom sheets
- expo-camera, expo-image-picker, expo-image-manipulator, expo-file-system
- expo-sqlite + Drizzle ORM, using live queries so the UI updates reactively
- Zustand for UI state
- expo-location + the Open-Meteo API (free, no key needed) for weather
- expo-notifications for reminders
- lucide-react-native icons; fonts via @expo-google-fonts
- victory-native (Skia-based) for charts

The app is local-first and works fully offline. There are no accounts or backend in v1. Design the schema so cloud sync can be added later: use UUIDs, updatedAt timestamps and soft deletes.

## Design direction: Editorial Boutique

Fashion magazine meets boutique dressing room. Garments are the hero. The UI chrome stays quiet but carefully crafted.

Color tokens (light / dark):

- background: #F7F3EE / #121110
- surface: #FFFFFF / #1D1B19
- surfaceTinted: #EFE8DF / #26231F
- ink (primary text): #1C1A17 / #F3EEE8
- muted text: #8A847C / #9C958C
- accent: #E2553F / #FF7A5C
- accentSecondary: #2F4B3A / #8DB89C
- Define tasteful success, warning and danger variants that fit this palette.

Typography:

- Display font "Fraunces": large, tight tracking. Use it for screen titles and big numbers.
- Body and UI font "DM Sans".
- Type scale: display 40/34/28, title 22/18, body 16/14, caption 12.

Shape and spacing:

- Corner radii of 12, 20 and 28; full pills for chips.
- 4pt spacing grid with generous whitespace.

Imagery:

- Garments are background-removed cutouts floating on tinted surfaces.
- Each cutout has a soft drop shadow that follows its silhouette (a Skia shadow built from the alpha mask).

Dark mode is first-class, not an afterthought.

Avoid:

- The default iOS or Material look
- Plain gray lists, or flat white cards with gray text everywhere
- Emoji used as icons
- Stock spinners (use skeleton shimmers instead)
- Cramped layouts

## Motion and interaction principles

- Everything responds to touch with spring physics. Never use linear easing.
- Target 60fps on mid-range Android, with animations running in Reanimated worklets.
- Use haptic feedback for: adding an item, saving an outfit, status changes, a successful drag-and-drop, and swipes in declutter mode.
- Use shared-element-style transitions from thumbnails to detail screens. Use Reanimated shared transitions if they are stable in the installed version; otherwise build a custom overlay transition.
- Respect the OS "Reduce Motion" setting by replacing physics and 3D effects with simple fades.
- Every empty state gets an illustrated composition and a clear call to action. Never show a blank screen.

Signature moments (all must be built):

1. **Wardrobe doors:** the first time the Wardrobe tab opens in a session, two doors swing open in 3D perspective to reveal the closet.
2. **Swaying hangers:** on the hanging rail, garments tilt slightly based on scroll speed, then settle with a spring.
3. **Magic cutout:** during background removal, a shimmer sweeps across the photo and the background dissolves away.
4. **Fly-in:** after a new item is saved, its cutout shrinks and flies into its wardrobe section.
5. **Color-tinted detail:** the item detail background tints to the garment's dominant color.
6. **Laundry basket:** dragging an item onto the basket drops it in with a bounce. "Wash done" returns every item to the wardrobe in a staggered animation.
7. **Empty hangers:** when an item is out (worn, in laundry, lent), its spot shows an empty hanger with a small status tag.

## Navigation

A custom floating bottom tab bar with a raised center "+" button:
Today · Wardrobe · (+ Add) · Planner · Me

- Outfits live inside Wardrobe as a segment.
- Insights, Laundry, Lent items, Packing lists, Declutter and Settings live under Me.
- The Today screen has shortcuts to the most useful of these.

## Screens and features

### 1. Onboarding

- Three swipeable screens with motion.
- Ask for each permission only when it is first needed: camera when the user first adds an item, location when weather is first shown.
- Optional "pick your style" chips.
- An option to load a demo wardrobe.

### 2. Today (home)

- A greeting and the date in display type.
- A weather card showing temperature, conditions and feels-like temperature.
- "Today's outfit": a horizontal carousel of 3 outfits from the suggestion engine, each with Wear this, Shuffle and Edit actions.
- Quick tiles for items in laundry, items lent out, and the number of forgotten items.
- A "Wear it again" nudge: one unworn item plus a suggestion of what to pair it with.

### 3. Wardrobe (hero screen)

A segmented control switches between Closet, Grid and Outfits.

**Closet view:** zones are stacked vertically, and each zone scrolls horizontally.

- Hanging rail: tops, shirts, dresses, jackets, coats
- Shelves: knitwear, t-shirts, folded jeans
- Drawers: underwear, socks, activewear. Tapping a drawer slides it open.
- Shoe rack
- Accessories tray: bags, belts, jewelry, hats, scarves

Rules for the closet view:

- Each category maps to a default zone. Users can move items between zones with long-press and drag.
- The style is stylized, not skeuomorphic: a thin rail line, a minimal hanger glyph, and shelves drawn as subtle tinted bands.

**Grid view:** a masonry grid of cutouts.

**Across both views:**

- A search bar and filter chips for category, color swatches, season, occasion, status and brand.
- Sort options: recent, most worn, least worn, cost-per-wear, color.
- A wardrobe switcher at the top for multiple locations (Home, Storage, etc.).

### 4. Add item (the + flow)

1. **Capture:** use the camera with a garment-outline guide overlay, or pick from the gallery. Support adding several photos from the gallery at once.
2. **Background removal:**
   - Use on-device subject segmentation: the iOS Vision foreground mask, and ML Kit Subject Segmentation on Android. Access these through an Expo Module or a maintained community library.
   - Fall back to a cloud API (for example remove.bg) behind an interface, configured by an environment variable.
   - Offer a "keep original" toggle.
   - Stretch goal: a manual eraser/restore brush for refining the cutout.
3. **Auto-detect:**
   - Extract 1–3 dominant colors from the non-transparent pixels.
   - Map each one to the nearest named color in a curated fashion palette using LAB/ΔE distance.
   - Category detection goes behind a pluggable `classifyGarment()` interface. The default implementation asks the user via a quick-pick sheet.
4. **Details form:** a bottom sheet built mostly from chips so it is fast to fill. Fields: name, category and subcategory, colors, pattern, material, brand, size, seasons, occasions, price and currency, purchase date, store, care notes, tags.
5. **Save:** generate a thumbnail (about 400px) and a full-size cutout (about 1200px, PNG or WebP with alpha), then play the fly-in animation.

### 5. Item detail

- A large cutout on a color-tinted background. Support pinch-to-zoom and flipping to see the original photo.
- Stats: times worn, last worn, cost-per-wear, days since added.
- A status switcher: In wardrobe / Worn / In laundry / Dry cleaner / Lent (who and since when) / In storage.
- Actions:
  - Wear today
  - Add to outfit
  - Find matches (items that pair well with this one)
  - Edit
  - Move to another wardrobe
  - Archive as donated, sold or discarded, with a reason
- A list of outfits that include this item.

### 6. Outfit builder

- A canvas on a neutral board, with a bottom tray of items filtered by category tabs.
- Gestures on the canvas:
  - Drag items onto the canvas.
  - Pinch to scale and use two fingers to rotate.
  - Tap to bring an item forward or send it back.
  - Snap guides help alignment.
  - Drag an item to a trash zone to delete it.
- A Shuffle button replaces unlocked items with compatible alternatives. Each item has a lock icon.
- Saving asks for a name, occasion and season tags, then renders a snapshot image of the canvas to use as the thumbnail.
- Outfits list: a masonry grid with filters for occasion and season, plus favorites.

### 7. Planner

- A week strip that expands into a month calendar.
- Drag an outfit onto a day, or tap a day to pick one or get a suggestion.
- **Log worn:** confirm the outfit or pick individual items, optionally add a mirror selfie, and the day's weather is attached automatically. Logging:
  - Increments each item's wear count
  - Updates lastWornAt
  - Sets each item's status to "Worn"
- A setting automatically moves items to laundry after N wears, configured per category.
- Past days show what was worn, like an outfit journal.

### 8. Me hub

- **Insights:**
  - A color palette ring for the whole wardrobe
  - Category breakdown
  - Most and least worn items
  - Best cost-per-wear
  - Percentage of the wardrobe worn in the last 30 and 90 days
  - Spending per month
- **Laundry basket, Lent items and Dry cleaner.** Lent items include a "remind me to ask for it back" option.
- **Declutter mode:** swipeable cards for items unworn in 90+ days, with Keep / Donate / Sell / Decide later.
- **Packing lists:**
  - Trip name, dates and destination, with the destination's forecast pulled in
  - Add items or whole outfits
  - A checklist with packed toggles
  - Suggestions based on trip length and weather
- **Seasonal rotation:** move a whole season's items to a Storage wardrobe in one action.
- **Wishlist:** items the user wants to buy (photo or link), each showing "pairs with N items you own."
- **Settings:**
  - Theme: system, light or dark
  - Currency and temperature units
  - A reduce-motion override
  - Zone layout
  - Backup/export as a zip of the database and images, plus import

## Data model (Drizzle / SQLite)

- **wardrobes:** id, name, icon, sortOrder
- **zones:** id, wardrobeId, type (rail | shelf | drawer | shoes | accessories), name, sortOrder
- **items:**
  - Identity and placement: id, wardrobeId, zoneId, name, category, subcategory
  - Attributes: colors (json: [{hex, name}]), pattern, material, brand, size, seasons (json), occasions (json), tags (json)
  - Purchase: price, currency, purchaseDate, store, careNotes
  - Images: originalUri, cutoutUri, thumbUri
  - State: status (in_wardrobe | worn | laundry | dry_cleaner | lent | storage | archived), lentTo, lentAt, archivedReason, isFavorite
  - Wear: wearCount (cached from wear_logs), lastWornAt
  - Timestamps: createdAt, updatedAt, deletedAt
- **outfits:** id, name, occasion, seasons (json), snapshotUri, isFavorite, createdAt, updatedAt, deletedAt
- **outfit_items:** outfitId, itemId, x, y, scale, rotation, zIndex
- **wear_logs:** id, date, outfitId (nullable), photoUri, weather (json), notes
- **wear_log_items:** wearLogId, itemId
- **planned_outfits:** id, date, outfitId
- **trips:** id, name, destination, startDate, endDate
- **trip_items:** tripId, itemId or outfitId, packed
- **wishlist:** id, name, imageUri, url, price, notes

Store images in the app's documents directory, never in the database. Use UUIDs everywhere.

## Outfit suggestion engine

Write it as rule-based, pure TypeScript, with unit tests.

Inputs: available items (status = in_wardrobe), weather, an optional occasion, and recent wear logs.

1. **Choose layers** from temperature and rain:
   - Hot: top + bottom, or dress, plus shoes
   - Mild: add a light layer
   - Cold: add outerwear and a warm layer
   - Rain: prefer waterproof outerwear and shoes
2. **Generate candidates:** top + bottom + shoes, or dress + shoes, plus any layers and an accessory.
3. **Score each candidate on:**
   - Color harmony. Neutrals pair with everything. Use HSL to favor complementary and analogous hues and to penalize clashing saturated hues.
   - Season and occasion match.
   - Freshness. Penalize items worn in the last 7 days and boost under-worn items.
   - A bonus for favorites.
4. **Return the top 3 diverse outfits.** No two outfits may share more than one item.

Keep all scoring weights in a config object so they can be tuned.

## Project structure and quality bar

- **Folders:** feature-based.
  - app/ for routes
  - src/features/{wardrobe, items, outfits, planner, insights, ...}
  - src/components/ui for the design system
  - src/db, src/lib, src/theme
- **Primitives first:** build Text, Button, Chip, Card, Sheet, IconButton, Swatch, Skeleton, EmptyState and AnimatedPressable (scale plus haptic on press) before any screens.
- **Code style:** TypeScript strict with no `any`. Keep components small and put logic in hooks.
- **Tests:** Jest unit tests for the suggestion engine, color naming, cost-per-wear and wear-log logic.
- **Accessibility:**
  - Labels on every interactive element
  - Touch targets of at least 44pt
  - Dynamic type support
  - Sufficient contrast in both themes
- **Performance:**
  - Thumbnails in lists; full-size images only on detail screens
  - FlashList everywhere, with memoized list items
  - Lazy-load heavy screens
- **Seed data:** a seed script with about 30 sample garments (placeholder cutout images), so every screen can be demoed without manual entry.

## Out of scope for v1

Accounts and cloud sync, a social sharing feed, marketplace or selling integrations, AR or on-body virtual try-on.

## How to work

Build in phases. After each phase, stop and:

- Summarize what you built
- List any decisions you made
- Explain how to run it
- Wait for my go-ahead

Phases:

1. **Setup:** project, design tokens, fonts, light/dark theme, UI primitives, tab bar, database schema and migrations, seed data.
2. **Wardrobe:** closet view with zones, grid view, search/filter/sort, item detail.
3. **Add item flow:** capture, background removal, color extraction, details sheet, fly-in animation.
4. **Item states:** laundry basket, lent, storage, empty-hanger visuals, multiple wardrobes.
5. **Outfits:** builder canvas, shuffle, saved snapshots, outfits list.
6. **Today + Planner:** weather, suggestion engine, calendar, wear logging.
7. **Me hub:** insights, declutter, packing lists, wishlist, notifications, backup/export.
8. **Polish:** signature animations, empty states, reduce motion, an accessibility and performance pass.

If anything in this spec is ambiguous, choose whichever option makes the experience feel more polished and tactile, note your choice, and continue.

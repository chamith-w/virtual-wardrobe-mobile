# Phase 1: Setup ✅ done

Kept for reference. This is the brief Phase 1 was built from.

---

Set up My Closet (see `docs/SPEC.md`, "Tech stack", "Design direction" and "Project structure") as an Expo development-build project on the latest stable SDK.

- Project: TypeScript strict, Expo Router, NativeWind driven by a design-token file, Reanimated plus Gesture Handler, Skia. Install every library in the spec now, so later phases rarely need a native rebuild.
- Design tokens for colour (light and dark), type (Fraunces and DM Sans), radii, spacing and springs in `src/theme/tokens.ts`, consumed by both Tailwind and a ThemeProvider (system, light, dark; persisted).
- Primitives: Text, Button, Chip, Card, Sheet, IconButton, Swatch, Skeleton, EmptyState and AnimatedPressable (spring plus haptic), plus Segmented, Toggle and Screen.
- A custom floating tab bar (Today · Wardrobe · + · Planner · Me) with a raised "+" that opens the add flow as a modal.
- A Drizzle schema for every spec table (UUIDs, timestamps, soft deletes), generated migrations applied on launch, and live queries enabled.
- Seed data of about 30 garments with placeholder cutouts and a consistent wear history, outfits, plans, a trip and a wishlist.
- `CLAUDE.md`, docs and tests (contrast, dates, colour, seed consistency). `npm run check` must pass.

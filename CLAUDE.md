# My Closet — guide for Claude Code

@AGENTS.md

## What this is

A local-first virtual wardrobe for iOS and Android: photograph clothes, get background-removed cutouts hung in a stylised closet, track real-world states (worn, laundry, lent, storage), build and plan outfits, and see what you actually wear.

- **Product spec (source of truth):** `docs/SPEC.md`
- **Design system, motion specs, screen map:** `docs/DESIGN.md`
- **Interactive prototypes (layout, copy, motion values):** `docs/design/*.dc.html`
- **Phase tracker, decisions, open questions:** `docs/PROGRESS.md`

Stack: Expo SDK 57 · React Native 0.86 · React 19.2 (React Compiler on) · TypeScript 6 strict · Expo Router (routes in `src/app`) · NativeWind 4 · Reanimated 4 + Gesture Handler · Skia · expo-sqlite + Drizzle (live queries) · Zustand · FlashList 2 · @gorhom/bottom-sheet · lucide-react-native · victory-native.

## How we work

The spec is built **in phases** (see "How to work" in `docs/SPEC.md`). Each phase has a brief in `docs/phases/phase-<n>.md`, the checklist to build against. Use `/phase <n>` to start one, and begin every phase by auditing what already exists against its brief.

After every phase: stop, summarise what you built, list decisions, explain how to run it (and whether a native rebuild is needed), update `docs/PROGRESS.md`, then **wait for the go-ahead**. When the spec is ambiguous, pick the more polished and tactile option and record it under Decisions in `docs/PROGRESS.md`.

## Commands

```bash
npm install            # once, after cloning
npm run ios            # build + launch the iOS dev client (needed after any native change)
npm run android        # same for Android
npm start              # Metro for an already-installed dev client
npm run check          # typecheck + lint + tests — must pass before a phase is done
npm test               # Jest only
npm run db:generate    # after editing src/db/schema.ts → new SQL migration
npm run assets         # re-render demo cutouts, icon and splash (scripts/generate-assets.mjs)
npm run format         # Prettier (+ Tailwind class sorting)
```

## Where things live

```
src/app/                 Expo Router routes only (screens + _layout files)
src/components/ui/       Design-system primitives — use and extend these, don't bypass them
src/components/navigation/TabBar.tsx   floating tab bar + raised "+" (useTabBarInset for padding)
src/components/illustrations/          SVG glyphs (hanger, basket, ghost fold)
src/features/<feature>/  feature logic + hooks (items, wardrobe, outfits, planner, insights…)
src/db/                  schema.ts, client.ts, migrations/ (generated), DatabaseGate.tsx, seed/
src/lib/                 pure helpers: dates, color, haptics, ids, images
src/store/               Zustand: preferences (persisted), session (ephemeral)
src/theme/               tokens.ts (single source of truth), ThemeProvider, motion, fonts
docs/                    spec, design notes, prototypes, progress log
```

## Conventions

**Styling**

- Use NativeWind classes built from tokens: `bg-surface`, `bg-surface-tinted`, `text-muted`, `border-line`, `rounded-lg`, `rounded-pill`, `text-display1`… Colours are CSS variables, so light/dark is automatic — don't write `dark:` variants.
- Never hard-code hex values in components. For Skia, SVG, shadows and animated colours use `useTheme().colors` and `withAlpha()`.
- One-off font sizes go in `style` (inline style beats `className`). Don't stack two font-family or font-size classes; specificity follows stylesheet order, not class order.
- Text is always `<Text variant tone>` from `@/components/ui`, never React Native's `Text`.

**Interaction and motion**

- Everything tappable goes through `AnimatedPressable` (spring scale + haptic) or a primitive built on it (`Button`, `IconButton`, `Chip`, `Card onPress`, `Toggle`, `Segmented`). No `TouchableOpacity` or bare `Pressable`.
- `IconButton` requires `accessibilityLabel`; every interactive element needs a label and a ≥44pt target.
- Animate on the UI thread with Reanimated worklets. Use the springs in `tokens.springs` (or `useSpring()`), never linear easing.
- Shared values: use `.get()` / `.set()` (required with the React Compiler). Don't touch shared values during render; do it in effects or handlers.
- Always honour `useMotionReduced()`: replace physics and 3D with short fades.
- Haptics go through `haptics.<moment>()` in `src/lib/haptics.ts` (itemAdded, outfitSaved, statusChanged, dropSuccess, declutterSwipe…).
- Loading uses `Skeleton` shimmers (never spinners). Empty screens use `EmptyState` with an illustration and a call to action.

**Data**

- Read with Drizzle's `useLiveQuery` so screens update reactively; write with `db` from `@/db/client`.
- IDs come from `newId()` (UUID). Deletes are soft: set `deletedAt` and filter `isNull(table.deletedAt)`.
- Images live under the documents directory (`src/lib/images.ts`); store only URIs in SQLite.
- Wear logs and plans key on the local day `"YYYY-MM-DD"` (`src/lib/dates.ts`).
- To change the schema, edit `src/db/schema.ts`, then run `npm run db:generate`. Never hand-edit generated migrations.
- Keep `items.wearCount` and `lastWornAt` in sync whenever wear logs change (they are a cache).
- The demo wardrobe is `src/db/seed/garments.json` → `demo-plan.ts` (pure, tested) → `seed/index.ts` (writes rows and copies images).

**Code**

- TypeScript strict, no `any`. Keep components small; put logic in hooks or pure modules so it can be tested.
- Use FlashList for long lists, memoise list items, show thumbnails in lists and full cutouts only on detail screens.
- Native code uses Continuous Native Generation: never edit `ios/` or `android/`; configure through `app.json` and config plugins. Adding a native library means `npx expo install <pkg>` and then a dev-client rebuild (`npm run ios`).
- Jest tests sit next to their source as `*.test.ts`. Contrast is unit-tested in `src/theme/tokens.test.ts`; add pairs when you add colour tokens.
- Done means `npm run check` passes.

## SDK 57 gotchas (found during setup)

- Routes live in `src/app/`, not `app/`.
- JS tabs: `import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs'` (the `Tabs` export from `expo-router` is deprecated). Expo Router vendors React Navigation, so there is no `@react-navigation/*` dependency.
- `expo-file-system` uses the object API (`File`, `Directory`, `Paths`); `copy()` is async. The old function API lives at `expo-file-system/legacy`.
- TypeScript 6 no longer auto-includes `@types/*`. `tsconfig.json` lists `"types": ["node", "jest"]`.
- NativeWind 4.2 with Tailwind 3.4 (NativeWind 5 is still a release candidate). `tailwind.config.ts` imports `src/theme/tokens.ts`.
- Import Google fonts per weight (`@expo-google-fonts/fraunces/500Medium`), or every weight ends up in the bundle.
- On Android, `expo-blur` needs a `BlurTargetView`, so the tab bar uses an opaque glass fill there.
- In a network-restricted shell, `npx expo install` needs `EXPO_OFFLINE=1`.

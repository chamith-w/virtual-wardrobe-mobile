# My Closet

A virtual wardrobe that behaves like a real one. Photograph your clothes, watch them hang themselves in a stylised closet, see what's worn, in the wash or lent out, plan outfits around the weather, and learn what you actually wear.

Built with Expo SDK 57 (React Native 0.86), local-first with no account or backend. The design direction is "Editorial Boutique" (see `docs/DESIGN.md`).

## Run it

You need Node 20 or newer, **Xcode** (for iOS) and/or **Android Studio** (for Android). The app uses native modules (Skia, SQLite, camera…), so it runs in a **development build**, not Expo Go.

```bash
mv _claude .claude && mv _vscode .vscode   # one time: Claude Code commands + editor settings
npm install
npm run ios        # first run compiles the native app (~5–10 min), then launches the simulator
# or
npm run android
```

After the first build, `npm start` is enough. Rebuild with `npm run ios` / `npm run android` only when a native package or `app.json` changes.

On first launch the app runs its database migrations and loads a 36-piece demo wardrobe with eight months of wear history. You can reset it under **Me → Settings → Demo data**.

## Build it with Claude Code

```bash
cd my-closet
claude
```

Then:

- `/phase 2` builds the next phase of `docs/SPEC.md`, runs the checks, updates `docs/PROGRESS.md` and stops for your review.
- `/check` runs typecheck, lint and tests, and fixes whatever fails.

`CLAUDE.md` holds the project conventions Claude follows. `AGENTS.md` holds Expo's own guidance for SDK 57.

## Scripts

| Command               | What it does                                       |
| --------------------- | -------------------------------------------------- |
| `npm run check`       | Typecheck, lint and Jest                           |
| `npm run db:generate` | New SQL migration after editing `src/db/schema.ts` |
| `npm run assets`      | Re-render the demo cutouts, app icon and splash    |
| `npm run format`      | Prettier with Tailwind class sorting               |

## Docs

- `docs/SPEC.md`: the full product spec and phase plan
- `docs/DESIGN.md`: tokens, components, motion specs for the signature moments, screen map
- `docs/design/`: the interactive prototypes' source
- `docs/PROGRESS.md`: what's done, decisions, open questions

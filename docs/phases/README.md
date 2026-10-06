# Phase briefs

One prompt per phase of `docs/SPEC.md`. Each brief is self-contained, so you can paste it straight into Claude Code from the project root, or run `/phase <n>`, which reads the matching file.

| Phase | Brief                    | Builds                                                                                    |
| ----- | ------------------------ | ----------------------------------------------------------------------------------------- |
| 1     | [phase-1.md](phase-1.md) | Setup: tokens, theme, primitives, tab bar, schema, seed. ✅ Done                          |
| 2     | [phase-2.md](phase-2.md) | Wardrobe: closet, grid, search/filter/sort, item detail. **In progress**                  |
| 3     | [phase-3.md](phase-3.md) | Add item: camera, background removal, colours, details sheet, fly-in                      |
| 4     | [phase-4.md](phase-4.md) | Item states: laundry basket, lent and reminders, dry cleaner, storage, multiple wardrobes |
| 5     | [phase-5.md](phase-5.md) | Outfits: builder canvas, shuffle, snapshots, outfits list                                 |
| 6     | [phase-6.md](phase-6.md) | Today and Planner: weather, suggestion engine, calendar, wear logging                     |
| 7     | [phase-7.md](phase-7.md) | Me hub: insights, declutter, packing, seasonal rotation, wishlist, backup                 |
| 8     | [phase-8.md](phase-8.md) | Polish: onboarding, signature-motion audit, reduce motion, a11y, performance              |

## How to use them

1. Start a fresh Claude Code session for each phase. That way the context is the brief plus the repo, not the last phase's history.
2. Paste the brief, or run `/phase <n>`.
3. Claude audits what already exists, asks about any open decision, builds, runs `npm run check`, updates `docs/PROGRESS.md` and stops.
4. Try it on the simulator or your phone. Give feedback in the same session, and commit when you're happy.

Every brief opens with an audit step because work sometimes lands early. Phase 2 already covers some of phase 4 (status switching, lent tracking, wear logging), so later phases should reuse that code rather than rebuild it.

---
description: Build one phase of My Closet from docs/SPEC.md, then stop for review
argument-hint: <phase number>
---

Build **phase $ARGUMENTS** of My Closet.

1. Read the brief `docs/phases/phase-$ARGUMENTS.md` and follow it. It is the checklist for this phase.
2. Read what the brief points to: the sections of `docs/SPEC.md`, `docs/DESIGN.md`, `docs/PROGRESS.md` (decisions and open questions), and the prototypes in `docs/design/` for layout, copy and motion values.
3. Audit the codebase against the brief and reply with a done / partial / missing table before writing code. Reuse what exists. If a "Decide before coding" item or an open question blocks this phase, ask me first.
4. Check the Expo SDK version in `package.json` and fetch the versioned docs for every Expo or React Native API you touch (see AGENTS.md). Add packages with `npx expo install`, and say whether a native rebuild is needed.
5. Plan briefly, then implement. Build on the primitives in `src/components/ui`; extend them rather than bypassing them.
6. Add Jest tests for new pure logic: engines, calculations, data transforms.
7. Run `npm run check` until it passes.
8. Update `docs/PROGRESS.md`: tick the phase, add decisions, and update open questions.
9. Stop and reply with what you built, the decisions you made, and how to run and try it (including whether `npm run ios` is needed). Wait for my go-ahead before starting the next phase.

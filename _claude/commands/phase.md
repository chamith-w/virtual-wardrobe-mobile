---
description: Build one phase of My Closet from docs/SPEC.md, then stop for review
argument-hint: <phase number>
---

Build **phase $ARGUMENTS** of My Closet.

1. Read `docs/SPEC.md` (the phase list under "How to work" plus every feature section that phase touches), `docs/DESIGN.md`, and `docs/PROGRESS.md` (decisions and open questions). Open the matching prototypes in `docs/design/` for layout, copy and motion values.
2. If an open question in `docs/PROGRESS.md` blocks this phase, ask me before writing code.
3. Check the Expo SDK version in `package.json` and fetch the versioned docs for every Expo or React Native API you touch (see AGENTS.md). Add packages with `npx expo install`, and say whether a native rebuild is needed.
4. Plan briefly, then implement. Build on the primitives in `src/components/ui`; extend them rather than bypassing them.
5. Add Jest tests for new pure logic: engines, calculations, data transforms.
6. Run `npm run check` until it passes.
7. Update `docs/PROGRESS.md`: tick the phase, add decisions, and update open questions.
8. Stop and reply with what you built, the decisions you made, and how to run and try it (including whether `npm run ios` is needed). Wait for my go-ahead before starting the next phase.

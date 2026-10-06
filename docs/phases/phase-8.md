# Phase 8: Polish

> Paste into Claude Code from the project root, or run `/phase 8`.

---

Run **phase 8 of My Closet**: onboarding and the final quality pass.

**Read first:** `docs/SPEC.md` "Motion and interaction principles", "Signature moments", §1 Onboarding and "Project structure and quality bar"; all of `docs/DESIGN.md`; prototype `docs/design/Main.dc.html` (onboarding).

**Audit first.** Produce a checklist of every screen and every signature moment, marked OK / needs work, before changing anything.

## Build and audit

**Onboarding (unless it was built in phase 3)**

- [ ] Three swipeable screens with motion, matching the prototype.
- [ ] Optional "pick your style" chips, saved to preferences.
- [ ] "Load demo wardrobe" or "Start empty". This replaces the Phase 1 auto-seed in `DatabaseGate`.
- [ ] No permissions are requested here. Camera is asked on the first add, location the first time weather shows.

**Signature moments (compare with the timings in DESIGN.md and tune)**

- [ ] Doors, swaying hangers, magic cutout, fly-in, colour-tinted detail, laundry basket and empty hangers.
- [ ] Tune on a mid-range Android device, not only the iPhone simulator.
- [ ] Shared-element-style transitions from thumbnail to detail, everywhere a piece can be opened.

**Reduce Motion**

- [ ] With the OS setting _or_ the in-app override on, every animation path becomes a short fade, including the 3D doors, the card flip and drag ghosts. Test both settings.

**Empty states and loading**

- [ ] Do a fresh install with "Start empty" and visit every screen: none may be blank.
- [ ] Every load uses skeletons, never spinners.
- [ ] Add friendly error states and a root error boundary.

**Accessibility**

- [ ] Walk the whole app with VoiceOver and with TalkBack: labels, roles, hints and focus order.
- [ ] Every target is ≥44pt.
- [ ] At the largest Dynamic Type size nothing clips.
- [ ] Extend the contrast test to any new colour pairs.
- [ ] Every drag gesture has a button or menu alternative (move zone, send to laundry, plan day, declutter).

**Performance**

- [ ] FlashList for every long list, with memoised rows.
- [ ] Thumbnails in lists; full cutouts only on detail.
- [ ] Lazy-load the heavy screens: builder, insights, planner month.
- [ ] No animations on the JS thread.
- [ ] `expo-image` caching, plus blurhash/thumbhash placeholders generated at save time.
- [ ] Profile a **release** build and aim for 60fps on a mid-range Android device. Report what you measured.

**Consistency**

- [ ] Haptics audit against `src/lib/haptics.ts`.
- [ ] A dark-mode screenshot pass of every screen.
- [ ] Keep `/design-system` dev-only (`__DEV__`).
- [ ] Replace the placeholder seed cutouts in `assets/seed/` with my real ones if I've added them.

**Release readiness**

- [ ] `eas.json` with development, preview and production profiles; version and build numbers.
- [ ] Audit permission strings and Android permissions.
- [ ] Document the Personal Team limits in the README: builds expire after 7 days, no push.

## Tests

Cover any logic touched, and keep the full suite green.

## Done when

- `npm run check` passes.
- The audit checklist is all OK.
- A release build runs smoothly on both platforms.
- `docs/PROGRESS.md` marks v1 complete with any known issues.

Stop and report what changed, the performance measurements, and any follow-ups for v1.1. Commit only when I ask.

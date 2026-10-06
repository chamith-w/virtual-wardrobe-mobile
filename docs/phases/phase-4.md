# Phase 4: Item states

> Paste into Claude Code from the project root, or run `/phase 4`.

---

Build **phase 4 of My Closet**: garments that leave and return to the wardrobe.

**Read first:** `docs/SPEC.md` §3 (empty hangers), §5 (status switcher) and §8 (Laundry basket, Lent items, Dry cleaner); `docs/DESIGN.md` signature moments 6 (laundry basket) and 7 (empty hangers); prototypes `docs/design/Laundry.dc.html` and `Closet.dc.html`.

**Audit first.** Status switching, lent tracking, `features/items/status.ts`, `LentCard`, `StatusSwitcher` and wear logging already exist from phase 2. Report done / partial / missing and reuse what's there.

## Build

**One status service**

- [ ] `setItemStatus(itemId, status, extra?)` is the only write path for status. It enforces the allowed transitions and its side effects:
  - set or clear `lentTo` and `lentAt`
  - stamp a drop-off date for the dry cleaner
  - cancel reminders on return
  - fire the `statusChanged` haptic
- [ ] Decide and document how status `storage` relates to the Storage wardrobe. Proposal: moving a piece to a storage-type wardrobe sets `storage`, and moving it back sets `in_wardrobe`.

**Empty hangers everywhere**

- [ ] Closet zones show a hanger or ghost outline plus a status pill; Grid tiles dim with a tag.
- [ ] Tapping a piece that's out offers "Back in wardrobe" as a one-tap action.

**Laundry basket (DESIGN.md #6)**

- [ ] A floating basket on the Closet. Dragging a piece onto it drops it in with a squash-and-bounce, a `dropSuccess` haptic and a badge count.
- [ ] A Laundry screen (from Me and the Today tile):
  - a "Just worn" strip you can drag from
  - the basket pile
  - **Wash done**, which returns every item with the staggered fly-out animation (90ms apart) and one batched DB update
- [ ] An accessible alternative to dragging: a "Send to laundry" action.

**Dry cleaner**

- [ ] A list with drop-off date and "Picked up".

**Lent**

- [ ] A list with who, since when and days out (older ones highlighted), plus "Mark as returned".
- [ ] A "Remind me to ask for it back" toggle schedules a **local** notification through `expo-notifications`. The date is pickable, default +14 days. Ask for notification permission when the toggle is first switched on.
- [ ] Tapping the notification deep-links to the item. Cancel the reminder on return.
- [ ] We sign with a free Personal Team: `plugins/withoutPushEntitlement.js` must stay ahead of `expo-notifications` in `app.json`, and nothing may reintroduce remote push.

**Multiple wardrobes**

- [ ] Create, rename, reorder and soft-delete wardrobes. A new wardrobe gets a zone template; one can be marked as storage-type.
- [ ] The switcher shows a count for each wardrobe.
- [ ] Move one or many items between wardrobes, with optional multi-select in Grid via long-press.

## Out of scope

Auto-laundry after N wears (phase 6) and seasonal rotation (phase 7).

## Tests

The transition table (allowed and refused moves, side effects), reminder date maths and cancellation IDs, the wash-done batch update, and wardrobe deletion rules (it can't delete the last wardrobe and must re-home its items).

## Done when

- `npm run check` passes.
- Dragging a tee onto the basket bounces it in, and its hanger goes empty.
- Wash done brings everything back with the stagger.
- Lending a dress to someone with a reminder fires a local notification on the device (test it with a short delay in dev).
- Moving pieces to Storage and back works.
- Everything looks right in both themes and under Reduce Motion.

Then update `docs/PROGRESS.md`, stop and report, including whether a native rebuild is needed. Commit only when I ask.

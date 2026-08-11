# Contextual Mobile Tool Bar — August 2026

The persistent mobile bottom bar (`MobileToolBar`) carried the same three
tools on every page: Parking, Trip Planner, HOS. This pass makes the third
slot contextual, fixes a real stacking bug it exposed, and moves the bar's
icons onto the house iconography rule. Blueprint basis: master blueprint
Part 4 (conversion) — "the next action should be one thumb-tap away on the
page family where that action lives."

## The stacking bug (fixed)

The CDL Pre-School sticky purchase bar (`StickyCta`, `z-40`) and the tool
bar (`z-50`) both docked `fixed … bottom-0` on phones. The higher-z tool bar
covered the purchase CTA's lower half — button text clipped, caption hidden,
part of the tap target dead. Screenshot evidence lives in PR
"Homepage conversion — contextual mobile tool bar".

Fix: the tool bar owns `bottom-0`; the sticky bar now rides exactly one
tool-bar height above it — `bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))]`,
where `3.5rem` is the bar's `min-h-[56px]` and the safe-area term mirrors
the inset the bar absorbs on notched phones. The sales page's reserved
bottom band grew `h-24 → h-32` to cover the taller stack.
`scripts/test-mobile-toolbar.ts` pins the offset and the min-height in
lockstep.

## Slot doctrine

Resolved by the pure `toolsFor(pathname)` in
`src/components/layout/toolbar-tools.ts`:

| Page family | Slot 1 | Slot 2 | Slot 3 |
| --- | --- | --- | --- |
| everywhere (default) | Parking | Trip Planner | HOS |
| `/academy`, `/academy/*` | Parking | Trip Planner | **Apply** → `/academy/apply` |
| `/knowledge`, `/knowledge/*` | Parking | Trip Planner | **Pre-School** → `/cdl-pre-school` |

- **Parking and Trip Planner are permanent.** Parking first — the bar is a
  pinned parking entrance (`test-home-promos`).
- **Only the HOS slot yields**, and only where a page family has one clear
  next action. `/cdl-pre-school` itself keeps the default bar: the sticky
  purchase bar is the money surface there, and two money bars stacked on one
  screen is exactly what the one-amber doctrine forbids.
- **Money slots are amber TEXT, never a fill** — the same visual weight as
  the bar's existing active state, so a page's single filled-amber CTA keeps
  its primacy.
- Matching is segment-exact (`/academyx` gets defaults), and the Pre-School
  slot rides `PRESCHOOL_PATH` from the preschool constants — no copied
  strings.

## Icons

The three emoji (🅿️ 🗺️ ⏱️) became inline 2px-stroke SVGs on
`currentColor`, matching the parking marquee's drawn rig and the
no-emoji-in-chrome rule the signage primitives follow. Directory *content*
categories keep their emoji — that's data, not chrome.

## What this deliberately does not do

- No slot for the Navigator, store, or newsletter — no page family earns a
  third slot until it has ONE clear next action backed by a real page.
- No badge counts, no pulsing, no "NEW" chips — the bar is chrome.
- No change to the bar's landmark (`aria-label="Driver tools"`), tap-target
  floor (56px), or `aria-current` behavior.

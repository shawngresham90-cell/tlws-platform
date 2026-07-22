# TLWS Mobile Design Rules

Design target: a driver in a sleeper cab at a Love's at 9:45pm, one bar of
signal, one free hand, reading glasses somewhere in the door pocket.

## The laws

1. **One-hand law.** Primary actions live in the bottom 60% of the screen.
   Money actions never live top-of-screen only. Full-width buttons on mobile
   (`w-full sm:w-auto`) put the tap where the thumb already is.
2. **Tap targets:** 48px minimum height, 8px between adjacent targets. Test
   standard: operable with a work-gloved thumb. `Button` (py-3 + text-lg)
   clears this by default; never shrink it below `py-2.5`.
3. **Type floor:** 16px body minimum, 18px preferred on reading surfaces. No
   exceptions for "just a caption" on content users must actually read.
4. **Low bandwidth:** content paints before any script or animation. Images
   lazy-load via `next/image` with real `sizes`. Directory defaults to LIST
   on mobile; map tiles are opt-in.
5. **Poor-signal resilience:** the school application saves every answer on
   device (`ApplyForm` draft, 7-day expiry) — a dropped signal never eats a
   driver's application. Forms show explicit loading/success/failure and are
   safe to retry.
6. **Minimal typing:** tap-to-choose over type-to-enter. `inputMode` set on
   every field (`tel` keyboards for phone). Autocomplete attributes on
   everything a browser can prefill. No CAPTCHAs on read paths — Turnstile
   stays on write paths only.
7. **Dark is the default.** It's the brand and it's what a night cab wants.

## Breakpoint verification set

Every PR that touches layout gets an eyeball pass at **375px, 390px, 414px**
(portrait) and one desktop width. The homepage hero must show headline + one
primary CTA above the fold at 375px.

## Quick actions

- Directory listing: call and navigate in one tap each.
- Store: card → Amazon in one tap, new tab, UTM-tagged.
- Trip planner: recent searches + saved home base; zero typing beyond
  origin/destination.

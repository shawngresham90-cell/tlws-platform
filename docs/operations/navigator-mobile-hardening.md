# Navigator mobile usability hardening

A usability/accessibility hardening pass over the Navigator surfaces —
NOT a new feature. Every statically renderable surface was rendered and
MEASURED in headless Chromium at 320 / 360 / 390 / 430 px portrait, short
(568×320, 844×390) landscape, and again at 200% browser text scaling
(24px root), under deliberately hostile content: a 1250.5-mile route,
115 mph, a 50-character road name, a destination title that fills two
lines, a warning present in every rail slot at once.

## Surfaces audited

Drive Mode (normal + every-warning stress), Route Briefing (normal +
long-name stress), destination search, the passenger-override dialog, the
pilot trip controls (report/problem flow, long driver name), and the
Navigator crash screen. Unlock/onboarding/HOS/warning-rail/voice/post-trip
render inside these and were covered with them.

## What the measurement found

**One genuine defect class: horizontal overflow under text scaling / at
320px.** Cockpit numerals (the maneuver distance, the speed cluster, the
briefing summary numbers) and the drive-row controls (Overview · Voice ·
Stop) were sized with `rem`-based clamps and `w-full`. At 200% browser
text scale the distance numeral's `rem` floor grew until it wrapped, and
the three-button control row's text width exceeded a 320px row (also
reproducible under scaling at wider viewports).

Everything else measured clean: no clipped text, no controls below the
reachable viewport, no landscape row collisions (the Phase 2 fix holds),
no safe-area problems, the crash screen and dialog fit every width, and
the long destination title wraps without breaking the briefing layout.

## What was fixed

1. **Numeral clamps floored in px, not rem** — the maneuver distance,
   speed, and the three briefing numbers. The px floor is the size the
   layout was measured against; the `vw`/`dvh` middle term and the
   design-token ceiling are unchanged, so ordinary rendering is
   identical and only pathological text-scaling is bounded.
2. **Drive-row controls shrink instead of overflowing** — `min-w-0` +
   `truncate` on the Overview, Voice, and Stop buttons. Flexbox could not
   shrink them below their text width without `min-w-0`; the earlier
   instinct of a `min-w` floor was exactly backwards. **Height is the
   touch floor and is untouched** — every control stays `min-h-16`
   (64px), and the row divides ~300px among three, well above the 48px
   absolute minimum. The two committed primaries (the briefing's 72px
   green Start, its 64px Discard) are full-width single buttons and were
   left as-is.

## What was NOT changed

No routing, safety, voice, GPS, or accounting logic. No redesign for
taste — only measured overflow was touched. No new colors, no new
components, no live regions added or removed. The fix is CSS-class-only.

## Regression coverage

`scripts/test-navigator-mobile-hardening.ts` pins the two invariants: every
cockpit-numeral clamp floors in px (no `rem` floor survives), and every
drive-row control carries `min-w-0` + `truncate` while keeping `min-h-16`
— with no non-zero `min-w` floor that would re-block the shrink. The live
overflow measurement rig is a scratch tool (not committed); the harness
locks the source conditions that make the layout hold.

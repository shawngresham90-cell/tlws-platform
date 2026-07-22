# Post-Merge Visual Checklist

Run on the production URL after this PR merges (and once more on a phone).
~10 minutes. Anything failing → screenshot it and open an issue; every item
here is a small, reversible fix.

## Homepage (phone first — 375–414px)

- [ ] Hero: headline + ONE amber "Apply to the Academy" above the fold
- [ ] Proof bar: only real numbers render (no zeros, no blanks); digits align
- [ ] Four Doors: exactly TWO amber left edges (CDL door, mission door)
- [ ] CDL door: SpotsMeter shows live Founding-Student count; both Pre-School
      CTAs work (Stan Store new tab / see-what's-included)
- [ ] Story strip: three beats render under "See where the whole road goes"
- [ ] No LatestArticles section (placeholder content stays hidden)
- [ ] Newsletter submits with success state (Turnstile present)
- [ ] Footer: trust block shows LLC line + disclosures; every link resolves

## Navigation

- [ ] Desktop: six items + Apply + "More" menu; no dead links
- [ ] More menu: grouped School/Learn/Drive/More; opens with keyboard (Enter),
      closes with Esc-equivalent (click-away); all links resolve
- [ ] Mobile: hamburger shows the same grouped menu; 48px touch rows

## Academy

- [ ] Program journey: 6 steps, phases match the Curriculum page names
- [ ] "Where the school stands": no invented tuition/date/licensing values —
      "Being finalized" until owner supplies real ones
- [ ] Amber interest-list band renders with money edge; Apply works
- [ ] FAQ: new entries (age/medical/record/failing/placement) read correctly
- [ ] Dalton page FAQ no longer says "application opens soon"

## Application (do one real test submission, then delete it in admin)

- [ ] Fill step 1 partially → close the tab → reopen → "Welcome back" +
      values restored
- [ ] Airplane mode mid-step → error is polite, retry works, nothing lost
- [ ] Visit with `?utm_source=checklist` → submit → admin row's utm shows it
- [ ] Confirmation screen renders; draft cleared (reopen = fresh form)

## System-wide

- [ ] Amber is #F5A623 in on-platform UI chrome. (Deliberate exceptions: the
      favicon, OG share cards, and ROAD AHEAD cinematics keep thumbnail
      yellow #FFEB00 — the YouTube-facing identity; admin tools untouched)
- [ ] Buttons: secondary = white outline (not red); red appears only on errors
- [ ] Reduced motion (OS setting): no hover lift, no scroll animation
- [ ] Keyboard: focus ring visible on every interactive element
- [ ] Lighthouse mobile on `/`: performance within a point of pre-merge

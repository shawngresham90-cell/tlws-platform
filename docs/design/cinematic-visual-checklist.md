# Cinematic Homepage — Visual Review Checklist

Run on the deploy preview (then once more on a phone after merge).
~10 minutes. Anything failing → screenshot it; every item is a small,
reversible fix.

## Homepage — phone first (375–414px)

- [ ] Hero: thesis + ONE amber "Apply to the Academy" above the fold
- [ ] Hero atmosphere: subtle warm glow top-right + faint grain — felt, not
      seen; text contrast unaffected
- [ ] Credential byline under hero CTAs: "CDL instructor & driver trainer"
      (just the one — the headline already owns 17 years / zero violations)
- [ ] Proof bar: only real numbers (no zeros, no blanks)
- [ ] Four Doors: exactly TWO amber left edges; purchase machinery works
- [ ] THE JOURNEY strip: 01 Drove it / 02 Taught it / 03 Building it +
      "Built by a driver, funded by drivers, no games." pull-quote
- [ ] Tools run: Knowledge → Practice test → Apps → Parking → Books → Store
- [ ] Academy bridge + newsletter after the tools
- [ ] THE MOVEMENT: ROAD AHEAD card shows the fog-lit highway still with a
      readable near-white "Scene still" caption; exactly ONE "Take the
      drive" CTA (the still itself is not a link)
- [ ] Videos → Founders thermometer → Shirt → Sponsors → footer trust block

## Motion (desktop + phone)

- [ ] Scrolling: sections fade up subtly (≈ a quarter second), exactly once
- [ ] Nothing is ever blank while waiting — content is visible immediately
      if you scroll fast
- [ ] OS reduced-motion ON → zero reveals, zero fade-ups, zero hover lift
- [ ] Press End right after load, then scroll back up — no blank sections
      anywhere (jump-scroll must never strand a reveal)
- [ ] No layout jumps anywhere while scrolling (watch the scrollbar)

## Academy landing

- [ ] Masthead has the same subtle glow + grain as the homepage hero
- [ ] Credibility strip: 17 yrs / 0 / CDL-A / ELDT
- [ ] "Where the school stands": still says "Being finalized" — no invented
      tuition/date/licensing
- [ ] Forms and FAQ pages remain plain (no cinematic treatment)

## System-wide

- [ ] Amber #F5A623 only on money/action (2 door edges, primary CTAs,
      eyebrows/labels); Journey numerals and pull-quote rule are NOT amber
- [ ] Headlines render in Anton (condensed industrial caps) — if headings
      look like a generic web font, the font variable regressed
- [ ] Keyboard: focus ring visible on hero CTAs and every nav item
- [ ] No autoplay of anything, anywhere
- [ ] ROAD AHEAD itself unchanged — full experience intact at /road-ahead
- [ ] Lighthouse mobile on `/`: within a point of pre-change; `/` first
      load JS still ~105 kB

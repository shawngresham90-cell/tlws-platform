# Night Haul Homepage Pass — August 2026

What the Master Blueprint (v1.0, Aug 10) changed on the homepage, what it
deliberately did NOT change, and every item that waits on the owner. The
Steel & Sodium system remains the foundation; Night Haul lands on top of it
as the blueprint's highway-signage layer.

## Shipped in this pass

- **Tokens (additive):** `guide` (guide-sign green family, #1B6B3A/#14522C/#6FBF8A)
  and `deadline` (the blueprint's brake-red #D7263D + text-safe #F2778A —
  named `deadline` because the token guard reads `-brake-` suffixes and
  road-ahead slugs legitimately contain `air-brake-check`). Contrast floors
  are computed and pinned in `scripts/test-night-haul-home.ts`, not asserted
  by comment.
- **Primitives:** `GuideSignCard` (green wayfinding panel, optional real-text
  exit tab, focus ring, no emoji), `MileMarker` (green stat post for verified
  numbers), `ReflectiveTapeDivider` (6px white/reflective band — NOT the
  blueprint's yellow, because the house doctrine "amber = money only, never
  decoration" outranks it; flipping to yellow is one line once the owner
  makes the accent call below).
- **Applications:** ProofBar → mile-marker posts (fail-soft live-stats logic
  untouched; retires 2–4 amber numerals and the ragged 3-cell orphan);
  FourPaths free-door links → guide-sign panels (retires 6 amber text links
  that sat under 48px with no focus ring; mission-door links ride ink with
  rings); TruckParking → guide-sign directory entrance (heading un-nested,
  `-mt-6` hack gone); two tape dividers at the act breaks (hard cap two).
- **Readability floor:** section body copy at `text-sm` raised to 16px in
  FourPaths, JourneyStrip, FeatureGrid cards.
- **Focus rings added:** 11 FeatureGrid cards, 6 store tiles, newsletter
  submit, mission-door links. `Button` now enforces the 48px floor its doc
  comment always claimed. `Section` forwards `aria-labelledby` (ShirtHero
  had passed it into the void since the cinematic pass).
- **Conversion defect:** the Academy section's "Apply to the Academy" button
  pointed at `/academy` while the hero and Door 1 point the same label at
  `/academy/apply` — one label, one destination now.

## Photo seams (no photography exists yet — nothing was faked)

- **Hero — blueprint shot #1** (Shawn + ProStar, golden hour): documented in
  `Hero.tsx`; the type-led composition IS the design until the real frame
  lands, then it graduates via the existing `CinematicStill` treatment
  (`docs/design/owner-assets-needed.md` §1).
- **Journey strip — shots for beats 01/02/03** (archival driving photo,
  instructor shot #10, Dalton yard #6): `JourneyStrip` now carries a typed
  optional `photo` slot per beat rendering through `CinematicStill`; absent
  slots render today's complete type-led beat. Lighting one up is a data
  edit, not a layout change. Guard: the harness fails if a beat ships a
  fabricated path.
- **Classroom:** the real empty-room photo stays, per the blueprint — the
  same angle gets reshot when the room is equipped. Untouched.

## Deliberately NOT done (and why)

- **The #FFD100 accent flip.** The blueprint resolves the site accent to
  safety-yellow #FFD100; the repo runs signal amber #F5A623 sitewide — and
  `signal` classes are consumed inside Navigator components (HosStrip,
  DrivingScreen, access page), which a parallel session owns. A global flip
  from this pass would repaint Navigator under them. Needs: owner
  confirmation + a coordinated one-token PR (plus `signal-600` hover-shade
  recompute and the design-doc contrast note). Everything in this pass is
  accent-neutral — it reduces amber count rather than recoloring it.
- **SupplyClassroom heading size override** — pinned deliberate by
  `test-supply-the-classroom.ts`; left exactly as shipped.
- **JourneyStrip visible heading / Sponsors closer polish / FeaturedVideos
  thumbnails** — recorded, not urgent, no blueprint mandate.

## Owner actions (nothing here is code)

1. **Accent decision** (above): keep amber, or approve the #FFD100 flip as
   its own coordinated PR after Navigator's design work settles.
2. **Price-bump line** (blueprint Part 4.2): "$199 until Oct 18 — then $249"
   exists NOWHERE in repo truth — no bump constant, no deadline date, and
   `test-preschool.ts` forbids hardcoded prices. Confirm the real bump price
   + date and it becomes a constants-first change with the `deadline` token
   ready for the line. Until confirmed, adding it would be invented scarcity.
3. **Founding Student Wall** (Part 4.1): the machinery is live and honest —
   "0 of 20 filled" is data truth. Walk enrolled students through
   `/cdl-pre-school/founding-student-claim`, verify in
   `/admin/cdl-preschool/founding-students`; the wall, homepage meter, and
   spots copy all update themselves.
4. **Interest-list count** (Part 4.4): no academy-interest source exists;
   `applications`/`leads` counts are admin-only and nowhere near the ~100
   threshold the blueprint sets for showing a number. Gate documented; no
   number renders until a real source crosses it.
5. **The one-day photo shoot** — the ten-shot list in the blueprint Part 2.2;
   homepage seams above receive shots 1, 6, 10, archival, and the classroom
   reshoot with zero structural work.
6. **Approval-day switch kit** (Part 4.5): the flip-switch inventory (23
   `<Placeholder>` chips + 17 prose strings across the academy pages) is
   catalogued in the conversion audit; pre-writing the real values is owner
   copy work gated on DDS approval.

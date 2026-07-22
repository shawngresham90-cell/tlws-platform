# Cinematic Homepage — Current-State Audit & Delta

Audit of the production homepage (`main` @ `bf46c7f`, Steel & Sodium merged)
against the Cinematic Premium Homepage brief: premium national brand + serious
CDL academy + documentary movement. This doc records what already works, what
still reads flat, and exactly what this pass changes.

## What already feels premium (keep, don't touch)

- **Steel & Sodium system** — asphalt ramp, Cab Panel placards, sodium amber
  discipline (money/action only, max two edges per screen), tabular figures,
  industrial Anton display type. This is the foundation; nothing replaces it.
- **Hero thesis** — "17 years. Zero violations." is real documentary material.
  The strongest sentence on the site is already the first one.
- **Proof bar honesty** — fail-soft live numbers; nothing renders unless real.
- **Four Doors routing** — clear audience split, working purchase machinery.
- **THE ROAD AHEAD** — the flagship cinematic experience already exists and
  must not be duplicated (see boundary section below).
- **Accessibility floor** — focus rings, reduced-motion kill switch, 48px
  targets, label-in-name. Preserved as a hard constraint.

## What still feels flat or generic

1. **The hero is honest but visually silent.** Flat asphalt, no depth, no
   framing, no light. It reads as a well-typeset page, not a film opening.
   No real founder photo exists in the repo, so the fix is atmosphere —
   restrained gradient light, grain, framing rule, documentary caption —
   not imagery.
2. **No documentary voice between sections.** Every section uses the same
   eyebrow/heading/card rhythm (correct for consistency) but there is no
   *story connective tissue* — the page is a stack of good sections, not a
   journey.
3. **The story strip is buried inside the ROAD AHEAD teaser.** "Drove it /
   Taught it / Building it" is the spine of the whole brand and currently
   lives as small text inside another section's card.
4. **Section order breaks the emotional arc.** Current: doors → story →
   academy → tools → commerce → mission. The academy bridge appears before
   the visitor has seen the free-value proof; the movement content
   (videos, founders, shirt) is scattered across the bottom.
5. **No real photography anywhere on the homepage** — the only approved real
   stills in the repo are the three ROAD AHEAD posters
   (`/road-ahead/poster/*.jpg`, 24–44 KB each). One of them can legally and
   safely anchor the Movement card (Phase 8 permits "a still image or poster
   already approved").
6. **Zero motion except one fade-up.** The proof bar animates; nothing else
   does. There is no reveal rhythm, so scrolling feels static rather than
   composed. (The opposite failure — animating everything — is worse; the
   fix is a single restrained reveal primitive.)
7. **Weak transitions** — every section boundary is the same 1px hairline.
   No section is allowed a moment of light or depth except the teaser's
   radial gradient.

## Mobile issues found

- Hero py-20 pushes CTAs low on 375px; acceptable but tightened.
- No blocking issues found at 375/390/414 in the merged implementation
  (verified during the #163 pass); this pass re-verifies after changes.

## Performance risks to manage

- Grain/gradients must be CSS/SVG-data-URI only (zero requests).
- The one poster still used on the homepage is 28 KB (752×416) via
  `next/image` — within budget.
- Reveal primitive must be one tiny client component (IntersectionObserver,
  no framework). No animation library exists in the repo and none is added.
- Content must render before animation: SSR output has no hidden state; the
  pending state is applied only by JS, only below the fold, only when
  `prefers-reduced-motion` is not set.

## The delta this pass implements

| # | Change | Files |
|---|--------|-------|
| 1 | Hero: sodium light wash, film grain, framing rule, verified credential byline. Same thesis, same two CTAs. | `Hero.tsx`, `globals.css` |
| 2 | New **JourneyStrip** section — "Drove it / Taught it / Building it" as its own documentary beat with the site thesis as a pull-quote. | `JourneyStrip.tsx` |
| 3 | **Story re-order** to Call → Proof → Doors → Journey → Tools → Academy → Movement → Trust close. No section added or removed; all destinations live. | `page.tsx` |
| 4 | **Reveal** motion primitive — 220ms opacity/translate on section entry, IO-based, reduced-motion exempt, no CLS, no library. | `motion/Reveal.tsx`, `globals.css` |
| 5 | **CinematicStill** image treatment — warm sodium grade, bottom-third overlay, documentary caption, alt required. Used once (Movement card). | `media/CinematicStill.tsx` |
| 6 | ROAD AHEAD teaser becomes the **Movement card**: one approved poster still, one CTA, story beats moved out to JourneyStrip. | `RoadAheadTeaser.tsx` |
| 7 | Academy landing hero gets the same restrained documentary atmosphere (grain + light + verified caption). Forms/FAQ untouched. | `PageHero.tsx` (opt-in prop), academy `page.tsx` |
| 8 | Editorial details: amber tick rule on section headings, controlled measure, documentary captions. | `SectionHeading.tsx`, `globals.css` |

## What was considered and rejected

- **Autoplay/background video on the homepage** — banned by brief; ROAD AHEAD
  owns video.
- **Reusing ROAD AHEAD's scene/chapter system** — boundary violation; the
  homepage gets exactly one poster still + one CTA.
- **Stock or AI-generated founder imagery** — banned; the hero stays type-led
  until real photography exists (shot list in
  `cinematic-photography-guide.md` / `owner-assets-needed.md`).
- **Parallax / scroll-driven timelines** — heavy, hijack-prone, banned.
- **New animation framework** — none exists in the repo; none justified.
- **New statistics or quotes** — every number and phrase used is already
  verified in the repo (84K+, test catalog count, live DB counts, "built by a
  driver, funded by drivers, no games", 17 years / zero violations, CDL
  instructor & driver trainer, Dalton GA).

## ROAD AHEAD boundary (restated as enforced here)

- Homepage: one premium story card, one restrained reveal, one CTA, one
  already-approved poster still. Nothing else crosses over.
- No audio architecture, no chapter transitions, no scene system, no footage
  changes, no competing trailer.
- Contrast preserved: homepage = premium academy + movement; ROAD AHEAD =
  the full cinematic documentary.

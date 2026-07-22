# Homepage Story Framework

The homepage is a short documentary with a commercial spine. A visitor
should feel, in order: *this is a movement → it's real → there's a door for
me → the person behind it earned it → these tools are useful → the school
is serious → I can be part of this → I can trust it.*

## The eight beats (implemented in `src/app/page.tsx`)

| Beat | Section(s) | Job | Amber discipline |
|------|-----------|-----|------------------|
| 1 · THE CALL | `Hero` | Founder thesis, one money CTA, verified credential byline | 1 primary CTA |
| 2 · THE PROOF | `ProofBar` | Real numbers only; live figures fail soft | none |
| 3 · THE FOUR DOORS | `FourPaths` | Route every audience in one screen | 2 money edges |
| 4 · THE JOURNEY | `JourneyStrip` | Drove it → Taught it → Building it + thesis pull-quote | none (ink rules only) |
| 5 · THE TOOLS | `KnowledgeCenter`, `FeaturedTest`, `Apps`, `TruckParking`, `Books`, `Store` | Free value first, then gear that earns its keep | 1 CTA per section max |
| 6 · THE ACADEMY | `Academy`, `Newsletter` | The bridge into the school + stay close | 1 CTA |
| 7 · THE MOVEMENT | `RoadAheadTeaser`, `FeaturedVideos`, `FoundersWall`, `ShirtHero` | The drive, the channel, the founders, the shirt | teaser + shirt CTAs |
| 8 · THE TRUST CLOSE | `Sponsors` + footer trust block | Legal identity, disclosures, partner path | none |

## Why this order

- **Doors before story**: a returning driver shouldn't scroll past
  storytelling to reach the directory — routing stays high.
- **Journey before tools**: the tools land differently once you know who
  built them and why.
- **Academy after tools**: the free value *is* the credibility argument for
  the school; the bridge converts better after the proof of generosity.
- **Movement near the close**: ROAD AHEAD, the channel, and the founders
  are the "join something" finale — the emotional close before the factual
  one (footer trust block).

## Rules that keep it a documentary, not a trailer

- Every number rendered is real and current (live figures drop out on
  failure — never fake, never stale).
- Every caption and pull-quote is verified copy already true in the repo.
- One primary amber action per *section*; exactly two money edges on the
  doors screen. Two standing exceptions inherited from Steel & Sodium, both
  deliberate: the sticky header's Apply button accompanies every viewport,
  and the CDL door pairs the school CTA with the live Pre-School purchase
  CTA (real, working commerce outranks color discipline).
- No section without a live destination renders (`LatestArticles` stays
  out until real articles exist).
- Sections reveal (220ms) but never perform; see
  `cinematic-motion-rules.md`.

## Future story slots (documented, not built)

- **Student success stories** — after the first graduating class: a
  `CinematicStill` row in Beat 7 with real graduate photographs and
  verified outcomes. No placeholder ships before then.
- **Founder documentary shorts** — belongs to ROAD AHEAD, referenced from
  Beat 7 only.
- **Real hero photograph** — Beat 1 upgrades from type-led to image-led
  the day shot #1 of the photography guide exists.

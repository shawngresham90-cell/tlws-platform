# Cinematic Photography Guide

How real photography and future footage enter the TLWS platform. This guide
exists so that when the owner shoots real material, it drops into an
already-built system (`<CinematicStill>`) instead of prompting a redesign.

## Hard rules

1. **Real people, real places only.** No stock people, no AI-generated
   people, no composite "students." Trust surfaces (hero, academy, founders)
   carry only photographs of the actual founder, actual equipment, actual
   students (with written consent), actual locations.
2. **Every caption is a verified fact.** The documentary voice dies the
   first time a caption stretches the truth.
3. **Alt text is required** — enforced by the component's prop type.
   Describe what is literally in the frame.
4. **Performance budget:** ≤ 200 KB per homepage image (JPG/WebP),
   1920×1080 max for full-bleed, 752×416 sufficient for cards. Everything
   ships through `next/image` with explicit width/height (no layout shift).

## The treatment (`src/components/media/CinematicStill.tsx`)

Every real photograph gets the same grade so the platform reads as one film:

- **Warm sodium grade** — a 7% amber overlay evoking sodium-vapor yard light.
- **Bottom-third scrim** — dark gradient (≥ 0.78 alpha at the caption
  baseline) so caption text stays readable on any frame.
- **Film grain** — SVG-noise overlay at ≤ 6% opacity, zero network cost.
- **Placard framing** — 8px radius, hairline border, same as every card.
- **Documentary caption** — `doc-caption` voice, optional amber lead-in
  label (e.g. "Scene still").

Poster/fallback: for any future video slot, the poster still uses this same
treatment; video only ever plays on user action (no autoplay anywhere
outside THE ROAD AHEAD's own rules).

## Owner shot list (priority order)

Practical, shootable on a phone in good light. Landscape orientation,
subject in the left or center third (captions occupy the bottom third).

| # | Shot | Where it goes |
|---|------|---------------|
| 1 | **Shawn beside the truck** — standing at the tractor, yard or road backdrop, golden hour | Homepage hero (replaces type-led hero) |
| 2 | **Cab at night portrait** — dash-lit, working | Academy hero / ROAD AHEAD poster |
| 3 | **Pre-trip inspection** — hands on the rig, walking the truck | Academy "Real Equipment" / curriculum |
| 4 | **Teaching at the truck** — instructor + student at the cab door | Academy instructors / journey step |
| 5 | **Dalton yard establishing shot** — facility wide, I-75 context | Academy facility page |
| 6 | **Student instruction (range)** — backing/docking practice | Curriculum Phase 2 |
| 7 | **Hands on controls** — shifter, wheel, mirrors, close-up | Section dividers, proof surfaces |
| 8 | **Graduation / CDL-in-hand** — when the first class earns it | Student success stories (future) |
| 9 | **Family & community moments** — real founders, real meetups | Founders Wall |
| 10 | **Founders wall physical build** — the actual wall going up | Founders Wall / movement |
| 11 | **Sunrise environmental** — truck silhouette, dawn light | Movement surfaces |
| 12 | **Night-lot environmental** — sodium lights over parked rigs | Hero alternates, parking section |

Shooting notes for whoever holds the camera:

- Shoot wider than you think — the crop system needs headroom.
- Keep the subject out of the bottom third when possible (caption zone).
- Golden hour and sodium-lit night shots grade best; harsh noon light
  fights the warm grade.
- Get written consent from anyone identifiable who isn't Shawn.

## What happens when a shot arrives

1. Compress to budget (`scripts/` has the ROAD AHEAD compressor as a model).
2. Drop into `/public/images/` with a descriptive kebab-case name.
3. Swap into the relevant `<CinematicStill>` with honest alt + caption.
4. The homepage hero swap is documented in `owner-assets-needed.md` item 1.

No code redesign is needed for any of this — that is the point of the
system.

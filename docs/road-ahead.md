# THE ROAD AHEAD — flagship cinematic experience

`/road-ahead` is the homepage-quality guided drive through the whole Trucking
Life ecosystem, ending on the Founders Wall. It is built to cinematic spec now
and is production-ready with **zero real media** — every video and audio asset is
a typed _slot_ that renders a brand-safe fallback until a real file is dropped
in. No component changes are needed to go live with footage.

## Architecture at a glance

| Concern | Where | Notes |
| --- | --- | --- |
| Route (server, ISR 60s) | `src/app/(marketing)/road-ahead/page.tsx` | Fetches real founders + campaign totals, builds the wall sequence, fails soft. |
| Client orchestrator | `src/components/road-ahead/RoadAheadExperience.tsx` | Owns motion state + scroll timeline; mount-gates motion. |
| Scenes (7) | `src/components/road-ahead/Chapters.tsx` | Night → Pre-Trip → Grind → First Light → Founder Wall → Name Engraving → Payoff. |
| 3D Founder Wall (Scene 5) | `FounderWall3D.tsx`, `FounderTile3D.tsx` | CSS 3D (perspective/preserve-3d), real founder numbers, museum spotlight. |
| Name engraving (Scene 6) | `NameEngraving.tsx` | Brushed-metal plate, engraved next founder number, light "cut". |
| Media | `CinematicVideo.tsx`, `AudioController.tsx`, `MotionToggle.tsx` | Footage/soundtrack slots + accessible controls, viewport-gated video. |
| Cinematic CSS | `road-ahead.module.css` | Perspective, lighting, keyframes, scroll-driven `--p`. |
| Pure logic (tested) | `src/lib/road-ahead/*.ts` | `assets`, `chapters`, `ecosystem`, `founder-number`, `audio-state`, `scroll-math`, `hooks`. |
| Tests | `scripts/test-road-ahead.ts` (unit) · `scripts/e2e-road-ahead.mjs` (Playwright) | |

## The WebGL truck spine (capability-gated enhancement)

On top of the native scenes, capable desktops get a **continuous 3D truck
drive** rendered behind the whole page — a procedural (no GLB, no asset files)
low-poly semi that leads the camera down a pre-dawn interstate, mile markers
counting the years, dawn withheld until the school. It is a pure enhancement,
gated hard so it never costs the rest of the audience:

- **Code-split** (`three` + `@react-three/fiber` via `next/dynamic`, `ssr:false`)
  — the ~200 KB 3D chunk is never in the route-initial bundle (`/road-ahead`
  stays ~12 KB route / ~109 KB first load).
- **Capability ladder** (`useCinemaTier`): only upgrades to the spine on
  `pointer:fine` + `deviceMemory ≥ 4` + WebGL available + not Save-Data, on
  requestIdleCallback. Mobile, low-memory, Save-Data, no-WebGL, and
  reduced-motion visitors stay on the native CSS scenes (`data-ra-tier="lite"`).
- **Never fatal**: a React error boundary + WebGL context-loss handler drop
  straight back to the lite scenes — a spine failure can never show a crash
  screen.
- **Pause-aware**: the WCAG pause control (and `prefers-reduced-motion`) unmounts
  the spine with everything else.

When the spine is live, the narrative scenes with no footage go transparent so
the drive shows through; footage (when supplied) still wins. A DOM **Year
Odometer** (2009 → 2076) reinforces the same timeline on every tier.

GSAP was evaluated and intentionally **not** adopted: in the source build it only
bridged scroll → the footage layer (the truck reads scroll directly), so the
native shared-timeline already covers it with no added dependency.

The route-initial experience still adds **no** dependencies of its own — the
native scenes run on a shared rAF-throttled scroll timeline, IntersectionObserver
only to viewport-gate video, CSS 3D transforms, and CSS keyframes. three.js/R3F
load only for the opted-in full tier.

## The seven-scene shot list (owner-supplied footage)

Every clip is a typed slot in `ROAD_AHEAD_VIDEO` (`src/lib/road-ahead/assets.ts`),
grouped by scene. Film against this list and drop each clip into its slot — no
component changes needed. Scenes 5 and 6 use no video by design.

| Scene | Slots to fill |
| --- | --- |
| 1 · Night Drive | `nightDriving`, `headlights`, `highwayNight`, `windshield` |
| 2 · The Pre-Trip | `preTripInspection`, `walkAround`, `backing`, `climbingIn`, `airBrakeCheck` |
| 3 · The Grind | `truckStop`, `rain`, `lateNightDriving`, `emptyHighway` |
| 4 · First Light | `sunrise`, `truckHero`, `drone`, `academy` (future) |
| 5 · Founder Wall | _no video — 3D wall_ |
| 6 · Your Name | _no video — engraving_ |
| 7 · The Payoff | `student`, `keyHandoff`, `training`, `truckDrivingAway` |

Each scene renders **one** backdrop — `sceneBackdropSlot(scene)` picks the first
slot with footage, else the first slot's gradient — so a scene goes cinematic the
moment its first clip is supplied, and the rest are available for future cuts.

### Dropping in a clip

1. Add the file under `public/road-ahead/video/` (optional poster under
   `public/road-ahead/poster/`, captions under `public/road-ahead/captions/`).
2. In `assets.ts`, fill that slot's fields:
   - `src`: `/road-ahead/video/night-driving.mp4` (H.264 MP4 — broadest support)
   - `webmSrc` _(optional)_: a smaller VP9/WebM encoding for mobile
   - `poster` _(recommended)_: a still shown before the video paints
   - `captionsSrc` _(required if the footage has speech/graphic text)_: a WebVTT file
   - `license`: **required once `src` is set** — `licenseType` plus a `source`
     or `attribution`. The test suite fails if supplied media has no accounted
     license.

Each slot's `description` + `alt` document the shot inline. Recommended specs:
1080p or 4K, 8–20s, loops cleanly, graded dark to sit behind white text. Until a
slot's `src` is set, its scene shows the `gradient` (always present), so the page
is never blank.

## Dropping in the licensed soundtrack

1. Add the track under `public/road-ahead/audio/`.
2. Fill `ROAD_AHEAD_AUDIO` in `assets.ts`: `src`, `title`, and a complete
   `license`. The soundtrack **must** be licensed for web/background use — record
   the license in the manifest.

The audio control is hidden until `src` is set. Audio is **off by default** and
only ever starts from an explicit user tap — it never autoplays (browser policy
+ accessibility). The soundtrack is atmospheric only; it carries no information,
so a visitor who never enables it misses nothing.

## Accessibility model

- **Reduced motion:** `prefers-reduced-motion: reduce` renders the fully-composed
  static page — no parallax, no looping video, no light sweeps (enforced in both
  JS and a CSS hard-stop).
- **Motion pause (WCAG 2.2.2):** a visible pause control stops all motion even for
  visitors who haven't set the OS preference. Looping backdrops never run without
  a way to stop them.
- **Structure:** one `<h1>` (opening), `<h2>` per subsequent chapter, real
  `<section>` landmarks with anchor ids, a keyboard skip-to-chapter nav, and a
  desktop chapter rail with `aria-current`.
- **Backdrops are decorative** (`aria-hidden`); all meaning is in the text.
- **Founder links** carry `rel="sponsored nofollow noopener noreferrer"`.
- **No amounts:** individual founder contribution amounts are never rendered —
  only the aggregate thermometer and each founder's wall number.

## Performance model

- Server-rendered first paint (ISR); the client only layers motion on top.
- One shared rAF-throttled scroll listener drives the whole timeline.
- All animation is transform/opacity (compositor-friendly); scroll-driven values
  flow through a single `--p` custom property.
- Media is lazy except the first chapter; video is `muted`/`playsInline` so
  mobile can play it inline and cheaply, and never loads at all under reduced
  motion.

## Founder numbers

`founder-number.ts` turns published founders into a deterministic wall sequence:
grouped by tier (recognition order), each founder gets a within-tier place and a
global **founder number** (their position on the wall in reading order). It is
purely their place on the wall and never implies a contribution amount. The CTA
shows the next open number to invite the visitor to claim it.

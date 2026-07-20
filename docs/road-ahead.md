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

## The video asset system (owner-supplied footage)

There are two ways to supply footage. The **simple system** is the default; the
**shot-list** is for later montage work.

### The simple system: one clip per scene (`scene-01` … `scene-07`)

Each scene resolves its backdrop from `SCENE_BACKDROP` in
`src/lib/road-ahead/assets.ts` via `sceneBackdropSlot(scene)`. Drop **one** clip
per scene and the scene goes live — no component changes.

- **Video folder:** `public/road-ahead/video/` — name clips `scene-01.mp4` …
  `scene-07.mp4`.
- **Poster folder:** `public/road-ahead/poster/` — matching stills `scene-01.jpg`
  … `scene-07.jpg`.

| Slot | Scene | Footage |
| --- | --- | --- |
| `scene-01` | 1 · Night Drive | Night driving, headlights, highway, windshield POV |
| `scene-02` | 2 · The Pre-Trip | Inspection, walk-around, backing, climb-in, air-brake |
| `scene-03` | 3 · The Grind | Truck stop, rain, late-night driving, empty highway |
| `scene-04` | 4 · First Light | Sunrise, truck hero, drone, academy |
| `scene-05` | 5 · The Wall | _optional atmosphere — the 3D wall renders its own scene_ |
| `scene-06` | 6 · Your Name | _optional atmosphere — the engraving renders its own scene_ |
| `scene-07` | 7 · The Payoff | Student, key handoff, training, truck driving away |

**Recommended encoding for every clip:**

| Setting | Value |
| --- | --- |
| Resolution | 1920×1080 (1080p) — phones auto-downscale |
| Container / codec | MP4 / H.264 (`yuv420p`, `+faststart`); optional `.webm` (VP9) beside it |
| Duration | 8–15 s, framed to loop cleanly |
| Frame rate | 24–30 fps |
| Audio | none (clips play muted) |
| Max file size | ≤ 4 MB per clip (aim 2–3 MB); posters ≤ 200 KB |

**Compress a raw clip (and auto-generate its poster):**

```bash
node scripts/compress-road-ahead-video.mjs <input-file> <scene 1-7> [maxSeconds]
# e.g.  node scripts/compress-road-ahead-video.mjs ~/night-drive.mov 1
```

This writes `video/scene-0N.mp4`, `video/scene-0N.webm`, and
`poster/scene-0N.jpg` at the settings above (ffmpeg resolved from `$FFMPEG`,
PATH, then the bundled Playwright build). Under the hood the MP4 pass is:

```bash
ffmpeg -i input.mov -t 15 \
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -an -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 24 -preset slow \
  -movflags +faststart public/road-ahead/video/scene-01.mp4
```

After the files land, fill that scene's slot in `assets.ts` → `SCENE_BACKDROP`:
set `src` (`/road-ahead/video/scene-01.mp4`), optional `webmSrc` + `poster`, and
a complete `license` (**required once `src` is set** — the test suite fails on
supplied media with no accounted license).

**Playback behaviour (all automatic):** clips autoplay muted, loop, use
`playsInline`, and load **only when the scene is on/near screen** (or eagerly for
scene 1). On a Save-Data or 2g connection, or if a clip fails to load, the scene
falls back to its poster then its gradient — never a broken or blank backdrop.
Under reduced-motion no video plays at all.

### The shot-list (optional montage slots)

`ROAD_AHEAD_VIDEO` also holds 21 finer-grained slots grouped by scene, for future
montage cuts. They don't drive the backdrop today (the canonical `scene-0N` slot
does) but remain available and validated:

| Scene | Montage slots |
| --- | --- |
| 1 · Night Drive | `nightDriving`, `headlights`, `highwayNight`, `windshield` |
| 2 · The Pre-Trip | `preTripInspection`, `walkAround`, `backing`, `climbingIn`, `airBrakeCheck` |
| 3 · The Grind | `truckStop`, `rain`, `lateNightDriving`, `emptyHighway` |
| 4 · First Light | `sunrise`, `truckHero`, `drone`, `academy` |
| 7 · The Payoff | `student`, `keyHandoff`, `training`, `truckDrivingAway` |

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

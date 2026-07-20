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

## The video asset system — true zero-code drop-in

Every clip is a named SLOT in `ROAD_AHEAD_VIDEO` (`src/lib/road-ahead/assets.ts`),
and each slot's id **is** its drop-in filename stem. Drop the file into
`public/road-ahead/video/` and **it appears — no code edit.** The build-time
resolver (`assets-resolver.ts`) scans the folder and fills each slot's
`src`/`webmSrc`/`poster`/`captions` for the files that exist; until then the slot
keeps its cinematic gradient (and its poster, if a still was dropped in first).

- **Video folder:** `public/road-ahead/video/` — filename = `<slot>.mp4`
- **Poster folder:** `public/road-ahead/poster/` — `<slot>.jpg` (or `.webp`)
- **WebM (optional):** `public/road-ahead/video/<slot>.webm` (VP9, smaller mobile)
- **Captions (optional):** `public/road-ahead/captions/<slot>.vtt`

Each scene renders **one** backdrop — the first of its slots with real footage,
else the first slot's gradient. Extra slots per scene are montage material for
later cuts.

| Scene | Drop-in filenames |
| --- | --- |
| 1 · Night Drive | `dark-highway.mp4`, `night-driving.mp4`, `headlights.mp4`, `windshield-rain.mp4` |
| 2 · The Pre-Trip | `pretrip.mp4`, `truck-walkaround.mp4`, `backing.mp4`, `climb-into-cab.mp4`, `air-brake-check.mp4` |
| 3 · The Grind | `truck-stop.mp4`, `empty-highway.mp4`, `rain-driving.mp4`, `late-night-driving.mp4` |
| 4 · First Light | `sunrise.mp4`, `hero-shot.mp4`, `drone-shot.mp4`, `academy-footage.mp4` |
| 5 · The Wall | _no video — 3D Founder Wall_ |
| 6 · Your Name | _no video — name engraving_ |
| 7 · The Payoff | `student-training.mp4`, `key-handoff.mp4`, `student-success.mp4`, `truck-driving-away.mp4` |

**Recommended encoding for every clip:**

| Setting | Value |
| --- | --- |
| Resolution | 1920×1080 (1080p) — phones auto-downscale |
| Container / codec | MP4 / H.264 (`yuv420p`, `+faststart`); optional `.webm` (VP9) beside it |
| Duration | 8–15 s, framed to loop cleanly |
| Frame rate | 24–30 fps |
| Audio | none (clips play muted) |
| Max file size | ≤ 4 MB per clip (aim 2–3 MB); posters ≤ 200 KB |

**Compress a raw clip to a slot (and auto-generate its poster):**

```bash
node scripts/compress-road-ahead-video.mjs <input-file> <slot-name> [maxSeconds]
# e.g.  node scripts/compress-road-ahead-video.mjs ~/night.mov dark-highway
```

This writes `video/<slot>.mp4`, `video/<slot>.webm`, and `poster/<slot>.jpg` at
the settings above (ffmpeg resolved from `$FFMPEG`, PATH, then the bundled
Playwright build), then you just redeploy — the resolver does the rest.

**Playback behaviour (all automatic):** clips autoplay muted, loop, use
`playsInline`, and load **only when the scene is on/near screen** (eager for scene
1). On a Save-Data / 2g connection, or if a clip fails to load, the scene falls
back to its poster then its gradient — never a broken or blank backdrop. Under
reduced-motion no video plays at all.

## The audio pipeline

Off by default; nothing autoplays. A visitor taps **"Enter with sound"** (on the
Founder Wall) or the soundtrack control, then the synth engine (`audio.ts`)
provides zero-asset ambience that **cross-fades by scene** (`setActiveScene`):

| Bed | Scenes | Today |
| --- | --- | --- |
| `engine-idle` | Night Drive, Pre-Trip | synth |
| `air-brakes` | Pre-Trip (cue) | synth |
| `highway-ambience` | Night Drive, The Grind | synth |
| `rain-ambience` | The Grind | synth |
| `truck-stop-ambience` | The Grind | synth |
| `dawn-swell` | First Light | synth |
| `narration` | whole experience | file-only |
| `score` (licensed music) | whole experience | file-only |

Drop `narration.mp3` or `score.mp3` (licensed music) into
`public/road-ahead/audio/` and the resolver plays it alongside the synth beds
when sound is on — still never autoplaying. The five ambience beds are
synthesized in this phase (no file needed); playing a dropped-in ambience
recording in place of a synth bed is a small future enhancement. Music must be
licensed for web/background use.

## GSAP scene transitions (lazy, gated)

`GsapTransitions.tsx` adds a Hollywood-style light-bloom transition between scenes
via GSAP + ScrollTrigger. It is **dynamically imported** (gsap is never in the
route-initial bundle) and mounted **only when motion is allowed** — a pause or
reduced-motion request unmounts it, killing every trigger and tween. GSAP runs on
its own ticker, so it layers on top of the native scroll engine without touching
its `--p` timeline; if gsap fails to load, the native experience stands on its own.

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

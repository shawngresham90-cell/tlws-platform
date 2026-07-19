# The Founders Movement — Cinematic 3D Experience

Architecture, creative direction, and prototype specification.
Status: **design document + isolated proof-of-concept** (`/founders-movement`, noindex).
The production Founders Wall at `/founders` is untouched; this experience will
eventually live alongside it (or replace its hero) only after a separate approval.

---

## 1. Creative direction

**Feeling:** entering a movement, not visiting a page. Dawn on an empty
interstate. One truck. One driver who spent 17 years behind the wheel and is
now building a school so the next driver starts better. The visitor rolls
down that road, watches what has already been built rise around the truck,
and arrives at a wall with real names on it — then is asked to put theirs there.

**Tone words:** dawn, iron, patience, momentum, legacy. Never: flashy, gamified,
loud, synthetic.

**Palette:** the existing brand system, extended:
- `asphalt-900/800` blacks for road and sky base
- `signal` brand yellow for CTAs/engraved highlights, with a natural amber-orange sunrise band — the horizon gradient, headlight glow warm-white
- cold steel blues/greys for pre-dawn scenes (1–2), warming to full sunrise by the wall (5–8)
- Materials by tier (maps to the real DB tiers): Brick = fired clay red-brown; Steel = brushed cool grey; Iron = dark cast texture; Equipment Sponsor = machined platinum (the brief's "Platinum"); Student Sponsor = warm bronze with a light halo (the brief's "Legacy" — the tier that puts a person in a seat).

**Type:** existing display face (Anton) for scene headlines, engraved-style
letterspacing on wall names. Headlines arrive with a slow 12px rise + fade,
never a bounce.

**Camera grammar:** one continuous dolly. The camera never cuts — it *drives*.
Scroll is the accelerator: scrubbing scroll scrubs the camera along a single
spline from the road (Scene 1) to the wall (Scene 6) to the finished school
(Scene 7). Every scene is a stretch of the same highway.

---

## 2. Scene-by-scene storyboard

Each scene = one full-viewport scroll "chapter" (100–200vh of scroll each,
~1200vh total). Every scene has real HTML (H2 + copy + links) layered over or
under the canvas — the canvas is illustration, never the only carrier of meaning.

| # | Scene | Visual | HTML content layer |
|---|-------|--------|--------------------|
| 0 | **Ignition (hero)** | Black. A distant engine-idle *(only if sound opted-in)*. Two headlights fade up → the truck rolls through frame L→R → camera rises behind it over the centerline; sunrise gradient bleeds in on the horizon; the school is a lit silhouette far ahead. Live founder count + headline fade in. | H1 "The Founders Movement", founder count (server-rendered), CTAs: **Join the Founders Movement** → `/founders#join`, ghost: *Enter with sound*. |
| 1 | **The road** | Empty pre-dawn interstate, mile markers ticking past, cold blue. | Shawn's beginning — 17 years, zero violations, the first seat. Link → `/about`-equivalent copy. |
| 2 | **The trainer** | Cab interior silhouette: two seats, one wheel, a hand passing keys. Light warms one notch. | The education mission: trainer → instructor → teacher of thousands. |
| 3 | **Already built** | As the truck passes, signage rises from the roadside like exit signs, one per product, catching headlights. | Seven real links: Knowledge Center, Practice Tests, Directory, Trip Planner, HOS tools, CDL Pre-School, Academy — each a true `<a>` with one-line description. |
| 4 | **The future** | Ghost-blue holographic signs further up the road, not yet solid: school, GPS planner, community, voice corridors, marketplace, mobile apps. | Roadmap copy; each item marked "in progress / planned" honestly. |
| 5 | **Approach the wall** | The road curves; a long wall emerges parallel to the highway, low sun raking across it so engraved names catch light edge-first. | H2 "The people building it" + campaign thermometer (live data). |
| 6 | **The wall, interactive** | Camera settles square to the wall. Tiles = founders, material by tier, names engraved. Hover/focus lifts a tile 8px; select opens the founder's story panel. | Full accessible founder list (the *same* DOM the current `/founders` wall uses) — canvas is an enhancement of it. |
| 7 | **The school stands** | Pull back and up: the finished school — lot, trucks, range cones, lit sign — with the wall built into its front face. | The physical school: Dalton, GA; what it teaches; who it puts in seats. |
| 8 | **Legacy CTA** | The road continues past the school to the horizon. A final light sweep. | H2 "Put your name on it." → Join CTA + tier summary + `/founders#join`. |

---

## 3. Animation timeline (choreography)

Global rule: **scroll-scrubbed, not time-driven** (except the one-time hero
ignition, ~6s, skippable, and skipped entirely under reduced motion).

Hero ignition (time-based, once):
- 0.0s black; 0.5s headlights fade in (opacity 0→1, 1.2s ease-out)
- 1.5s truck translates through frame (x −120%→+140%, 3s cubic-bezier(.2,.8,.4,1))
- 3.0s camera rise (translateY/perspective-origin shift, 2.5s)
- 4.0s horizon gradient warms (background-position, 2s)
- 4.5s headline rise+fade (12px, 0.9s), count-up of founder number (1.2s)
- Skippable: any scroll/keypress jumps to the end-state. Reduced-motion: start at end-state.

Scroll choreography (per-scene, as camera-spline progress `p` 0→1):
- Scene transitions overlap 15% (no hard cuts).
- Road centerline dashes translate at `scrollVelocity × k`, clamped, so the road only moves when the user does.
- Sign reveals: 60% opacity + 24px rise, staggered 80ms, triggered at scene-local `p = 0.25` via IntersectionObserver on the HTML twin (the canvas listens to the same trigger — single source of truth).
- Wall reveal: names fade in by tier rows (top tier first), 40ms stagger, raking-light sweep once per entry into Scene 6 (not looping).
- Heading "impact": 1px downward settle + one 90ms low-volume thud (audio only if opted-in).
- Counters (founder count, raised %): count up once, on first view, 1.2s, `prefers-reduced-motion` ⇒ render final value instantly.

Forbidden: spins, parallax > 24px on text, any infinite looping motion beyond the ≤ 6px road-shimmer, autoplaying video, flash > 3Hz (WCAG 2.3.1).

---

## 4. 3D technical architecture

**Recommendation: React Three Fiber (R3F) + Drei + GSAP ScrollTrigger, loaded lazily on an isolated route.** Rationale in §5.

Scene graph (one `<Canvas>`, one world, camera on a spline):

```
<FoundersMovementCanvas>            // client, dynamic(import, { ssr:false })
  <AdaptiveDpr /> <PerformanceMonitor onDecline={degrade} />
  <CameraRig spline={ROAD_SPLINE} progress={scrollProgress} />
  <Environment>                      // gradient sky dome (shader, no HDRI file)
    <SunriseSky /> <FogVolume />     // exp2 fog, colour keyed to scene index
  </Environment>
  <Road />                           // extruded strip + instanced dashes + mile markers
  <Truck />                          // 1 GLB, ≤ 8k tris, baked AO, 1 material atlas
  <RoadsideSigns items={BUILT} />    // instanced planes + SDF text
  <GhostSigns items={FUTURE} />
  <FoundersWall3D founders={data} /> // see §13 — fully data-driven
  <School lod={p > 0.8 ? 1 : 0} />   // 1 GLB, 2 LODs
  <Particles count={adaptive} />     // dust/light-shaft billboards, 200 desktop / 60 mobile / 0 low-power
</FoundersMovementCanvas>
```

Key decisions:
- **One canvas, one world** — no per-section canvases (context-switch cost, GC churn).
- **Text = troika-three-text SDF** (ships with tiny font subset), *not* geometry text — thousands of names at one draw call per material tier via instancing + text batching.
- **Scroll drive:** GSAP ScrollTrigger scrubs a single `progress` uniform; R3F `useFrame` interpolates with critical damping (no scroll-jack — native scroll retained, the camera follows it).
- **HTML layers** live outside the canvas in normal document flow with `position: sticky` chapters; the canvas is `position: fixed` behind them at `z-index: 0`, `pointer-events: none` except Scene 6 (wall picking), where a transparent picking layer forwards clicks — keyboard users get the DOM list, which drives the same selection state.
- **State:** one tiny store (React context; Zustand only if profiling justifies it) holding `{ progress, sceneIndex, soundOn, quality, selectedFounderId }` — shared by canvas, DOM, and audio.
- WebGL loss/absence: `webglcontextlost` + capability check ⇒ swap to poster + pure-HTML mode (which is always rendered anyway).

---

## 5. Recommended library stack (evaluated)

| Option | Verdict | Why |
|--------|---------|-----|
| Three.js (raw) | ❌ base only | R3F wraps it; raw Three means hand-rolled React lifecycle glue we'd rewrite anyway. |
| **React Three Fiber** | ✅ core | Declarative scene graph in the existing React 18/Next 14 app; ~50KB gz over three. |
| **Drei** | ✅ cherry-picked imports only | `Text` (troika), `AdaptiveDpr`, `PerformanceMonitor`, `useGLTF` — tree-shaken, no kitchen sink. |
| **GSAP ScrollTrigger** | ✅ | The only battle-tested scrub engine that stays 60fps with native scroll on iOS Safari. ~30KB gz. Free license covers this use. |
| Framer Motion | ❌ | Overlaps GSAP for this page; its strength (layout/AnimatePresence) isn't needed. Two animation runtimes = wasted budget. |
| Lottie | ❌ for now | No After Effects assets exist; SVG/CSS covers secondary motion. Revisit only if a designed Lottie is supplied. |
| CSS-only | ✅ as the **fallback tier** and for all text/UI motion | Headline rises, sign hovers, reduced-motion mode, and the entire POC. |
| GLB/GLTF + Draco/Meshopt | ✅ | All models; Meshopt via gltfpack. |
| WebP/AVIF | ✅ | Poster + any baked textures (KTX2/Basis for GPU textures). |
| Web Audio API | ✅ (no library) | Small hand-rolled `AudioEngine` (§7); Howler et al. unnecessary. |

**Total added JS (production experience): ~145–165KB gz** (three+R3F ~110,
Drei used-parts ~15, GSAP+ScrollTrigger ~30) — **loaded only on this route,
only after poster interaction/visibility** (§8). The rest of the site ships zero of it.
**The POC ships 0 new KB** (CSS 3D + Canvas2D + Web Audio, no deps).

---

## 6. Component map

```
src/app/(community)/founders-movement/page.tsx     // server: metadata, data fetch, full HTML story
src/components/founders-movement/
  ExperienceShell.tsx        // client boundary: quality/reduced-motion/webgl detection, poster, lazy-load
  Canvas/                    // production phase only (R3F) — dynamic import chunk
    FoundersMovementCanvas.tsx, CameraRig.tsx, Road.tsx, Truck.tsx,
    SunriseSky.tsx, RoadsideSigns.tsx, FoundersWall3D.tsx, School.tsx, Particles.tsx
  chapters/                  // semantic HTML per scene (server components)
    ChapterHero.tsx …ChapterLegacy.tsx (8)
  WallList.tsx               // accessible founder DOM (reuses FoundersWallList patterns)
  FounderStoryPanel.tsx      // dialog: name, tier, message; canvas + DOM both open it
  SoundToggle.tsx            // persistent control, aria-pressed, localStorage
  audio/AudioEngine.ts       // §7
  useScrollProgress.ts       // shared scrub state
  usePrefs.ts                // reduced-motion, save-data, deviceMemory, webgl
```

POC implements: `page.tsx`, `ExperienceShell` (as `HeroScene`), `WallScene`
(CSS-3D placeholder of `FoundersWall3D`), `SoundToggle` + `AudioEngine`
(oscillator-based placeholder), chapters as plain sections.

---

## 7. Audio architecture

- **Off by default. Nothing downloads, nothing constructs, until the user
  presses "Enter with sound" or the toggle.** First gesture ⇒ `new AudioContext()`
  (satisfies autoplay policies by construction).
- Graph: `master GainNode (0 → fade 400ms)` ←
  - `ambience` bus: engine-idle/highway loop (streamed `<audio>` element piped in, ~24s seamless loop)
  - `music` bus: cinematic bed, −18 LUFS under ambience, scene-crossfaded
  - `sfx` bus: heading thud (90ms), name-engrave tick — sample-players, ≤ 3 concurrent
- Behaviors: fade in/out 400ms on toggle; `visibilitychange` hidden ⇒ fade to 0 &
  `ctx.suspend()`; visible + still opted-in ⇒ resume. Volume follows device
  (no fake in-page volume slider; a single mute/on toggle persisted in
  `localStorage('tlws-fm-sound')` — default **off** every first visit).
  `prefers-reduced-motion` ⇒ also default the *offer* to a quieter UI (button
  present, no pulsing).
- POC placeholder: synthesized rumble (brown-noise buffer → lowpass 90Hz →
  slow LFO on gain) — zero bytes of audio assets, same engine interface
  (`engine.enable() / disable() / duck()`), so production only swaps sources.
- Licensing: only original/commissioned or verified royalty-free (CC0 /
  paid-license with certificate) audio enters the repo; owner-supplied files
  require written confirmation of rights. No commercial music, ever.

---

## 8. Performance strategy & budgets

Load ladder:
1. **SSR HTML + poster** (AVIF ≤ 60KB, exact aspect box — zero CLS). All story
   content readable immediately. This is also the permanent experience for
   reduced-motion / no-WebGL / save-data / low-power users.
2. On **visibility + idle** (or explicit "Play"): dynamic-import the canvas chunk.
3. Audio only on explicit opt-in (§7).

| Budget | Ceiling |
|--------|---------|
| Route-initial JS (before canvas chunk) | **≤ 30KB gz** over the site baseline |
| Canvas chunk (three+R3F+Drei+GSAP+scene code) | **≤ 180KB gz**, lazy |
| Truck GLB (Meshopt) | ≤ 300KB |
| School GLB (2 LODs) | ≤ 250KB |
| Road/signs/wall geometry | generated, ≤ 30KB code |
| Textures total (KTX2) | ≤ 700KB, max 1024² each |
| Font subset for SDF names | ≤ 40KB (WOFF2 subset A–Z, a–z, 0–9, ’-.&) |
| Audio (all, only after opt-in) | ≤ 900KB (Opus/AAC) |
| **First-load total (poster path)** | **≤ 250KB** incl. images |
| **Fully-enhanced total** | **≤ 1.6MB**, amortized over interaction |
| Frame budget | 60fps desktop / 40fps mid phone; `PerformanceMonitor` decline ⇒ drop DPR → particles → fog → static |

Adaptive quality inputs: `deviceMemory ≤ 4`, `hardwareConcurrency ≤ 4`,
`saveData`, battery API where present, first-100-frames FPS sample.

---

## 9. Mobile fallback & 10. Accessibility plan

- **Mobile default = "lite" tier:** poster hero with CSS light-sweep, CSS-3D wall
  (the POC's implementation *is* this tier), no WebGL until tapped "Play the drive"
  — and never on `saveData`/low-power.
- `prefers-reduced-motion: reduce` ⇒ no ignition, no scrubbing, no counters
  animating, no parallax; static sunrise imagery; **all content identical**.
- Semantic structure: one `<h1>`, 8 `<section>`s with `<h2>`s, real `<a>` links,
  founder list as `<ul>`; the canvas carries `aria-hidden="true"` and duplicates
  nothing textual.
- Keyboard: wall tiles are DOM buttons (roving tabindex within the wall grid);
  story panel is a focus-trapped `role="dialog"` with Esc close; visible
  focus ring (site standard) everywhere; skip-link "Skip cinematic intro".
- Sound: off by default, persistent visible toggle, `aria-pressed`, no
  information conveyed by audio alone (thud = decoration).
- Long animation control: "Pause motion" control freezes the scrub damping and
  particle drift (WCAG 2.2.2) — reduced-motion users never see motion at all.
- Contrast: text layers on scrims (asphalt-900/70 backdrop) — AA minimum 4.5:1.
- No flashing content anywhere (max 1 light-sweep per scene entry).

---

## 11. SEO plan

- Server-rendered H1 + full copy for all 8 chapters (they are the DOM; canvas
  is decoration). Founder names render in the DOM list — crawlable.
- Existing metadata pipeline (`buildMetadata`) with canonical; **POC ships
  `robots: noindex,nofollow`** until content is approved for production.
- Structured data: `Organization` (Trucking Life), `Event`-like `Project`
  avoided (no invented types) — use `Organization` + `BreadcrumbList` +
  optional `ItemList` of founder names; individual founder profile pages are
  **out of scope** until the owner approves per-person URLs (privacy).
- Internal links: the seven "already built" items are real `<a>`s to live routes;
  roadmap items link to existing pages only (no dead links to unbuilt features).
- No copy exists only in canvas. Ever. (Same doctrine as the KC suite: this is
  testable — a future check can assert each chapter's H2 exists in HTML.)

---

## 12. Database-to-3D founder-name strategy

- Single source of truth: existing `founders` table via `getPublicFounders()`
  (RLS: public rows only; **no amounts ever selected** — preserved verbatim).
- Server component fetches once (ISR `revalidate = 60`, same as `/founders`),
  passes the array to both the DOM wall and (production) the canvas — one fetch,
  two renderers, guaranteed consistency.
- 3D rendering: names are **not modeled**. `FoundersWall3D` maps records ⇒
  instanced tile meshes (one instanced mesh per tier material, 5 draw calls)
  + SDF text per name (troika batches). Layout function
  `tileLayout(tierIndex, position)` is pure and shared with the CSS wall.
- Scale: 1,000 names ≈ 5 instanced meshes + ~1,000 SDF quads — well under
  budget; at 5,000+, virtualize by camera frustum (only Scene-6-visible rows
  get text objects; tiles remain instanced). Data changes require zero scene work.
- Tier→material map lives beside `FOUNDER_TIERS` so a future tier is one entry.

## 13. Risk list

| Risk | Sev | Mitigation |
|------|-----|------------|
| iOS Safari scroll-linked jank | H | Native scroll + damped follow (no scroll-jack); test matrix incl. iPhone SE. |
| Bundle creep breaks budgets | H | CI budget check on the route chunk; Drei imports linted to allowlist. |
| Text rendering perf at 1k+ names | M | SDF batching + frustum virtualization (§12); load test with synthetic 5k rows. |
| WebGL context loss on low-RAM phones | M | Poster fallback path is always live; context-lost handler swaps instantly. |
| Audio licensing ambiguity | M | §7 policy: certificate or it doesn't ship. |
| Motion sickness complaints | M | Restrained grammar (§3), pause control, reduced-motion parity. |
| Scope creep into replacing `/founders` | M | This route stays separate + noindex until explicitly approved. |
| GSAP licensing misunderstanding | L | Standard GSAP + ScrollTrigger are free for this use; no Club plugins. |
| Asset pipeline (Blender→GLB) skills gap | M | §18 prompt outsources asset creation; placeholder primitives unblock dev. |

## 14. Development phases & difficulty

| Phase | Scope | Difficulty | Est. |
|-------|-------|-----------|------|
| 0 (this PR) | Doc + dependency-free POC route | Low | done |
| 1 | R3F shell: canvas, camera spline, road, sky, scroll scrub, budgets CI | Med-High | 3–5 d |
| 2 | Truck + signs + chapters 1–4 choreography | Med | 3–4 d |
| 3 | FoundersWall3D data-driven + story panel + picking | High | 4–6 d |
| 4 | School, particles, adaptive quality, full a11y audit | Med | 3–4 d |
| 5 | Audio production integration + polish + device matrix | Med | 2–3 d |
| Total | | | ~3–4 wk part-time |

## 15. Exact prototype scope (this PR — Phase 0)

- `/founders-movement` route, **noindex**, isolated; production `/founders` untouched.
- Dependency-free hero: CSS/SVG sunrise road + truck silhouette, ignition
  sequence honoring reduced-motion, skippable, founder count from live
  `getCampaignProgress()` (read-only), CTAs.
- Placeholder wall: CSS-3D tier-material tiles with **sample names only**
  (no production founder data in the POC wall), scroll reveal, keyboard-openable
  story panel.
- Sound toggle + "Enter with sound": Web Audio synthesized rumble placeholder,
  off by default, fades, suspends on tab hide, persisted preference.
- All 8 chapters as semantic HTML with real links.
- Acceptance criteria in §17.

## 16. Asset production prompt (for the 3D artist / asset generation)

> Create original, game-ready GLB assets for a cinematic web experience
> (Meshopt-compressed, Y-up, meters, PBR metal-rough, single 1024 atlas each,
> baked AO, no embedded lights/cameras, no copyrighted logos except supplied
> "Trucking Life" marks):
> 1. **US Class-8 sleeper-cab semi-truck, generic design** (must not replicate
>    any real manufacturer), ≤ 8,000 tris, closed doors, separate wheel nodes
>    for slow roll, trailer optional as second file ≤ 4,000 tris. Dark cab with
>    signal-yellow accent stripe (#FFEB00-adjacent), lightly weathered.
> 2. **Single-story CDL training school building**, ≤ 6,000 tris + LOD1
>    ≤ 1,500: metal-panel facade, glass entry, pole sign reading "TRUCKING LIFE
>    ACADEMY" (texture, editable), practice-range strip with cone props
>    (instanceable single cone mesh). Warm interior light bake for windows.
> 3. **Wall tile set**: 5 tileable 512² PBR material sets — fired brick,
>    brushed steel, cast iron, machined platinum, warm bronze — with matching
>    normal/roughness maps, plus one plain plaque mesh (≤ 60 tris) that accepts
>    a decal slot for engraved text.
> 4. **Roadside sign kit**: interstate-style green sign, ≤ 120 tris, blank face
>    for runtime texture. All assets original work, full rights transferred.

## 17. Acceptance criteria (production experience; POC where noted)

1. Route ships full story in server HTML; disabling JS/WebGL/audio loses zero
   information (POC: yes).
2. Sound is off by default; no `AudioContext` before gesture; toggle persistent
   and keyboard-operable (POC: yes).
3. `prefers-reduced-motion` yields a fully static page with identical content
   (POC: yes).
4. LCP ≤ 2.5s on mid-tier Android (poster path); CLS < 0.02; route-initial JS
   over baseline ≤ 30KB gz (POC target: ≈0 over baseline).
5. Canvas chunk lazy, ≤ 180KB gz; models/textures within §8 budgets.
6. Founder wall renders entirely from DB records; adding a founder requires no
   scene changes.
7. Wall interaction: mouse, touch, keyboard, and screen-reader paths all open
   the same story panel.
8. 40fps+ on a 2021 mid-range phone; graceful degrade ladder verified.
9. No copyrighted audio/models; licenses documented in-repo.
10. Production `/founders` behavior unchanged until an explicit migration PR.

## 18. Audio production prompt (for the composer / sound designer)

> Produce an original, royalty-free-transferable audio set, delivered as
> 48kHz WAV masters + Opus web encodes, with a signed license granting
> Trucking Life with Shawn perpetual web use:
> 1. **Engine/ambience bed** (~24s seamless loop, ≤ 300KB Opus): distant
>    Class-8 diesel idle blended with pre-dawn highway air; low-passed,
>    −24 LUFS integrated; no melodies, no birds.
> 2. **Cinematic bed** (~90s, loopable at bar boundary, ≤ 450KB): slow build,
>    sparse — low strings/synth pads + a restrained percussive pulse
>    suggesting wheels on expansion joints; keys avoid brightness until a
>    final warm major lift ("sunrise"); −20 LUFS, sits under ambience.
> 3. **UI sfx**: one 90ms soft low thud (heading land), one 60ms metallic
>    "engrave" tick; −18 LUFS peaks, no transients above −6dBFS.
> All material must be original composition/recording — no samples requiring
> attribution, no commercial-track interpolation.

---

*Doc version: 2026-07-19. Author: platform automation for Shawn Gresham.*

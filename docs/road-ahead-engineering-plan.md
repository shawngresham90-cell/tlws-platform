# THE ROAD AHEAD — Engineering Implementation Plan (Phase 0)

**Scope:** Engineering blueprint to build the approved *THE ROAD AHEAD* cinematic
treatment as a production web experience. **Planning only — no production code in
this document.** The treatment is the source of truth; nothing here re-designs it.

**Guardrails carried through every phase:** no merges · no database changes · no
production changes · `/founders` (live wall) untouched · founder payment records
untouched · founder data strictly read-only · audio never autoplays · reduced-motion
gets the complete story · `noindex` until owner sign-off.

**Grounding:** this plan *extends* the FM prototype already on `claude/founders-movement-poc`
(PR #153). It does not restart it. Existing assets reused as-is: `ExperienceShell`
(capability ladder), `SpineCanvas` (R3F scroll rig), `audio.ts` (3-bus swap-ready
engine), `identity.ts` (in-memory preview identity), `getPublicFounders()` +
canonical numbering.

---

## 1. TECHNICAL ARCHITECTURE

### 1.1 The core decision: one conductor, three stages

The treatment is a **timeline** (7 scenes, ~110s) that the visitor scrubs with
scroll. The cleanest architecture is a single **master timeline** ("the conductor")
that every visual/audio system reads from. Nothing owns its own clock.

```
                 ┌──────────────────────────────────────────┐
                 │  MASTER TIMELINE  (GSAP ScrollTrigger)     │
                 │  progress 0..1  •  velocity  •  scene label│
                 └───────────────┬────────────────────────────┘
                                 │  single normalized scroll store
      ┌──────────────┬───────────┼───────────────┬──────────────────┐
      ▼              ▼           ▼                ▼                  ▼
  R3F 3D LAYER   VIDEO LAYER   GRADE/FX LAYER   HTML STORY LAYER   AUDIO ENGINE
  (three/R3F)    (<video>)     (LUT+letterbox   (real DOM text,    (audio.ts buses,
  spine, campus,  pooled,       +particles)      captions, CTA)     cue map keyed to
  founders wall   poster-first                    SR-friendly        timeline labels)
```

This resolves the GSAP-vs-R3F question **without throwing away the R3F spine**:
GSAP owns *orchestration* (pinning, scrubbing, scene sequencing, text/video cues);
R3F owns *3D rendering*. They communicate through one shared scroll-progress store —
which is exactly what `SpineCanvas` already reads per-frame from the DOM. We formalize
that read into a `useCinemaProgress()` store and let both worlds subscribe.

### 1.2 Layer stack (back → front)

| z | Layer | Tech | Present when |
|---|-------|------|--------------|
| 0 | 3D world | R3F + three | capable device, motion allowed |
| 1 | Footage | pooled `<video playsinline muted>` | per-scene, lazy, poster-first |
| 2 | Grade / FX | CSS filter or WebGL LUT + letterbox + particle canvas | always (cheap CSS tier) |
| 3 | Story | real HTML (Anton cards, VO captions, CTA) | **always — carries the whole story with zero audio/3D** |
| 4 | Chrome | sound toggle, skip link, truck progress marker | always |

Layer 3 is the accessibility spine: server-rendered, screen-reader friendly, and it
alone tells the complete story. Layers 0–2 are progressive enhancement gated by the
capability ladder.

### 1.3 Capability ladder (extends existing `ExperienceShell`)

```
Tier FULL     WebGL ok + motion ok + not Save-Data  → 3D + video + audio-optional
Tier VIDEO    no/weak WebGL, motion ok              → video + grade + HTML (no 3D)
Tier LITE     reduced-motion OR Save-Data OR no JS  → HTML story + posters + crossfades
```

The ladder already exists for the spine; we widen it to also decide video vs 3D-video.
Downgrade is one-way per session and driven by the existing rolling-FPS sampler.

### 1.4 Route & rendering

- Stays at `/founders-movement`, `noindex`, server-rendered shell, ISR (`revalidate`).
- Server renders the full HTML story + founder data (read-only) so LITE tier and
  crawlers get everything. Client hydrates and lazy-loads the cinema bundle only on
  FULL/VIDEO tiers.
- Production cutover to `/founders` is a **separate, owner-approved** step — never
  automatic.

---

## 2. THREE.JS / WEBGL RECOMMENDATIONS

- **Keep `three ^0.168` + `@react-three/fiber ^8.18`.** No engine migration; the spine
  and its performance ladder already exist and pass the budget gate.
- **Add `@react-three/drei` selectively or not at all.** We need only `Html`, a
  `shaderMaterial` helper, and texture loading — all hand-rollable. Recommendation:
  **import à-la-carte from drei (tree-shaken) or hand-roll**, and let the budget gate
  decide. Do not pull drei wholesale.
- **No postprocessing/bloom library on mobile.** Fake glow with additive sprite
  textures — the pattern already in `glowTexture()`. If cinematic bloom is wanted for
  the wall, gate a `@react-three/postprocessing` pass to **desktop FULL tier only**.
- **Founders Wall = `InstancedMesh`.** All plaques in one draw call; per-instance
  attributes for tier size, ignition progress, and atlas UV. Names rendered into a
  **canvas texture atlas** (one texture, many names) — the `yearSignTexture()` /
  `CanvasTexture` technique already in the spine, scaled up.
- **Footage-in-3D:** two mechanisms, cheapest-first —
  1. *CSS-3D transform of the real `<video>` element* for most "pull-back reveals"
     (Apple's actual trick; zero GPU texture upload). **Default.**
  2. `THREE.VideoTexture` on a plane **only** when the camera must orbit the screen
     in true 3D (Scene 4 campus reveal). Single texture, paused when off-screen.
- **Rendering discipline (already established, keep):** no shadows, fog-culled draw
  distance, emissive materials, instanced geometry, DPR capped at 2 with one-step
  downgrade under ~34fps.

---

## 3. GSAP ANIMATION ARCHITECTURE

- **Add `gsap` + `ScrollTrigger`** (one dependency; ScrollTrigger is the only plugin
  needed; both tree-shakeable). Must fit the budget gate — see §7.
- **Master timeline** is a single `ScrollTrigger`-scrubbed `gsap.timeline()`. Each
  scene is a **labeled segment** (`scene1`…`scene7`) exposing `onEnter`/`onLeave`
  callbacks that: start/stop the scene's video, fire the audio cue, and hand camera
  keyframes to R3F via the shared store (GSAP animates a plain progress object; R3F
  reads it in `useFrame` — no React re-render per frame, matching the current design).
- **Scroll = throttle.** Sample `ScrollTrigger` velocity → drive playback rate and a
  CSS motion-blur class on fast scroll; slow scroll "savors." Autoplay ▶ WATCH tweens
  `timeline.progress()` 0→1 over ~110s for a hands-free trailer.
- **Scroll-lock exactly twice** (treatment law): opening headlights (4s hold) and the
  empty plaque. Implemented as `ScrollTrigger` pins with a gated release; never more.
- **Pacing law encoded as segment durations** (12→16→14→18→20→20→hard-stop), so the
  Scene-3 silence and Scene-4 explosion land as specified.
- **Reduced-motion:** `gsap.matchMedia()` swaps the scrubbed timeline for sequential
  sections with crossfades — same order, same story, no parallax, no pinning.
- **Progress metaphor:** the tiny truck-on-a-highway marker is a GSAP-driven DOM
  element bound to `timeline.progress()` — no native scrollbar.

---

## 4. VIDEO PIPELINE (the net-new system)

The treatment's whole "$50M-feel on a Netlify budget" rests on **real footage made
monumental**. This pipeline is designed so *Shawn's clips drop in via a manifest —
no code changes.*

### 4.1 The drop-in contract

A single `footage.manifest.json` maps `scene → clip → renditions + poster + timing`.
Adding/replacing footage means uploading files + editing the manifest. Components never
hardcode a file path.

```jsonc
{
  "scene2_montage": {
    "clips": [
      { "id": "backing-trailer",
        "mobile":  "…/backing-trailer.720.mp4",
        "desktop": "…/backing-trailer.1080.mp4",
        "webm":    "…/backing-trailer.vp9.webm",
        "poster":  "…/backing-trailer.jpg",
        "in": 0.0, "out": 1.1 }
    ]
  }
}
```

### 4.2 Ingest → encode ladder (offline, scriptable)

Per source clip (phone footage is fine — grade + letterbox do the work):
- **H.264 MP4** (baseline, universal) — mobile 720×1280 vertical, desktop 1920×1080.
- **VP9/WebM** (smaller, where supported) + optional **AV1/HEVC** for future.
- **Poster** JPEG/WebP (first meaningful frame) so nothing ever shows blank.
- Bake **2.39:1 letterbox** and 9:16 safe-crop into the mobile rendition; letterbox via
  CSS on desktop.
- **Budget: ≤3 MB/clip mobile, ≤6 MB desktop.** Enforced in CI (asset-size gate).

### 4.3 Hosting

Do **not** commit multi-MB binaries into git history. Options, in recommended order:
1. **External object storage / CDN** (e.g. a bucket) referenced by the manifest — keeps
   the repo light, cache-friendly. *(needs owner decision — see §12.)*
2. Netlify Large Media / blob store.
3. Only posters + a tiny placeholder loop live in the repo for dev.

### 4.4 Playback engine

- Pooled `<video>` elements (2–3 reused across scenes), `playsInline muted preload=metadata`.
- Decode on scene-enter (timeline callback + IntersectionObserver), pause + release on
  leave; poster shown until the first frame is ready.
- **Grade:** one LUT for unity — CSS `filter` approximation (cheap, all tiers) with an
  optional WebGL LUT shader pass on desktop FULL for accuracy.
- **Letterbox:** CSS. **Particles** (dust motes, lens flare): one shared instanced
  sprite layer or a lightweight canvas, composited over footage to glue it into the 3D.
- **Fallback:** decode failure / Save-Data / VIDEO-off → poster still + HTML cards carry
  the scene. Muted-first is the default assumption (drivers browse muted).

---

## 5. AUDIO PIPELINE (extends existing `audio.ts`)

The 3-bus, off-by-default, swap-ready engine already exists. We extend, not replace.

- **Add a `music` bus** to the existing `master → {ambience, swell, sfx}` graph.
- **Cue map keyed to timeline labels** (matches the treatment's music map §Part 4):
  S1 drone · S2 percussion build · S3 heartbeat→silence · S4 orchestral rise ·
  S5 intimate piano · S6 theme + key change · S7 **unresolved sustain → resolve stinger
  on CTA click.**
- **Duck-to-near-silence during the name reveal** — already precedented by the FM-3
  Induction ducking; reuse it.
- **"Unresolved chord until the button"**: the music bus holds a sustained pad; the CTA
  click triggers the resolve + engrave stinger. Pure atmosphere — no information in audio.
- **Swap-in for licensed audio:** replace a synth *builder* with a file-backed
  `AudioBufferSource` (fetch → `decodeAudioData`). Buses, cues, ducking, and the UI
  contract are unchanged — governed by an `audio.manifest.json` mirroring §4.1.
- **Hard rules unchanged:** no autoplay; `AudioContext` not built until the first
  explicit enable gesture; stored preference never auto-starts; tab-hidden suspends;
  every visit begins silent.
- **Captions:** all VO scripted → **WebVTT** tracks; the Anton type-cards already carry
  the story with zero audio (muted-first mandate).

---

## 6. FOUNDER WALL RENDERING PIPELINE (the centerpiece)

- **Data (read-only, no DB changes):** reuse `getPublicFounders()` + the canonical
  numbering already computed in `page.tsx` (chronological by earliest `paid_at`; ties by
  position → name). Fails soft to a labeled empty wall — never a 500.
- **Geometry:** one `InstancedMesh` of plaques. Per-instance: tier→size/material (Iron
  bronze-glow largest top row, Steel mid, Brick rows, Final Founders as a tight honor
  grid at the base), atlas UV, and an `ignite` attribute (0→1).
- **Name rendering:** canvas **texture atlas** — each name drawn once into a shared
  texture; instances sample their sub-rect. Keeps the whole wall at ~one draw call and
  bounded memory; paginate the atlas if names exceed one sheet.
- **Ignition ("welding arc"):** a moving emissive point sweeps the wall (GSAP-driven
  position on the master timeline). As the arc passes each plaque, its `ignite` uniform
  runs a **0.4s letter-etch** reveal + a metallic *ting* on the `sfx` bus. Iron→Steel→
  Brick→Final ordering matches the treatment.
- **Type-your-name (the "killer" moment, Scene 5):** an input field renders the typed
  name into the **empty plaque #33** canvas in real time and runs the same etch shader.
  **In-memory only** (reuse `identity.ts`): zero POSTs, dies on refresh — permanence is
  what *joining* buys. The already-built FM-3 canvas Founder-Card PNG export covers "grown
  men will screenshot this."
- **Hollywood lighting:** warm uplights = emissive materials + additive glow sprites (no
  real shadows). Optional bloom **desktop-FULL only**, gated by the ladder.
- **Reduced-motion / LITE:** wall renders **fully lit, static, all names present**; the
  empty plaque is still interactive (type name → static engraved result), no sweep.
- **Live count / urgency:** "Join 32 Founders. 68 plaques remain." driven by
  `getCampaignProgress()`; the ticking number is a GSAP count-up. Read-only.

---

## 7. PERFORMANCE BUDGET

Extends the existing FM budget gate (FM-3 baseline: +2.8 KB initial / 211.5 KB lazy of a
220 KB cap).

| Metric | Budget | Enforcement |
|--------|--------|-------------|
| Initial JS (shell + critical, all tiers) | keep near current; cinema code **not** in initial | existing bundle gate |
| Lazy cinema bundle (R3F + wall + spine) | ≤ 220 KB (current gate) | CI budget gate |
| **GSAP + ScrollTrigger** | must fit lazy budget (≈30–40 KB gz) — **raise gate with written justification or trim** | CI |
| Video per clip | ≤ 3 MB mobile / ≤ 6 MB desktop | new asset-size gate |
| Full-watch mobile transfer (progressive) | target ≤ ~15–20 MB, streamed scene-by-scene | manual + Lighthouse |
| **First scene interactive on LTE** | **< 3 s** (treatment mandate) | Lighthouse mobile throttled |
| Frame rate | 60 fps desktop / 30 fps floor mobile | rolling FPS sampler (exists) → tier downgrade |
| Texture memory (wall atlas) | bounded, single atlas + paging | review |

**Levers:** scene-level code-splitting; asset lazy-load with poster-first; Save-Data and
reduced-motion honored; DPR cap 2 + one-step downgrade; instancing; no shadows/no mobile
postprocessing. If GSAP breaches the gate, we raise it *only* with a justification note in
the PR, as prior FM phases did.

---

## 8. ASSET REQUIREMENTS

**Video — Shawn's shot list (treatment Part 9, one afternoon, phone OK):**
dark highway drive-by · hands on wheel · pre-trip walkaround · student in passenger seat ·
key handoff (staged fine) · ProStar hero at golden hour · walking toward the trailer/lot.
**Additional footage the storyboard references:** student overwhelmed / empty training
yard (S3) · road-test pass or key handoff (S6) · a young driver walking past the wall on
opening day, slow-mo tracking (S6 hero). *Shoot 4K where possible; vertical-safe framing.*

**Audio:** one licensed ~2-min trailer track with a quiet middle (Epidemic/Artlist per
the music map) · SFX set (Jake brake, CB squelch, air-brake release, turn-signal click,
fluorescent hum, pen scratch, brick THUD, turbo spool, welding-arc crackle, door +
footsteps + school ambience) · Shawn VO (close-mic, per scene) · **WebVTT** captions for
every VO line.

**Graphics/3D:** Anton display font (self-hosted WOFF2, subset) · teal/amber **LUT** file
· a brick model (or procedural) for the Scene-3 drop · US + Georgia flags (low-poly or
procedural) · campus silhouette geometry (low-poly, emissive) for Scene 4.

**Contract files:** `footage.manifest.json` + `audio.manifest.json` — the drop-in seams so
production assets replace placeholders with **no code change.**

---

## 9. SCENE-BY-SCENE ENGINEERING PLAN

For each scene: active layers · 3D · video · GSAP segment · audio cue · scroll behavior ·
interactive moment · reduced-motion equivalent. Maps onto existing components where noted.

**S1 "The Dark Road" (0:00–0:12) — `HeroScene` + spine.** 95% black R3F scene, lone
headlights (existing glow sprites). Video: dark-highway clip as graded underlay. GSAP:
`scene1` pins 4s (scroll-lock #1), first scroll sweeps headlights → title. Audio: drone
(ambience). Reduced-motion: static hero image + title, no lock.

**S2 "17 Years" (0:12–0:28) — video-led.** Rapid montage from `footage.manifest`
(`scene2_montage`), each clip 0.8–1.2s, 2–4% Ken-Burns push-in. Anton cards
`17 YEARS`→`ZERO VIOLATIONS`→`THOUSANDS OF STUDENTS`→`ONE PROMISE` synced to beat. GSAP:
each scroll tick = one montage beat + one card; velocity → motion blur. Audio: taiko
percussion; air-brake/turn-signal as rhythm. Reduced-motion: static poster grid + cards
in sequence.

**S3 "The Problem" (0:28–0:42) — desaturate + silence.** Cold-gray grade (LUT swap),
slow-mo overwhelmed-student footage, glitching predatory-school neon (CSS/canvas). The
"brick by brick" line drops a single 3D brick (R3F) with screen-shake + haptic. Audio:
everything cuts to a heartbeat kick, then silence (the held breath). Reduced-motion: brick
appears without shake; grade via static class.

**S4 "The Answer" (0:42–1:00) — the footage→3D reveal.** Hard cut to full color/golden
grade. Real ProStar/Dalton footage plays full-bleed, then **camera pulls back** to reveal
it as a glowing billboard inside the low-poly 3D campus (mechanism: CSS-3D transform
default; `VideoTexture` if true orbit needed). Six ecosystem waypoints ignite along the 3D
highway (CDL SCHOOL → GPS → COMMUNITY → VOICE CORRIDORS → MARKETPLACE → MOBILE APPS) with
sub-bass *whum*. GSAP: one continuous pull-back-and-rise camera tween handed to R3F. Audio:
full orchestral rise. Reduced-motion: crossfade from footage to a static campus still +
the waypoint list.

**S5 "The Wall" (1:00–1:20) — centerpiece, `WallScene`.** Camera descends to the founders
monument. Welding-arc ignition sweep lights real names (§6). Empty plaque #33 flickers →
"YOUR NAME HERE" → **type-your-name real-time engrave** (in-memory). GSAP: `scene5` pins at
the empty plaque (scroll-lock #2). Audio: intimate piano over strings; *ting* per name;
duck during the reveal. Reduced-motion: full static lit wall, interactive input yields a
static engraved plaque.

**S6 "Emotional Climax" (1:20–1:40).** Split-blend of road-test/key-handoff footage with
the 3D wall; hero slow-mo of a young driver walking past the glowing wall. The "money copy"
VO with captions. Proverbs 21:5 engraved beneath the wall (real HTML text). Audio: warm
full theme, one key change. Reduced-motion: sequential stills + full captioned copy.

**S7 "The Call" (1:40–2:00) — `LegacySignature` + CTA.** Everything falls to black except
the glowing wall and four forged tier cards (IRON $1,000 · STEEL $500 · BRICK $100 · FINAL
$35). Legacy lines type on black. **One huge CTA** pulsing at 60 BPM: "CLAIM MY SPOT ON THE
WALL →" → tier selection / payment (existing flow; this experience only *links* to it —
**no payment code touched**). Live "Join 32 Founders. 68 plaques remain." Audio: unresolved
sustain → resolve stinger on click. Reduced-motion: static cards + CTA, no pulse.

**Money rule (enforced):** every scene funnels to ONE button; no nav bar, no outbound
links during the experience; a skip link jumps repeat visitors straight to Wall + tiers.

---

## 10. MOBILE OPTIMIZATION PLAN (80%+ of traffic — designed here first)

- **Vertical-native:** the highway runs *toward* the viewer (into the screen), not L-R.
- **Thumb-scroll is the only interaction** — zero hover states anywhere.
- **Footage:** 9:16 with letterbox, ≤3 MB/clip, lazy per scene, poster-first.
- **Haptics:** `navigator.vibrate` short pulse on brick-drop and name-engrave beats
  (feature-detected; silent where unsupported).
- **Progressive load:** first scene interactive **< 3 s** on truck-stop LTE or drivers
  bounce; later scenes stream in behind it.
- **Tiering:** the capability ladder gives weak devices the VIDEO tier (no 3D) and the
  weakest/Save-Data/reduced-motion the LITE tier (posters + crossfades) — all three tell
  the full story.
- **Autoplay-safe video:** `muted playsInline`; ▶ WATCH for hands-free trailer pacing.

---

## 11. ACCESSIBILITY (non-negotiable, from treatment Part 7)

- Full **WebVTT captions** on every VO line; muted-first assumed (type cards carry the
  story with zero audio).
- **Reduce-motion** flag swaps parallax/3D for elegant crossfades — same seven-scene
  story, fully working type-your-name.
- All story text is **real HTML** (screen-reader friendly), never baked into video.
- Contrast: yellow `#FFEB00` / white on near-black passes WCAG AA everywhere.
- **Skip link:** "Skip to Founders Wall & Tiers" — never make a returning buyer sit
  through the trailer to pay.

---

## 12. PHASED IMPLEMENTATION ROADMAP

Each phase = its own **draft** PR · no merge · no DB · `/founders` untouched · budget gate ·
reduced-motion parity · secret scan. Placeholder footage/audio until Shawn's assets land;
manifests make the swap a no-code drop-in.

- **Phase 0 — Planning (this document).** ✅ Blueprint delivered. Awaiting owner sign-off
  on the §13 decisions before any code.
- **Phase 0.5 — Scaffolding (no visible change).** Add GSAP; define `footage.manifest.json`
  + `audio.manifest.json`; build the video playback engine + `useCinemaProgress()` store;
  wire the master timeline skeleton; asset-size CI gate. Ships behind the existing prototype
  with placeholders.
- **Phase A — Emotional core (treatment "Phase 1"): Scenes 1, 2, 5, 7.** Headlights open,
  17-year montage (first real footage-pipeline use), Wall ignition with live data +
  type-your-name, CTA. ~80% of the emotion. Uses placeholder clips.
- **Phase B — The turn (treatment "Phase 2"): Scenes 3, 4, 6.** Footage→3D floating-screen
  reveal, ecosystem highway, emotional climax, full music/VO + captions.
- **Phase C — Cinematic polish.** Desktop bloom, WebGL LUT pass, particle systems,
  ▶ WATCH autoplay, haptics, final perf + Lighthouse pass to the <3 s LTE target.
- **Phase D — Real-asset integration + validation.** Drop Shawn's footage and licensed
  audio via manifests; full browser/device matrix; accessibility audit; reduced-motion +
  LITE parity sign-off.
- **Cutover (owner-gated).** Only after review does `/founders-movement` replace/absorb the
  live `/founders` wall. Never automatic.

---

## 13. DECISIONS NEEDING OWNER SIGN-OFF (before Phase 0.5 code)

1. **Add GSAP** (`gsap` + `ScrollTrigger`) as a dependency — it may push the lazy bundle
   gate up ~30–40 KB (justified in-PR). OK?
2. **Video hosting:** external bucket/CDN (recommended, keeps repo light) vs Netlify Large
   Media vs committing renditions. Which?
3. **Licensed music + VO budget:** the plan assumes one licensed ~2-min track + Shawn VO;
   until then everything runs on placeholders/synth. Confirm the licensing path.
4. **Type-your-name stays in-memory only** (zero writes, dies on refresh). Confirm that's
   the intended behavior (permanence = joining).
5. **Branch strategy:** continue on `claude/founders-movement-poc` (PR #153) or open a fresh
   `claude/road-ahead` line for the cinematic build? (My standing designated branch is the
   KC branch, so I need an explicit branch for this work.)

Nothing in Phases 0.5+ starts until these are answered and you give the go.

---

*Source of truth: THE ROAD AHEAD — Founders Cinematic Treatment. This plan engineers that
vision without altering it. "Keep the shiny side up."*

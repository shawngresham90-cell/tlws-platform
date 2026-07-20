# THE ROAD AHEAD — cinematic polish report

Living record of the visual/cinematic polish passes on `/road-ahead`, plus the
performance / accessibility / mobile validation that each pass is held to. The
architecture and the zero-code media pipeline are documented in
[`road-ahead.md`](./road-ahead.md); this file is the "what got more cinematic and
what it cost" log for visual review.

## Movie-trailer + museum-exhibit targets → what's implemented

| Target | Implementation | Gated by |
| --- | --- | --- |
| **Cinematic scene transitions** | GSAP layer fires two beats per scene cut: a scene-tinted **mood bloom** and a bright **diagonal light-flare rake** (passing-headlight / lens-flare read). Tint warms across the drive — cold night (scenes 1–3) → dawn (4) → signal gold (wall / name / payoff). | Lazy `dynamic(ssr:false)`, mounted only when motion is on; flare dropped on phones (blur+blend), bloom kept. |
| **Founder Wall camera movement** | The whole volumetric light field (shafts + sweep + motes) **dollies horizontally with scroll** — a compositor-only `translate3d` driven by the wall's own scroll progress. Reads as a slow camera pan across the exhibit. | Transform-only; atmosphere is JS-mounted only when motion on; drift zeroed under reduced motion. |
| **Volumetric lighting** | 3 swaying light shafts + a slow gallery light-sweep + 22 drifting dust motes + a breathing key spotlight (Scene 5). | Pure CSS; shafts/sweep dropped on phones, motes halved. |
| **Premium material rendering** | Iron / brushed steel / carved red-clay brick / brass sponsor plaques — procedural gradients + inline feTurbulence, zero image textures. Focused plaque blooms + lifts (camera push) with a weld-flash on carve finish. | — |
| **Historic feeling** | Dated **FOUNDING CLASS · 2026** maker's mark stamped into the induction plate; a carved brass **dedication** closes the wall like a monument base plate. | Static text, no JS. |
| **Name induction — emotional impact** | Staged induction: plate pushes to the lens under a breathing spotlight halo, name cut in letter-by-letter with dust + synchronized carve audio + audio duck, a **one-shot ember burst** rises on reveal ("forged in"), hallmark warms to gold, reveal names the founder number. | Embers/halo mounted only for the reveal and only when motion on; instant static reveal under reduced motion. |
| **Zero-code footage** | Drop a file **or** map a YouTube-Unlisted clip (`youtube-sources.json`) → scene lights up on redeploy, no component edits. | Build-time manifest (no runtime `fs`). |

## Per-scene status

**Currently mapped footage (YouTube-Unlisted):** Scene 1 → `night-driving`
(`wsanOA1aJ1U`), Scene 2 → `pretrip` (`Okpkg_xjwX8`), Scene 3 →
`late-night-driving` (`PQPWyX98fMU`), Scene 7 → `truck-driving-away`
(`0xgnGSxdMGI`). All vertical Shorts (play centered in the 16:9 frame); replace
with landscape or `.mp4` files any time — one edit to
`public/road-ahead/youtube-sources.json`, no code change. Scenes 3 & 7 were
placed sight-unseen and are trivially reassignable after visual review.

**Pending, unassigned:** additional owner clips are parked in
`youtube-sources.json` under `_pending_unassigned` (ignored by the generator, so
they render nowhere) until the owner confirms a scene for each — no guessing.
Every narrative scene without an assigned clip shows its bespoke cinematic
atmosphere, so the experience reads complete with or without footage.

On the **full tier** (WebGL-capable desktop) the continuous 3D truck spine drives
behind scenes 1–4/7; the bespoke CSS atmosphere below is the **lite-tier + mobile**
equivalent and the footage fallback. Any scene auto-swaps to a dropped-in clip
(file or YouTube) with zero code changes.

| Scene | Beat | Cinematic state | Awaiting |
| --- | --- | --- | --- |
| 1 · Dark Highway | Cold open | **`NightHighwayFX`** — deep sky, a horizon glow that swells with scroll (the light you drive toward), converging center-line dashes streaming under the camera, passing oncoming headlights, drifting fog. Cold-tinted entry flare. | Night footage (`dark-highway` …) / narration |
| 2 · The Pre-Trip | The craft | Drifting key light + vignette + film grain; cold flare; air-brake audio cue on enter | Pre-trip footage |
| 3 · The Grind | Sacrifice | Right-aligned copy pacing; cold-blue flare | Rain / truck-stop footage |
| 4 · First Light | The future | **`FirstLightFX`** — a cool morning sky brightening to a white-hot sun cresting the horizon, a wide anamorphic lens flare, and soft rays (distinct from Scene 7's golden dusk). Dawn-warm entry flare; ecosystem cards stagger-reveal over their own dark backing. | Sunrise / hero / drone footage |
| 5 · Founder Wall | **Exhibit** | Volumetric light field + scroll camera dolly + carved plaques + dedication | Optional wall ambience clip |
| 6 · Name Induction | **Emotional peak** | Halo push + letter carve + ember burst + dated hallmark | Optional narration bed |
| 7 · Legacy | **Emotional payoff** | **`DawnHorizonFX`** — a sunrise that breaks and warms with scroll, god rays fanning from the horizon, a lone truck silhouette rolling into the light. Warm-gold flare; dual CTA. | Student / key-handoff footage |

## Performance report

- Route first load holds at **≈18.1 kB / 115 kB** — `three.js`, `@react-three/fiber`, and `gsap` are **all code-split** out of the route-initial bundle (verified in `next build` output). The YouTube backdrop is a plain iframe; the hallmark / dedication / embers and the Scene 1/7 atmosphere are pure markup + CSS — **no added route JS beyond two tiny presentational components**.
- New motion is **transform/opacity** plus a couple of cheap masked `background-position` streaks (compositor-friendly): the transition flare/bloom, the wall camera dolly, the ember burst, the highway lane streaks, the sunrise, and the god rays never trigger layout. GSAP runs on its own ticker and never touches the native `--p` scroll timeline.
- **Mobile perf budget:** the blurred + screen-blended transition flare, the wall light shafts / gallery sweep, and the Scene 7 conic **god rays** are dropped under `max-width: 768px`; dust motes are halved. The cheap tinted bloom, the compositor-only camera dolly, the ember burst, and the Scene 1 lane streaks / oncoming lights remain.
- Scenes 1 and 7 render their bespoke atmosphere **only on the lite tier / mobile and only while the scene has no footage** — the full-tier 3D spine and any dropped-in clip take precedence, so effects never stack on top of real media.
- Footage/YouTube decode **only when a scene is on/near screen** (IntersectionObserver) and is skipped entirely under Save-Data / 2g.

## Accessibility validation

- `prefers-reduced-motion` **and** the on-screen pause control both resolve to `reduced`, which **unmounts** every motion layer (atmosphere, GSAP transitions, induction halo/embers) — WCAG 2.2.2 verified by e2e (`document.getAnimations()` shows zero running after pause). CSS backstops zero out every new effect under reduced motion as defense-in-depth.
- Founder names live in the DOM as `sr-only` text (carve glyphs are `aria-hidden`); all decorative light/particle layers are `aria-hidden`. No contribution amount is ever rendered.
- No-JS / pre-hydration renders the full static page (all seven scenes, opacity 1).

## Mobile validation

- Main e2e suite runs in a **real mobile context** (390×844, touch, coarse pointer → lite tier) — 29/29 including the induction flow and the WCAG pause assertion.
- Reduced-motion, no-JS, and homepage-entry suites run at mobile viewport.

## Validation snapshot (this pass)

- Typecheck / ESLint / Prettier clean · **96 unit checks** · `next build` succeeds (18.1 kB / 115 kB)
- **Main e2e 29/0** + **spine e2e 9/9** — real headless Chromium
- Screenshots: Scene 1 night highway (lane streaks + horizon glow) and Scene 7 dawn (sunrise + truck silhouette) captured at mobile and reviewed for legibility; wall exhibit + induction reveal reviewed

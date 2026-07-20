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

| Scene | Beat | Cinematic state | Awaiting |
| --- | --- | --- | --- |
| 1 · Dark Highway | Cold open | Gradient + drifting key light + vignette + film grain; cold-tinted entry flare | Night footage (`dark-highway` …) / narration |
| 2 · The Pre-Trip | The craft | Same atmosphere kit; cold flare; air-brake audio cue on enter | Pre-trip footage |
| 3 · The Grind | Sacrifice | Right-aligned copy pacing; cold-blue flare | Rain / truck-stop footage |
| 4 · First Light | The future | Dawn-warm flare; ecosystem cards stagger-reveal | Sunrise / hero / drone footage |
| 5 · Founder Wall | **Exhibit** | Volumetric light field + scroll camera dolly + carved plaques + dedication | Optional wall ambience clip |
| 6 · Name Induction | **Emotional peak** | Halo push + letter carve + ember burst + dated hallmark | Optional narration bed |
| 7 · Legacy | Handoff | Warm-gold flare; dual CTA (Become a founder / Explore) | Student / key-handoff footage |

## Performance report

- Route first load holds at **≈17.6 kB / 114 kB** — `three.js`, `@react-three/fiber`, and `gsap` are **all code-split** out of the route-initial bundle (verified in `next build` output). The YouTube backdrop is a plain iframe and the hallmark / dedication / embers are static markup + CSS — **no added route JS**.
- All new motion is **transform/opacity only** (compositor-friendly): the transition flare/bloom, the wall camera dolly, and the ember burst never trigger layout. GSAP runs on its own ticker and never touches the native `--p` scroll timeline.
- **Mobile perf budget:** the blurred + screen-blended transition flare and the light shafts / gallery sweep are dropped under `max-width: 768px`; dust motes are halved. The cheap tinted bloom, the compositor-only camera dolly, and the ember burst remain.
- Footage/YouTube decode **only when a scene is on/near screen** (IntersectionObserver) and is skipped entirely under Save-Data / 2g.

## Accessibility validation

- `prefers-reduced-motion` **and** the on-screen pause control both resolve to `reduced`, which **unmounts** every motion layer (atmosphere, GSAP transitions, induction halo/embers) — WCAG 2.2.2 verified by e2e (`document.getAnimations()` shows zero running after pause). CSS backstops zero out every new effect under reduced motion as defense-in-depth.
- Founder names live in the DOM as `sr-only` text (carve glyphs are `aria-hidden`); all decorative light/particle layers are `aria-hidden`. No contribution amount is ever rendered.
- No-JS / pre-hydration renders the full static page (all seven scenes, opacity 1).

## Mobile validation

- Main e2e suite runs in a **real mobile context** (390×844, touch, coarse pointer → lite tier) — 29/29 including the induction flow and the WCAG pause assertion.
- Reduced-motion, no-JS, and homepage-entry suites run at mobile viewport.

## Validation snapshot (this pass)

- Typecheck / ESLint / Prettier clean · **96 unit checks** · `next build` succeeds (17.6 kB / 114 kB)
- **Main e2e 29/0** + **spine e2e 9/9** — real headless Chromium
- Screenshots: wall exhibit + induction reveal (with ember burst + struck hallmark) captured and reviewed

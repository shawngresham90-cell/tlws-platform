# Cinematic Motion Rules

Premium motion feels expensive because it is restrained. This page is the
complete inventory of motion on the platform outside THE ROAD AHEAD — if a
movement isn't listed here, it doesn't ship.

## The inventory (all of it)

| Motion | Spec | Where |
|--------|------|-------|
| Section reveal | 220ms, opacity 0→1 + translateY 14px→0, ease-out, once | Homepage sections below the fold (`<Reveal>`) |
| Hero fade-up | Existing `animate-fade-up`, once on load | Homepage hero, proof bar |
| Hover lift | 2px rise, 150ms | Placard link cards (`.lift`) |
| Color transitions | 150ms border/text color | Buttons, links, nav (pre-existing) |

(The Movement card's poster still is deliberately static — it is not a link,
and motion on a non-interactive element would promise interactivity it
doesn't have.)

## Why each rule exists

- **Content renders before animation.** SSR output carries no hidden state.
  The `pending` (opacity-0) state is applied by JavaScript only, only to
  elements below the current viewport at hydration time. No JS, slow JS,
  crawler, reader mode → everything visible, always.
- **`prefers-reduced-motion` is a hard gate**, checked before any state is
  applied (`Reveal` exits first thing) *and* enforced in CSS (`[data-reveal]`
  transitions live inside a `no-preference` media query; `animate-fade-up`
  and `.lift` are killed in the reduce block).
- **No layout shift.** Only `opacity` and `transform` ever animate. CLS
  contribution: zero by construction.
- **No scroll hijacking.** IntersectionObserver watches; it never drives.
  Scrolling is never intercepted, smoothed beyond the pre-existing
  `scroll-behavior`, or snapped.
- **Motion never blocks interaction.** A pending section is below the
  viewport by definition; by the time it can be clicked it is revealing.
- **No animation framework.** The entire motion system is one ~50-line
  client component and ~15 lines of CSS. Nothing was added to the bundle
  (`/` first-load unchanged at 105 kB).

## Banned (and why)

- Parallax, scroll-scrubbed timelines — heavy, motion-sick, hijack-prone.
- Looping decorative movement, animated backgrounds — attention theft from
  CTAs; battery cost.
- Carousels, dramatic zooms, fake film countdowns, lens flares — trailer
  cosplay; the brief demands documentary restraint.
- Autoplay video/audio anywhere on the homepage — ROAD AHEAD boundary and
  performance budget.

## THE ROAD AHEAD boundary

`/road-ahead` keeps its own richer cinematic system (scenes, chapters,
ambience). None of it crosses onto other pages. The homepage references it
with exactly: one story card, one approved poster still, one CTA. That
contrast — restrained homepage, cinematic flagship — is the design.

## Adding motion later (the test)

New motion must pass all five: (1) ≤ 300ms, (2) opacity/transform only,
(3) reduced-motion exempt, (4) content-first (never hides SSR output),
(5) it serves comprehension or hierarchy, not decoration. If it fails one,
it doesn't ship.

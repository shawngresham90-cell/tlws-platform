# TLWS Design System — "Steel & Sodium"

The brand feel: the inside of a well-kept Peterbilt at night — dark, warm,
instrument-lit, nothing decorative, everything functional. Cab-at-night dark,
not Silicon Valley dark mode.

Source of truth for tokens: `tailwind.config.ts`. Source of truth for the
signature utilities: `src/app/globals.css`. This document explains how to use
them; it never overrides them.

## 1. Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `signal` (Sodium Amber) | `#F5A623` | Primary CTAs, active states, the money path — **and nothing else** |
| `signal-600` | `#D98C1A` | Amber hover/pressed |
| `asphalt` | `#141414` | Page background. Never pure black (11pm sleeper-cab rule) |
| `asphalt-800` | `#1A1A1C` | Alternate section band |
| `asphalt-700` / `cab` | `#1F1F22` | Cab Panel — card and panel surfaces |
| `asphalt-600` | `#2A2A2E` | Raised/hover surface |
| `line` | `#2A2A2E` | Hairline dividers, placard borders |
| `ink` (Reflective White) | `#F2F0EB` | Primary text — warm, like retroreflective tape |
| `muted` | `#A3A39B` | Secondary text |
| `marker` / `marker-300` | `#3E7C4F` / `#7FC993` | Success, verified, DOT-compliant states **only** (300 for text on dark) |
| `diesel` / `diesel-300` | `#B91C1C` / `#F87171` | Errors, violations, warnings **only** — never decorative (300 for text on dark) |

**The amber rule:** any screen has ONE amber element competing for the thumb.
If two things are amber, one of them is lying about its importance. (Hard cap:
two `placard-money` edges per screen, e.g. the homepage Four Doors.)

**Thumbnail yellow** `#FFEB00` remains the YouTube identity only. On-platform
amber is deepened for contrast: `#F5A623` measures ~8.4:1 on `asphalt`.

## 2. Typography

- **Display:** Anton (`font-display`), ALL-CAPS, tight — the "stenciled on the
  trailer" voice. Page title + section heads only. Utilities: `.display-hero`,
  `.display-section`, `.eyebrow`.
- **Body:** Inter (`font-body`), 16px floor everywhere, 18px preferred on
  reading surfaces (Knowledge Center, books).
- **Data:** add `.num-data` (tabular figures) to prices, counts, mileage, and
  test scores so columns of digits align.
- Never more than these two typefaces on a page.

## 3. Spacing

8px base grid. `Section` provides the rhythm (`py-16 sm:py-24`); card padding
is `p-4 sm:p-6` (16/24px). White space is the cheapest premium signal we own —
when a section feels cheap, audit for cramping before adding anything.

## 4. Placard cards (§ the signature)

`<Placard>` (from `@/components/ui`) or the `.placard` utility: Cab Panel
surface, 1px `line` border, 8px radius (`rounded-card`).

**The one memorable brand mark:** `money` prop / `.placard-money` adds a 2px
Sodium Amber left edge, meaning **this card leads to money or action**
(product, sponsor slot, enrollment, mission). Free/informational cards never
get the edge. Users learn the language; don't dilute it.

`.lift` adds the 2px hover rise (motion-safe only).

## 5. Buttons (`@/components/ui` → `Button`)

| Variant | Look | Meaning |
| --- | --- | --- |
| `primary` | Amber solid | THE money action — one per screen |
| `secondary` | Reflective-white outline | The learn-more action |
| `ghost` | Hairline outline | Quiet utility action |
| `tertiary` | Amber text link | Inline everything-else |

CTA copy rule: verb + object + outcome where space allows. "Apply — join the
list" beats "Submit." "Get the $9.99 book" beats "Buy."

## 6. Motion

Budget: section-entry fade-up (`animate-fade-up`, 180ms, once), card hover
lift (2px), ONE hero moment per key page. Nothing loops, nothing parallaxes,
everything respects `prefers-reduced-motion` (globals.css kills `.lift` and
smooth-scroll). On 1-bar signal, animation never blocks content paint.

## 7. Icons & imagery

- Single stroke-weight (2px) line icons. No filled/gradient icon packs.
- No NEW emoji in UI chrome (existing usages are grandfathered until replaced
  with line icons — see owner-decisions).
- Photography: real over stock, always — Shawn, students, the truck, Dalton.
  Slight dark gradient overlay bottom-third for text legibility; warm grade.
  Banned: stock truckers, AI-people images anywhere trust matters.

## 8. Prohibited patterns

- Generic "near-black + acid accent" AI look; big radii (16px+); glassmorphism
- Carousels; autoplay video; looping/parallax animation
- Amber on anything that isn't money/action; red on anything that isn't a
  warning; green on anything that isn't verified/success
- Invented numbers, testimonials, credentials, or licensing claims
- Dead links in nav (remove the item, never leave a 404)
- Placeholder metrics — a stat renders real or not at all (see `ProofBar`)

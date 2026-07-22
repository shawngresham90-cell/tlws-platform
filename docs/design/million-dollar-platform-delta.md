# Million-Dollar Platform Blueprint — Repo Delta Audit

Blueprint: `TLWS_Million_Dollar_Platform_Design_Blueprint.md` (owner-supplied,
July 21, 2026). Audited against the repo at `main` = `cc5a722` plus open PRs
#159 (Books), #161 (Platform activation). This document is the gate that keeps
the design push from duplicating finished work or acting on stale assumptions.

## 1. Already complete (do not redo)

| Blueprint item | Where it's done |
| --- | --- |
| PR-A Analytics (Plausible, env-driven, money-path events) | **PR #161** M1 |
| PR-B dead ends: `/videos`, `/dot-guide`, broken KC routes, link crawl | **PR #161** M2 (redirects + crawler, 179 URLs / 0 broken) |
| Newsletter → real lead capture (`/api/lead`, Turnstile, UTM) | **PR #161** M3 |
| Root OG image + favicon | **PR #161** M4 |
| Focus rings, skip link, image-weight fix | **PR #161** M5 |
| `/sponsors` sell page + inquiry pipeline (contact-for-rates) | **PR #161** M7 |
| Books catalog complete (3→6), real covers, teaser fix | **PR #159** |
| ROAD AHEAD scenes 1–4 footage | **PR #160 (merged, live)** |
| Academy application system (2-step, Turnstile, `applications` table, admin pipeline view) | Already on `main` (Milestone 8) — blueprint PR-C largely predated by it |
| Honest tuition copy ("being finalized"), financing routes page | Already on `main` |
| Blueprint §5.1 items: credibility strip, mission/anti-mill, FAQ, thermometer | Already on `main` (`/academy`) |

## 2. Outdated blueprint assumptions (verified against repo)

1. **"Sponsors page 404s" / "videos 404s"** — fixed in PR #161; nav has no
   dead links (crawler-enforced).
2. **"1,252-listing directory"** — repo documents conflict: 139 (growth doc)
   vs 670 (coordinate audit) vs 1,252 (blueprint). Not resolvable from the
   repo; no listing count is displayed anywhere until the owner confirms.
3. **"October 18 opening (89-day clock)"** — the date appears nowhere in the
   repo. Not rendered; owner decision.
4. **"50 Knowledge Center articles"** — count not verifiable statically
   (`kc_articles` table); the proof bar queries it live and hides on failure.
5. **"Store: launch top-12 with ASINs"** — out of scope by owner directive
   (separate Fabel store workstream). No store code touched.
6. **"Apply the Census batch"** — **not authorized**; Directory data work
   explicitly frozen. No directory data touched.
7. **Blueprint's PR-C save-and-resume "Supabase-backed later"** — implemented
   device-local (localStorage) with zero schema change; server-side resume
   remains a future option.

## 3. Genuinely missing → implemented in this PR

| Gap | Implementation |
| --- | --- |
| §2 Steel & Sodium tokens (amber, cab panel, reflective white, marker green, 8px placards) | `tailwind.config.ts`, `globals.css` |
| §2.4 Placard card + amber money-edge signature | `ui/Placard.tsx` + `.placard/.placard-money` + adopted by FeatureGrid/CardGrid/Four Doors |
| §2.8 CTA hierarchy (primary amber / secondary outline / tertiary link) | `ui/Button.tsx` (secondary de-redded; all 6 call sites audited) |
| §4 S1 hero thesis + single primary CTA | `sections/Hero.tsx` |
| §4 S2 live proof bar (real numbers only, fail-soft) | `sections/ProofBar.tsx` (new) |
| §4 S3 Four Doors routing layer (2 amber edges max) | `sections/FourPaths.tsx` |
| §4 S4 story strip (Drove it → Taught it → Building it) | `sections/RoadAheadTeaser.tsx` |
| §4 S8 footer trust block | `layout/Footer.tsx` |
| §4 "what dies": placeholder content on homepage | `LatestArticles` unrendered (stub data) |
| §2.9 nav discipline (6 top-level + nested groups) | `layout/Header.tsx` |
| §5.1 program journey (real curriculum phases) | `/academy` JOURNEY section |
| §5.1 licensing/tuition transparency block | `/academy` "Where the school stands" |
| §5.1 student-fear FAQ (age/medical/record/failing/placement) | `/academy` FAQS — every answer honest, no invented policy |
| §5.2 application: attribution + save-and-resume + interruption safety | `apply/ApplyForm.tsx` (UTM first-touch → existing `utm` jsonb; localStorage draft) |
| Stale copy contradiction ("application opens soon") | fixed on `/academy/cdl-school-dalton-ga` |

## 4. Unsafe / not acted on (and why)

1. **Census/directory data applies** — explicitly unauthorized.
2. **Any date/licensing/tuition claim** — nothing verifiable in repo; honest
   "being finalized" states shipped instead (blueprint's own rule).
3. **"Reserve Your Seat" CTA** — overpromises while no reservation mechanics
   exist; shipped "Apply — join the list."
4. **Placement/carrier promises (§5.8)** — "once true" per blueprint; FAQ
   explicitly declines to promise placement.
5. **Member systems, badges, dashboards (§6)** — Phase 3 scope, deferred.
6. **New Supabase migrations** — none needed; none created.
7. **Store/sponsor/analytics reimplementation** — owned by #159/#161; this
   branch is stacked on #161 to avoid conflicts rather than duplicating it.

## 5. Structural notes

- **This branch stacks on PR #161** (`claude/platform-activation`). It must
  merge after #161 (or be rebased if #161 changes). Chosen because #161 owns
  76 files including the design core (tailwind config, globals, Button,
  Header/Footer, academy pages) — basing on `main` would have guaranteed
  conflicts with already-reviewed work.
- **#159 ∩ #161 both touch `ui/Button.tsx`** — a pre-existing overlap between
  those two PRs; merge whichever first and rebase the other. This branch
  builds on #161's version.
- Directory coverage (93% coordinate-less) and Trip Planner discoverability
  were audited and documented but left untouched (frozen scope). The Four
  Doors and grouped nav give the Trip Planner its first honest homepage
  surface without touching the planner itself.

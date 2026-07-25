# Autonomous platform run — July 2026

Work log for the autonomous improvement run on branch
`claude/tlws-platform-autonomous-run-wv9hqv` (draft PR #178), branched from
`main` at `e39ec2e`.

Companion to `platform-catch-up-audit-2026-07.md`, which inventoried the
platform read-only. This log records what was **changed**, the evidence behind
each change, and the exact commands used to verify it.

## Guard rails honoured

- PR #177 and branch `claude/census-geocode-calibration` untouched.
- No imported TA/Petro rows, Love's Florence, Sapp Bros, Pilot-network,
  Goasis/Thorntons, or manual-review location records modified.
- No Supabase migration added or applied; no live database write of any kind.
- Nothing merged, deployed, or published.
- No prices, discounts, testimonials, statistics, product availability, or
  business claims invented.

---

## M1 — Branded 404 and error boundaries

**Problem.** `src/app` had no `not-found.tsx`, `error.tsx`, or
`global-error.tsx`. Every unknown URL therefore fell through to Next.js's
built-in not-found page, which injects an inline
`body{color:#000;background:#fff}` rule. That override beats the dark theme, so
the page rendered as a full-height white void between the (still dark) `Header`
and `Footer`, offered the visitor no links out, and emitted a second `<title>`.
An uncaught render error was worse — Next's unstyled "Application error"
fallback with no route back into the site.

**Evidence.** Against `main`, `npm run build && npm run start`:

```
$ curl -s -o /dev/null -w '%{http_code}' localhost:3000/this-page-does-not-exist
404
titles: ['404: This page could not be found.',
         'Trucking Life Academy — CDL Training in Dalton, GA']
body style injection: True
```

**Change.**

| File | Role |
| --- | --- |
| `src/app/not-found.tsx` | On-brand 404. Keeps the theme, one `<title>`, `noindex/nofollow`, deliberately **no canonical** (a 404 answers at many URLs), and six recovery routes: Academy, CDL Pre-School, Practice Tests, Directory, Trip Planner, Knowledge Center. Still answers HTTP 404. |
| `src/app/error.tsx` | Route-segment boundary with a working `reset()`. Renders the digest only — never the raw message, which can carry internals. |
| `src/app/global-error.tsx` | Root-layout fallback. Ships its own `html`/`body` and inline design tokens, because Tailwind may not have loaded when the root layout is what failed. |
| `src/components/seo/NotFoundEvent.tsx` | Fires `page_not_found` with the dead path through the **existing** `trackEvent` dispatcher, so broken links become visible. Silent no-op while analytics is unconfigured. |
| `scripts/test-error-pages.ts` | 34-check regression harness. |

**After.**

```
titles: ['Page not found — Trucking Life with Shawn']
robots: ['noindex', 'noindex, nofollow']
body style injection: False        HTTP 404 preserved
```

Rendered and inspected at 1280×900 and 390×844.

---

## M2 — Formatting baseline, offline test runner, and PR CI

Three findings, one milestone, because each blocks the next.

### 2a. `format:check` failed on 103 files

The README lists `npm run format:check` as "Prettier check (CI)", but it exited
non-zero on `main` across 103 files — pure line-wrapping drift, no behaviour
change. It could not gate anything in that state.

Ran `npm run format`, then **reverted two classes of file and ignored them
instead**:

- `data/` — geocoding dry-run and import artifacts. Reformatting
  `directory-snapshot.json` alone rewrote 35,058 lines and would have destroyed
  the diffability of an import batch's provenance. These are dated evidence
  snapshots, not source. (This is also the guard-railed import territory.)
- `src/lib/road-ahead/asset-presence.generated.ts` — rewritten from scratch by
  `prebuild`; formatting it only guarantees the next build dirties the tree.

Both are now in `.prettierignore` with the reasoning inline.

### 2b. 51 test harnesses existed; nothing ran them

`scripts/test-*.ts` holds 51 offline harnesses (≈6,900 assertions), each
documenting its own `npx esbuild … && node …` invocation in a header comment.
Nothing ran them together and nothing ran them in CI, so a regression in any
one of them stayed invisible.

Added `scripts/run-tests.mjs` (`npm test`) — bundles and runs every harness with
that same invocation, prints one line per harness, and fails the run on the
first non-zero exit. Accepts name filters: `npm test -- go-links`.

### 2c. The runner immediately found a failing harness on `main`

```
$ npm test
▸ preschool … FAILED
FAIL: hero Pre-School CTA renders the single-source price constant
162 passed, 1 failed
```

Reproduced on a clean `main` checkout, so it predates this branch. Two distinct
problems in `scripts/test-preschool.ts`:

1. **Stale assertion.** The harness asserted the paid CDL Pre-School CTA lived
   in the homepage hero. Commit `d4e5e72` ("Cinematic homepage + academy
   storytelling polish", PR #164) moved it out, deliberately —
   `docs/design/homepage-story-framework.md` specifies beat 1 as "1 primary
   CTA", with the CDL door in THE FOUR DOORS pairing "the school CTA with the
   live Pre-School purchase". `FourPaths.tsx` does exactly that today:
   `PurchaseCta`, `SpotsMeter`, `PRESCHOOL_PRICE_LABEL`, real wall data. **The
   shipped design is correct; the assertion was stale.** No product change was
   made.
2. **A vacuously-passing assertion.** The neighbouring check was
   `heroSrc.indexOf('/cdl-pre-school') < heroSrc.indexOf('/academy')`. Once the
   string was removed, `indexOf` returned `-1` — and `-1 < 34` is true, so the
   ordering check passed *because* the thing it guarded was gone.

Both rewritten to assert the shipped design: the hero holds exactly one primary
CTA; the homepage's Pre-School price comes from the single-source constant with
no hard-coded dollar amount; and the money door renders before the free doors,
compared on **rendered JSX** (`<PurchaseCta` vs `FREE_DOORS.map`) so an import
line can never satisfy the ordering. Harness now: 166 passed, 0 failed.

### 2d. CI

`.github/workflows/ci.yml` runs on `pull_request`, on `push` to `main`, and on
dispatch: `format:check` → `lint` → `typecheck` → `npm test` → `build` →
`git diff --exit-code` (catches drift in the `prebuild`-generated manifest).
Offline and read-only: no database, no deploy, no secrets. The Supabase env vars
are syntactic placeholders so the client modules construct; nothing connects.

The three pre-existing workflows (`preview-crawl`, `preview-smoke`,
`prod-health-check`) are unchanged — they need a live preview URL and stay
manual.

---

## Validation

Every command below was run on this branch, from a clean `npm ci`.

| Command | Result |
| --- | --- |
| `npm run format:check` | All matched files use Prettier code style |
| `npm run lint` | No ESLint warnings or errors |
| `npm run typecheck` | pass |
| `npm test` | All 51 harnesses passed |
| `npm run build` | pass |
| `WARN_ONLY_PREFIXES=/knowledge,/directory node scripts/crawl-links.mjs http://localhost:3000` | No broken internal links (3 warn-only 404s under `/knowledge`, all DB-backed and expected without a database) |

## Known limitations

- The sandbox cannot reach `*.netlify.app`, so the deploy preview was not
  crawled from here. `preview-crawl.yml` remains the authoritative check for
  DB-backed routes.
- Without database credentials, `/knowledge/*` and DB-backed `/directory/*`
  pages could only be exercised as fail-soft empty states, not with real rows.

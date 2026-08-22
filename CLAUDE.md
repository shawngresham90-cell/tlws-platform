# CLAUDE.md

Guidance for AI assistants working in `shawngresham90-cell/tlws-platform`.

**TLWS Platform** is the unified home for TruckingLifeWithShawn.com — CDL Academy,
Founders Wall, Sponsors, Truck-Stop Directory, Knowledge Center, Practice Tests,
Store, and Trip Planner on one Next.js app so all SEO authority compounds on a
single domain. Real business, real drivers, real regulatory exposure. Accuracy
outranks polish everywhere in this repo.

---

## 1. Stack and commands

- **Next.js 14 App Router** + **React 18** + **TypeScript strict** (`@/*` → `./src/*`)
- **Tailwind CSS 3** with brand tokens in `tailwind.config.ts` and utilities in `src/app/globals.css`
- **Supabase** (Postgres, RLS-locked) via `@supabase/ssr`
- **Netlify** hosting (`@netlify/plugin-nextjs`, Node 22)
- **Zod** for every request payload; **GSAP / three / @react-three/fiber** only on `/road-ahead`; **Leaflet** for maps

```bash
npm install
cp .env.example .env.local     # fill NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:3000
npm run build                  # prebuild regenerates the Road Ahead asset manifest
npm run typecheck              # tsc --noEmit
npm run lint                   # next lint
npm run format:check           # prettier check (what CI expects)
```

`npm run prebuild` runs `scripts/generate-road-ahead-manifest.mjs`, which writes
`src/lib/road-ahead/asset-presence.generated.ts`. Never hand-edit that file.

Only the two `NEXT_PUBLIC_SUPABASE_*` vars are required to boot. Everything else in
`.env.example` is optional and **fails soft when unset** — that behavior is deliberate,
preserve it.

---

## 2. Repository map

```
src/
  app/
    (marketing)/    homepage-adjacent: knowledge/, store/, cdl-pre-school/, road-ahead,
                    dot-tools, sponsors, apps, books, privacy, sms-terms
    (academy)/      academy/* — enrollment, curriculum, FAQ, financing, instructors
    (learn)/        practice-tests/* — study, timed, bookmarks, missed
    (directory)/    directory/* (category, exit, location detail, map, submit, reviews)
                    plus trip-planner
    (community)/    founders wall
    admin/          (dashboard)/* behind an HMAC cookie gate + admin/login
    api/            23 route handlers (forms, trip-planner, revalidate, stripe stub)
    go/[slug]/      tracked internal short links
    sitemap.ts robots.ts llms.txt/ opengraph-image.tsx icon.tsx layout.tsx page.tsx
  components/       ui/ (Button, Container, Section, Eyebrow, Placard) + per-domain folders
  lib/              per-domain logic: directory/, trip-planner/, store/, tests/, kc/,
                    preschool/, community/, admin/, api/, seo/, map/, leads/, legal/,
                    road-ahead/, supabase/, utils/
  middleware.ts     Supabase session refresh only — no redirects live here
supabase/migrations/  001…046, applied in order, additive and idempotent
scripts/            50 `test-*.ts` suites + geocoding/e2e/crawl tooling
docs/               specs, audits, compliance ledgers, design system (see §8)
data/               geocoding + directory import CSV batches with review/source notes
content/            reserved for MDX; currently empty (KC articles live in the DB)
public/             fonts, covers, store images, road-ahead video/poster assets
```

Route groups are organizational only — they don't appear in URLs.

---

## 3. Data access and security model

This is the part to get right. There are **four** Supabase clients and they are not
interchangeable:

| Module | Key | Use |
| --- | --- | --- |
| `lib/supabase/client.ts` | anon | browser / client components |
| `lib/supabase/server.ts` | anon + user cookies | server components, route handlers |
| `lib/supabase/static.ts` | anon, cookieless | `sitemap.ts`, `generateStaticParams`, build-time reads |
| `lib/supabase/admin.ts` | **service role** | server-only writes; imports `server-only` |

Rules:

- **RLS is locked.** Anon reads public/published rows and has **zero write grants**
  (migrations `010`–`014`). Every write goes through a server route or server action.
- **Never import `lib/supabase/admin.ts` into a client component.** It carries
  `import 'server-only'` — that guard exists so the mistake fails at build time.
- `/admin` uses a **separate** auth system from Supabase auth: a shared
  `ADMIN_PASSWORD` plus an HMAC cookie signed with `ADMIN_SESSION_SECRET`
  (`lib/admin/auth.ts`). It **fails closed** — if either var is missing, the dashboard
  is inaccessible. Every admin page calls `requireAdmin()` and sets
  `export const dynamic = 'force-dynamic'`.
- Turnstile verification **skips in dev with a warning and fails closed in production**
  (`lib/api/turnstile.ts`). Don't "simplify" that asymmetry away.
- Email (`EMAIL_SENDING_ENABLED`) and SMS (`SMS_SENDING_ENABLED`) are **dormant behind
  env flags**. Nothing in this repo may send an SMS without recorded consent (TCPA) —
  see `docs/compliance/sms-10dlc-compliance.md` and `lib/leads/sms-consent-server.ts`.
- No secrets in git, ever. `.env.example` holds placeholders only.

### Public POST routes

Use the `guardedPost()` wrapper from `lib/api/handler.ts`. It runs, in order:
rate limit (IP + route key) → JSON parse → zod validation → Turnstile (when the
payload carries a token) → your handler, converting any throw into a clean 500.
Nine form endpoints already use it; new public POST routes should too.

```ts
export const POST = guardedPost(mySchema, { routeKey: 'my-route' }, async ({ data, ip }) => {
  // ...
  return ok({ saved: true });
});
```

Responses come from `lib/api/responses.ts` (`ok` / `fail`), logging from
`lib/api/logger.ts`. Never leak internals in an error body.

### Caching

Public content pages use ISR (`export const revalidate` — 300 for Knowledge Center,
3600 for Store and sitemap, 60 for `/road-ahead`). Admin and query-dependent pages use
`force-dynamic`. `/api/revalidate` busts a path on demand behind `REVALIDATE_SECRET`.

---

## 4. Testing and verification

There is **no test runner** — no Jest, no Vitest. The suites are standalone TypeScript
programs in `scripts/test-*.ts` (50 of them) that bundle through esbuild and run on
Node. Each file's header comment contains its exact run command. The pattern:

```bash
npx esbuild scripts/test-store.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/test-store.cjs && node /tmp/test-store.cjs
```

`--alias:server-only=./scripts/shims/server-only.ts` neutralizes the `server-only`
guard so Node-side suites can import server modules. Suites count `passed`/`failed`
with a local `check()` helper and exit non-zero on failure — follow that shape when
adding one.

**Before claiming a change is done, run:**

1. `npm run typecheck`
2. `npm run lint`
3. `npm run format:check`
4. `npm run build` (report the page count — PR bodies in this repo do)
5. The `scripts/test-*.ts` suites covering what you touched, plus a new suite for new
   invariants

`scripts/crawl-links.mjs <base-url>` does a BFS internal-link crawl (needs a running
server + DB). The sandbox cannot reach `*.netlify.app`, so DB-backed crawls run in
`.github/workflows/preview-crawl.yml` instead.

### GitHub Actions (all manual/dispatch, none gate merges)

- `preview-smoke.yml` — dispatch with a deploy-preview URL; asserts directory detail
  pages, 404s for unpublished slugs, schema/canonical presence, admin redirects
- `prod-health-check.yml` — curls production routes and published/unpublished listing
  assertions; accepts extra `"/route|text"` checks as dispatch inputs
- `preview-crawl.yml` — internal-link crawl against a preview

**SSR gotcha documented in `prod-health-check.yml`:** React inserts `<!-- -->` between
static text and interpolations, so `grep -F` assertions must target a single static
segment or an attribute value (`aria-label`, `href`) — never mixed text.

---

## 5. Code conventions

- **Prettier**: single quotes, semicolons, trailing commas, 100-col, 2-space. Run
  `npm run format` before committing.
- **ESLint**: `next/core-web-vitals` + `prettier`.
- Absolute imports via `@/` everywhere; relative only within a `lib/<domain>` folder.
- **Comments explain *why*, and they carry decisions.** This codebase's comments are
  load-bearing — they record regulatory reasoning, contrast ratios, and past bugs. Match
  that density. Don't strip them.
- Server Components by default; add `'use client'` only where interactivity requires it.
- Domain folders own a **registry / single source of truth** module that everything else
  reads: `lib/directory/categories.ts`, `lib/store/products.ts` + `amazon.ts`,
  `lib/tests/catalog.ts`, `lib/preschool/constants.ts`, `lib/seo/site.ts`,
  `lib/legal/company.ts`, `lib/go-links.ts`. Adding an item means adding a registry
  entry — never hardcoding the fact in a page.
- Known duplication that is deliberately **left alone** (see the catch-up audit):
  two haversine implementations (`lib/directory/browse.ts`, `lib/map/geo.ts`) and
  scattered `slugify` copies. Consolidating them is a behavior-risk refactor — only do
  it as a dedicated, tested change, not as drive-by cleanup.

### Design system — "Steel & Sodium"

Full rules in `docs/design/tlws-design-system.md`; tokens in `tailwind.config.ts`.

- **Sodium Amber `#F5A623` (`signal`) means money or action, nothing else.** One amber
  element per viewport (hard cap: two `.placard-money` edges per screen).
- `#FFEB00` is the YouTube thumbnail identity only — not an on-platform surface color.
- Backgrounds ride the `asphalt` ramp (`#141414` page, never pure black).
  `ink` `#F2F0EB` for text, `muted` `#A3A39B` for secondary.
- `marker` = success/verified only. `diesel` = errors/violations only. Use the `-300`
  variants for text on dark (the base values fail WCAG AA there).
- Anton (`font-display`) for page/section headings, ALL-CAPS; Inter (`font-body`) for
  everything else; 16px floor. Two typefaces, never a third.
- Signature utilities: `.placard`, `.placard-money`, `.display-hero`,
  `.display-section`, `.eyebrow`, `.num-data` (tabular figures on any digits),
  `.lift`, `.doc-caption`, `.film-grain`.
- All motion is `motion-safe:` / `prefers-reduced-motion`-guarded and touches only
  opacity/transform. See `docs/design/cinematic-motion-rules.md` and
  `docs/design/mobile-design-rules.md`.

### SEO

`lib/seo/metadata.ts` builds Metadata objects, `lib/seo/schema.tsx` emits JSON-LD,
`lib/seo/site.ts` holds site identity. New public routes must be added to
`src/app/sitemap.ts`. Purely personal client-side tools (`/practice-tests/bookmarks`,
`/missed`) stay out on purpose.

---

## 6. Database

Migrations are numbered SQL in `supabase/migrations/`, applied in order, **additive and
idempotent** (`create table if not exists`, etc.). A migration's header comment states
its purpose and its blast radius. Some ship as `PROPOSED — do not apply without explicit
approval` (e.g. `046_sms_consents.sql`) — respect that marker; adding the file is not
applying it.

Knowledge Center articles and practice-test question banks live in the **database**,
seeded by migrations (`032`, `034`–`042`, `045`, `037`–`038`, `040`), not in `content/`.
New KC clusters or test banks therefore arrive as seed migrations.

Never write a migration that loosens RLS or grants anon writes.

---

## 7. Honesty gates — the rules that block shipping

Several product areas are deliberately held behind verification gates. These are the
highest-stakes conventions in the repo; a change that quietly crosses one is a serious
defect, not a feature.

- **DOT Tools** (`/dot-tools`) is a **static informational landing page only**.
  Functional regulatory tools are **NO-GO** until the gates in
  `docs/dot-tools/review-gates.md` pass with a recorded reviewer and date in
  `docs/dot-tools/decision-log.md`. The 89-row ledger in
  `docs/compliance/dot-tools-rule-ledger.md` currently has **zero VERIFIED rows**. Do
  not add calculators, verdicts, compliance conclusions, or data collection there.
- **Split-sleeper** computation is gated by `docs/compliance/split-sleeper-rule-ledger.md`
  (R1–R15 + expert sign-off).
- **Store**: 104 products are editorial placeholders with every Amazon fact null. A
  product goes live only when `productActive()` passes — valid ASIN **and** verified
  title **and** a licensed local image. **Never fabricate an ASIN, price, rating, review
  count, or Amazon image**, and never use a scraped Amazon image. The associate tag
  `truckinglif0d-20` lives in exactly one place (`lib/store/amazon.ts`), and every paid
  link carries `rel="sponsored noopener noreferrer"`. `scripts/test-store.ts` enforces
  all of this.
- **Directory**: unpublished listings must 404 and must not appear on category pages.
  Coordinates that aren't confirmed render an honest "still being confirmed" fallback
  with **no** `GeoCoordinates` schema and no map. Never invent geo data. No
  `aggregateRating` without real reviews.
- **Sponsored placement** copy makes no promise about traffic, leads, or ranking, and
  never affects organic or Trip Planner ranking.
- **Regulatory citations**: cite the actual CFR section; if a claim isn't source-matched
  in a ledger, it doesn't ship. The repo tracks statuses like
  `UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING` and `SUPERSEDED` for a reason.
- **Payments** (Stripe) are a placeholder pending EIN → bank → Stripe. `/api/stripe/webhook`
  is a stub.

When something can't be verified, the established pattern is to **ship the honest
placeholder** (`components/academy/Placeholder.tsx`, "coming soon", "still being
confirmed") rather than a plausible guess.

---

## 8. Docs worth reading before you change an area

| Area | Read |
| --- | --- |
| Whole-platform state | `docs/operations/platform-catch-up-audit-2026-07.md` |
| Design | `docs/design/tlws-design-system.md`, `cinematic-motion-rules.md`, `mobile-design-rules.md` |
| DOT Tools | `docs/dot-tools/*` (start at `README.md`, then `review-gates.md`, `decision-log.md`) |
| Compliance | `docs/compliance/*` — rule ledgers, HOS verification, SMS/10DLC |
| Store | `docs/store/activation-rules.md` |
| Directory | `docs/directory-growth-system.md`, `docs/seo/directory-seo-audit-2026-07.md`, `docs/coordinate-verification-audit.md` |
| Trip Planner | `docs/trip-planner-engine.md`, `docs/trip-planner/last-stop-engine.md` |
| Partners | `docs/partners/truck-parking-club.md` |
| Analytics | `docs/analytics-setup.md`, `docs/youtube-funnel-guide.md` |
| Deploy | `DEPLOY.md` |

Substantial changes are expected to leave a doc or audit behind — several PRs in this
repo are docs-only by design.

---

## 9. Analytics

`trackEvent()` in `lib/analytics.ts` fires into Plausible / dataLayer / Vercel Analytics
if present and is a **silent no-op otherwise** — analytics must never break a form.
Nothing loads unless `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set. Keep new events named in the
existing families (`store_*`, `preschool_*`, `application_*`, TPC events) and cookieless.

---

## 10. Git and PR workflow

- Branch naming in use: `claude/<topic>-<suffix>`. Push with `git push -u origin <branch>`.
- Trunk is `main`; Netlify auto-deploys from it and builds a preview per PR.
- Commit/PR bodies here are **detailed and specific**: what changed, per surface; what
  was deliberately *not* done and why; the verification line
  (`tsc/ESLint/Prettier clean; N-page build`); and explicit negative claims
  (`no migrations, no production writes, no schema changes`). Match that style — it is
  how this project's risk is tracked.
- Open PRs as **drafts**. There is no PR template in the repo.
- Never apply a migration or perform a production write as part of a code change unless
  that is explicitly the task.

---

## 11. Quick gotchas

- `content/` is empty — KC articles are database rows, not files.
- `components/{content,conversion,seo}` are near-empty planned dirs; `conversion/` holds
  only `SmsConsentField.tsx`.
- `next.config.mjs` owns all static redirects (`/dot-guide`, `/directory/trip-planner`,
  `/contact`, `/videos`); dynamic listing-slug redirects live in
  `lib/directory/redirects.ts`. `middleware.ts` redirects nothing.
- Trip Planner live providers (`EIA_API_KEY`, `HERE_API_KEY`) are server-only and
  **fail-soft** — the planner still works with estimates when they're unset. Don't expose
  either to the browser.
- Road Ahead video assets are large (~4.2 MB total); `scripts/compress-road-ahead-video.mjs`
  exists if more are added.
- The sandbox can't reach `*.netlify.app` — verify preview-dependent behavior through the
  dispatch workflows, not local curls.

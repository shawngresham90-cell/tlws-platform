# TLWS Platform

The unified home for **TruckingLifeWithShawn.com** — Academy, Founders Wall, Sponsors,
Directory, and CDL Practice Tests on one Next.js platform so all SEO authority compounds
on a single domain.

> Drivers helping drivers. Dalton, GA · off I-75.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript** (strict)
- **Tailwind CSS** — brand design tokens (Anton display, signal yellow `#FFEB00`, asphalt dark)
- **Supabase** (Postgres 17, RLS-locked) — project `tlws-platform`
- **Netlify** — hosting + `@netlify/plugin-nextjs`
- ESLint + Prettier

## Getting started

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# (server-only keys stay out of the browser and out of git)

# 3. Run
npm run dev          # http://localhost:3000
```

## Scripts

| Command                | Does                                  |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Local dev server                      |
| `npm run build`        | Production build                      |
| `npm run start`        | Serve the production build            |
| `npm run lint`         | ESLint                                |
| `npm run typecheck`    | `tsc --noEmit`                        |
| `npm run format`       | Prettier write                        |
| `npm run format:check` | Prettier check (CI)                   |
| `npm test`             | Offline test harnesses (see below)     |

## Tests + CI

`scripts/test-*.ts` holds the offline test harnesses — pure, no database, no
network. Each documents its own `esbuild` invocation in a header comment and
exits non-zero on failure.

```bash
npm test                 # every harness
npm test -- go-links     # only harnesses whose name matches
```

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:
`format:check` → `lint` → `typecheck` → `npm test` → `build` →
`git diff --exit-code` (which catches drift in the `prebuild`-generated Road
Ahead manifest). It is offline and read-only — no database, no deploy, no
secrets.

The other three workflows need a live URL and stay dispatch-only:
`preview-crawl` (internal-link crawl of a deploy preview — pass the preview URL
as `base_url`), `preview-smoke`, and `prod-health-check`.

## Folder structure

```
src/
  app/              App Router — route groups per domain area
    (marketing)/    homepage + marketing pages
    (academy)/      enrollment + curriculum
    (learn)/        practice tests
    (directory)/    truck stop / location directory
    (media)/        content hub
    (community)/    founders / sponsors
    admin/          internal dashboard
    api/            route handlers
  components/
    ui/             design-system primitives (Button, Container, Section, Eyebrow)
    conversion/     the money layer (CTA, EmailCapture, Thermometer, ClickToCall)
    content/        MDX rendering
    directory/      location components
    seo/            metadata / schema
    test/           practice-test components
    layout/         Header, Footer
  lib/
    supabase/       browser + server clients (env-only)
    utils/          helpers
content/            MDX content
scripts/            offline test harnesses (test-*.ts), import validators, tooling
supabase/           migrations + edge functions
public/             static assets, fonts
```

## Security posture

- **RLS locked**: anon reads public rows only, zero anon writes. All writes go through
  server routes / Edge Functions.
- **No secrets in git**: `.env.local` is ignored; `.env.example` ships placeholders only.
- **Paid links** — every affiliate and store link renders `rel="sponsored"` and
  opens in a new tab (Google-compliant; enforced by
  `scripts/test-outbound-links.ts`). `lib/store/amazon.ts` is the only place an
  Amazon affiliate URL is built, so the associate tag is applied exactly once.
- **Forms** gate through Cloudflare Turnstile before touching the database.

## Build order (milestones)

1. ✅ Project scaffold
2. Database migrations
3. Authentication
4. API layer
5. Homepage
6. Academy
7. Application system
8. Founders Wall
9. Sponsors
10. Admin
11. Practice test
12. Launch

---

© Trucking Life Academy LLC. Keep the shiny side up. 🚛

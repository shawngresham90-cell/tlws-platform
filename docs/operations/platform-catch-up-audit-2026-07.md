# TLWS Platform — Catch-Up Health Audit (July 2026)

Read-only inventory of `shawngresham90-cell/tlws-platform` at main
`f4e578700b670c89498180b7f293d316b1c5dbf5`. Nothing here modifies code; it
records the platform's current shape and flags follow-ups. Produced during the
PR #162 recovery block (see `pr-162-recovery-audit.md`).

Confidence legend: **confirmed** (direct enumeration) · **likely** (strong
signal, not exhaustively proven) · **requires-manual-review**.

## 1. Public routes (50, confirmed)
Root; Academy (9); Founders (1); Directory (12, incl. dynamic `[category]`,
`[category]/top-truck-stops`, `[category]/truck-parking`, `[category]/[exit]`,
`location/[slug]`); Trip Planner (1); Practice Tests (6); Marketing (20, incl.
`/dot-tools`, `/road-ahead`, `/apps`, `/books`, `/privacy`, `/sms-terms`,
`/store/*`, `/knowledge/*`, `/cdl-pre-school/*`). Plus `/llms.txt`,
`/sitemap.xml`.

## 2. Admin routes (confirmed)
`/admin/login`, `/admin`, `/admin/applications`, `/admin/leads`*,
`/admin/founders`, `/admin/sponsors`, `/admin/store`, `/admin/reviews[/[id]]`,
`/admin/submissions[/[id]]`, `/admin/cdl-preschool/founding-students`,
`/admin/tests[/[slug][/questions/[id]]]`, and a large `/admin/directory/*`
suite (new, edit, corrections, duplicates, expansion, geocoding, import,
popular, quality, sponsors, tpc, export + export/csv). Server actions in
`admin/actions.ts` and per-module `actions.ts`.
*`/admin/leads` is added by PR B.

## 3. API routes (23, confirmed)
9 form endpoints use the `guardedPost()` wrapper (rate-limit + Turnstile +
zod): application step1/step2, lead, sponsor-inquiry, preschool/claim,
directory submission/review/nearby, tests/attempt. Others: directory/view,
revalidate (placeholder), stripe/webhook (placeholder), trip-planner
quote/route/plan/hos/stops/cost/places/anchors + cloud saved-trips &
truck-presets (GET/POST/DELETE), admin directory export/csv (GET), llms.txt.

## 4. Sitemap gaps (confirmed missing on main)
`/trip-planner`, `/directory/parking`, `/apps`, `/books`, `/dot-tools`,
`/sponsors`, `/road-ahead`, `/privacy`, `/sms-terms`.
**→ All nine are added by PR A** (`sitemap.ts`). `/practice-tests/bookmarks`
and `/practice-tests/missed` remain out (personal client-only tools — likely
intentional; leave excluded). Requires-manual-review: none outstanding after
PR A.

## 5. Internal-link crawler
`scripts/crawl-links.mjs` (BFS, flags 4xx/5xx internal links); needs a running
server + DB; `WARN_ONLY_PREFIXES` downgrades DB-backed pages for offline runs.
Wired into `.github/workflows/preview-crawl.yml`. PR A's local run: **0 broken
internal links.**

## 6. Redirects (confirmed)
`next.config.mjs` `redirects()`: `/dot-guide → /knowledge/dot-compliance`
(permanent), `/directory/trip-planner → /trip-planner` (permanent),
`/contact → /academy/faq` (temp), `/videos → youtube.com/@…` (temp).
`middleware.ts`: Supabase session refresh only, no redirects. `netlify.toml`:
security headers only. No `_redirects` file. Dynamic listing-slug redirects in
`lib/directory/redirects.ts`.

## 7–8. Open PRs / stale branches
Tracked in GitHub, out of scope for this doc. (This block opened draft PRs A,
B, and this docs PR C; PR #162 remains open and untouched.)

## 9. Placeholder content (127 hits / 56 files; no FIXME, no lorem)
Mostly intentional "not final" markers via `components/academy/Placeholder.tsx`
and pre-affiliate "coming soon" states. Concentrations: Academy
financing/facility/curriculum/requirements/instructors (owner data TBD); Store
products (ASIN/price pending); Practice-test empty states; Stripe webhook +
`/api/revalidate` API stubs. **Owner-input items → §20.**

## 10. Dead / orphaned components
**Zero zero-reference components (confirmed by direct-reference scan).**
Transitive dead code (a component used only by an unreachable component) is
**requires-manual-review** — not resolved here. No deletions recommended.
Empty planned dirs: `components/{content,conversion,seo}`.

## 11. Duplicate-utility candidates (likely — not changed)
- Haversine distance implemented twice: `lib/directory/browse.ts` `distanceMiles()`
  vs `lib/map/geo.ts` `haversineMiles()`.
- Slug normalization scattered across ~9+ files (two named `slugify` in
  `lib/directory/admin.ts` and `lib/kc/mdx.ts`, plus ad-hoc copies in
  interstates/states/detail-slug/duplicates/tpc/corrections/geocoding/import/
  campaign).
- Inline `toLocaleDateString('en-US', …)` in several admin pages; no shared
  `fmtDate`.
Consolidating these is a **refactor with behavior risk**, not conclusively-safe
cleanup — deliberately **left for a dedicated, tested change** (out of this
block's cleanup bar).

## 12. Large static assets (>200 KB, confirmed)
Six Road Ahead videos dominate (~4.2 MB total): `empty-highway.mp4` 1022 KB /
`.webm` 927 KB, `sunrise.mp4` 672 KB / `.webm` 646 KB, `key-handoff.webm`
545 KB / `.mp4` 490 KB; plus `images/store/founding-member-shirt.jpg` 241 KB.
`scripts/compress-road-ahead-video.mjs` exists for re-compression if needed.

## 13. Image alt text
8 `<Image>`/`<img>` usages — **all have alt (confirmed)**. `road-ahead/
CinematicVideo.tsx` uses a valid empty `alt=""` on a decorative poster (not a
defect). No fix needed.

## 14. Forms → storage
apply → applications/application_events; NewsletterForm & BecomeFounderForm →
leads(+magnets); SponsorInquiryForm → sponsors/sponsor_touches; ClaimForm →
preschool_founding_claims; SubmitLocationForm → locations/location_submissions;
ReviewForm → locations/location_reviews; TestResults → test_attempts/tests/
leads(opt-in); ViewBeacon → record_directory_view RPC; cloud sync → saved-trips
/ truck-presets. `kc/SearchBox` is GET-nav only.

## 15. Analytics events (Plausible via `lib/analytics.ts trackEvent`)
Loader deferred, domain from env, **off unless configured**. Events: application
(started/step1_completed/submitted), newsletter_lead_captured,
practice_test_completed, store_* (page/product/category/guide/picks views +
amazon_cta_click + search), preschool_* (view/cta/nav/claim/scroll/expand/faq),
TPC (resultsShown/reserveClicked/noResults). PR A's `/go` links append
`utm_source=youtube` so channel arrivals segment here when analytics is on.

## 16. Environment variables (names only)
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`,
`EMAIL_SENDING_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `SMS_SENDING_ENABLED`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
`REVALIDATE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `HERE_API_KEY`, `EIA_API_KEY`,
`NEXT_PUBLIC_TPC_PLANNER_ENABLED`, `NODE_ENV`. (`.env.example` present.)

## 17. Supabase migrations (45, confirmed)
001 extensions · 002 locations · 003 location_reviews · 004 applications ·
005 founders · 006 sponsors · 007 tests · 008 leads · 009 content_pages ·
010 housekeeping_rls · 011 revoke_anon_writes · 012 view_security_invoker ·
013 admin_roles · 014 lock_admin_grants · 015 knowledge_center · 016
application_fields · 017 admin_statuses · 018–025 directory (admin/bulk/
community/geocoding/detail-pages/growth/sponsors/view-events) · 026–027 founders
aggregate+seed · 028 cdl_preschool · 029–036/039/041 practice-test schema +
question seeds · 037/038/040/042/045 KC article seeds · 043 geocoding provenance
· 044 saved_trips_cloud. **The catch-up recovery work audited here (PRs A/B/C)
adds no migration.** _(Update, after this audit was written: a separate SMS-consent
requirement layered a proposed, still-unapplied migration `046_sms_consents`
onto PR B's branch — see PR #175. It is not on `main`, is not applied, and is
outside this audit's scope.)_

## 18. Scheduled / background jobs
**No cron/scheduled triggers anywhere.** GitHub Actions: `preview-crawl.yml`
(push + manual), `preview-smoke.yml` (manual), `prod-health-check.yml`
(manual). No Supabase edge functions. Sitemap ISR `revalidate=3600`;
on-demand `/api/revalidate` (placeholder). `prebuild` runs the Road Ahead
manifest generator.

## 19. One-off import batches (not runtime code)
`data/imports/` — ~30 interstate truck-stop CSV batches (I-75/65/40/24/95 across
many states), each with review/sources/validation/expansion companions.
`data/geocoding/` — batch + dry-run snapshots. `scripts/` — import validators
(`validate-import.ts`, `build-calibration.ts`, `geocode-dry-run.ts`, …), ~55
`test-*.ts` manual harnesses, and Road Ahead media tooling. All are tooling/
artifacts, not part of the app bundle.

## 20. Areas requiring owner input (needs-decision)
- **`lib/legal/company.ts`** — two `OWNER TO CONFIRM` markers (legal entity
  details; provision/confirm the support mailbox) before public reliance.
- **Academy content** — pricing/tuition, VA/GI Bill status, partner carriers,
  scholarships, facility address/hours/map, curriculum hours/endorsements,
  instructor photos/profiles (all `<Placeholder>` TBD).
- **Store** — real Amazon ASINs/prices (every product is a placeholder;
  affiliate links show "coming soon").
- **Payments** — `api/stripe/webhook` is a placeholder; no live payments wired.
- **Revalidation** — set `REVALIDATE_SECRET` and confirm `/api/revalidate` use.
- **Analytics/email/SMS** — Plausible, Resend, and Twilio are all env-gated and
  currently dormant; owner turns them on.

## Cleanup verdict for this block
The audit found **no conclusively-dead code, no missing image alt text, and no
broken internal links**, and the sitemap gaps are resolved by PR A. The only
candidates (duplicate haversine/slugify, shared `fmtDate`) are **refactors with
behavior risk**, which fall outside this block's "clearly provable, low-risk"
cleanup bar. **No code-cleanup PR was opened** — this document is the sole
Phase-3 deliverable. The duplicate-utility consolidation is recommended as a
future dedicated, test-backed change.

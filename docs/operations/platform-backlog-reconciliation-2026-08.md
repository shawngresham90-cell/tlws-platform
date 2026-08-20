# Platform backlog reconciliation — August 2026 (PLATFORM-AUDIT-1)

Read-only reconciliation of every open pull request, unmerged branch and
unresolved milestone in `shawngresham90-cell/tlws-platform` against **current
main `86d2587`** (`KC-VIS-1: add Class A vs Class B infographic (#345)`,
2026-08-19).

The premise of this audit is that **an open PR is not evidence that its work
is absent.** Most of the open backlog turns out to be already on main, landed
through a different PR, or superseded by a better implementation. Every claim
below was checked against the tree, the harnesses, or the live database — not
against a PR description.

---

## 1. Current state

| Measure | Value | How it was established |
|---|---|---|
| main SHA | `86d2587521f32e82a0387b0c0381fccd0c2deacf` | `git rev-parse origin/main` |
| Working tree | clean, branch at main | `git status --porcelain` (empty) |
| Harness suite | **207 harnesses, 207 passing** | `npm test` on `86d2587` |
| Production build | **succeeds**; 161 static pages, 147 route entries (12 SSG · 49 static · 86 dynamic) | `npm run build` with CI's placeholder env |
| Migration files in repo | **56** (`001` … `056_seed_kc_how_long_cdl_training`) | `ls supabase/migrations` |
| Migrations recorded applied | **54 ledger entries**; see §5 for the true picture | Supabase MCP `list_migrations` |
| Open pull requests | **87** | GitHub API, `state=open`, both pages |
| Open issues | **1** (#123 "image shirt") | GitHub API |
| Remote branches | 313 | `git branch -r` after `--unshallow` |
| Active workflow files | **5** — `ci.yml`, `preview-crawl.yml`, `preview-smoke.yml`, `prod-health-check.yml`, `seo-scout.yml` | `.github/workflows` |

### Live production facts used as evidence

Read-only `SELECT`s through the Supabase MCP against project
`cgvxwvymkembftznhcdl`. **No production row was written, altered or deleted in
this session.** No secret or private value is reproduced here.

| Fact | Value |
|---|---|
| `locations` rows | 2,830 total · **2,454 published** (not deleted) |
| Published rows carrying a `detail_slug` | **2,454 — every one** |
| Published rows with coordinates | 1,940 |
| State coverage | all 48 CONUS states |
| `founders` rows | **51** (Iron 4 · Steel 11 · Brick 20 · Founder-Shirt 16) |
| `campaign_settings` | goal 1,155,000 · raised override 1,206,000 |
| Founder rows carrying a payment reference | **0** |
| `directory_slug_redirects` | table exists, **0 rows** |
| Anon role `statement_timeout` | **3 s** (`authenticated` 8 s) |
| Security advisors | 1 ERROR (`spatial_ref_sys`, known + mitigated by 054), 17 INFO `rls_enabled_no_policy` (deliberate default-deny), 5 WARN (PostGIS + `admin_role`/`is_admin`, all reviewed in the 2026-08-18 RLS audit) |

### Environment constraints on this audit

- **Outbound HTTPS to the public internet is denied by policy.**
  `truckinglifewithshawn.com`, `geocoding.geo.census.gov` and every other host
  return `403` at the agent proxy's `CONNECT`. So **no live HTTP probe of
  production pages, sitemaps or cache headers was possible**, and no claim
  below rests on one. Database evidence came through the Supabase MCP, which
  uses its own transport.
- This also means **PR #220's blocker is unchanged**: the Census geocoder is
  still unreachable, so the ~65-row coordinate-recovery queue it identified
  remains executable only by the owner or from an environment with egress.

---

## 2. Classification matrix

Classes: **A** already present on main · **B** superseded by later work ·
**C** still valid, code fix needed · **D** still valid, data/production action
needed · **E** owner decision required · **F** diagnostic only, close
candidate · **G** unsafe or too stale to revive · **H** unknown, more evidence
required.

Every branch listed is **97–292 commits behind main**; "reuse branch?" answers
whether the branch itself should ever be merged or rebased, as opposed to
having its idea reimplemented.

### 2.1 Data integrity, consent and leads

| PR | Original problem | Current-main evidence | Production evidence | Class | Risk if ignored | Next action | Reuse branch? | Scope | Overlap |
|---|---|---|---|---|---|---|---|---|---|
| **#228** — newsletter form erasing the leads it writes | `/api/lead` blind-upserted a whole row, so a newsletter repeat wrote `null` over `first_name`/`phone`, relabelled `source`, cleared `utm` and **revoked a real SMS opt-in** | **Fully on main**: `src/lib/leads/merge.ts`, the insert-or-merge route with the 23505 race branch, `src/lib/leads/email-consent.ts`, `supabase/migrations/049_email_consents.sql`, `scripts/test-newsletter-correctness.ts`, `docs/newsletter-correctness.md` | `leads` RLS-enabled, no policy, service-role only | **A** | none — resolved | Close the PR; the branch is a duplicate of main | **No** | — | leads, SMS consent |
| **#228 residue** — `EMAIL-CONSENT-01` disclosure wording | `EMAIL_CONSENT_DISCLOSURE` is deliberately empty; `EMAIL_CONSENT_VERSION` pinned at `v0-unapproved` | Still empty on main; recording is inert by construction | `email_consents` / `email_unsubscribes` **absent** from production | **E** | Email consent cannot be recorded, so no email may honestly be sent | Owner supplies the approved sentence + bumps the version in the same commit; then apply 049 | n/a | small | newsletter, legal |

### 2.2 Directory completeness, reads and the false-404 class

| PR | Original problem | Current-main evidence | Class | Risk if ignored | Next action | Reuse branch? | Scope | Overlap |
|---|---|---|---|---|---|---|---|---|
| **#216** — capped, unordered directory reads returning a silent sample | `collectAllRows` with keyset paging, count-on-the-page corroboration, `DIRECTORY_MAX_PAGES` guard and the build-phase memo are **all on main** (`src/lib/directory/data.ts`), with `scripts/test-directory-complete-read.ts` | **A** | none — resolved | Close the PR | **No** | — | directory, sitemap |
| **#218** — Exit 369 404 diagnostic | Its finding (a **server-side ~1,000-row PostgREST cap**, not a cache artifact) is the root cause #216 fixed. The instrumentation itself is not on main | **F** | none; the workflow steps were explicitly throwaway | Bank the finding (recorded here), close the PR, keep step 3 only if an exit-404 CI canary is wanted | **No** | — | prod-health-check |
| **Detail-page false 404** (no PR; recorded in `docs/stabilization-2026-08/AUDIT-2026-08-04.md` under "known limitations, deliberately not fixed here") | `getEntryByDetailSlug` collapsed a query error into `null`, and `/directory/location/[slug]` turned `null` into `notFound()` — the same class #215 fixed for exits, on the **larger** surface | Present on main until this PR | **C** | A transient DB error mints a **cached 404** over a real, indexed listing page; 2,454 sitemap URLs at risk | **SELECTED — implemented in this PR** (§4) | n/a | small | directory, SEO, ISR |
| **Facet trim/case normalization divergence** (same audit) | Facet values are normalized differently from the exact-match page query — a latent variant-spelling 404 | Still present | **C** | Latent false 404 on odd exit spellings | Own follow-up PR with a failing test first | n/a | small | directory |
| **`getListingRefs` 2,000-row cap** (`src/lib/community/data.ts:35`) | An ordered but capped read of 2,454 published rows feeds the submit/review pickers; the production API path additionally caps ~1,000 | Still present on main; **not covered by #216**, which only fixed `lib/directory/data.ts` | **C** | Drivers cannot review or submit against a large share of listings; silent, not an error | Own follow-up PR: route it through `collectAllRows` | n/a | small | community, directory |
| **Category-page mobile payload** (flagged by #216) | Complete reads made the prerendered category page ~1.7 MB raw / **113 KB gzipped**, and the map page ~3.9 MB raw / **198 KB gzipped** | Still true on main — correct at the data layer, heavy on a phone | **C** | Mobile usability on a driver's phone | Presentation-layer fix (server-side slicing or streaming); own milestone | n/a | medium | directory, performance |
| **Netlify build regression** (#216 / #217) | 135 s → 230–257 s, confirmed as #216's own cost, never isolated; ~27 s run-to-run variance | The code is on main, so **the regression is on main** | **H** | Slower deploys; unknown cause | Needs the Netlify build-log phase breakdown, which is not exposed to this environment | n/a | unknown | build/deploy |
| **#48** — directory search & revenue optimization | Search/sort core **is** on main (`src/lib/directory/browse.ts` + `test-browse.ts`). The `/directory/browse/{cities,brands}` and `/directory/stats` **pages** are not | **B** (core) / **E** (pages) | Adding them now works *against* a settled decision: the 2026-08-17 crawl audit ranks "long-tail programmatic weight" as root cause #2 suppressing crawl value | Do not revive the pages without an owner decision that reverses §19.4 of that audit | **No** | large | directory, SEO |
| **#37** — dedupe directory reads with React `cache()` | Superseded by `src/lib/directory/request-cache.ts`, a broader implementation wired into the exit page | **B** | none | Close | **No** | — | directory |
| **#36** — sitemap `lastmod` from listing `updated_at` | Superseded: `src/lib/seo/sitemap-entries.ts` emits `lastModified` from `updated_at` inside the segmented-sitemap architecture | **B** | none | Close | **No** | — | SEO |
| **#38** — import + routing unit coverage | The 207-harness suite covers both areas far beyond this PR's 73 checks | **B** | none | Close | **No** | — | testing |

### 2.3 Parking, coordinates and geocoding

| PR | Original problem | Evidence | Class | Risk if ignored | Next action | Reuse branch? | Scope | Overlap |
|---|---|---|---|---|---|---|---|---|
| **#220** — parking verification audit | Docs + one guard test; **absent from main**. Its headline is that zero locations could be verified because every authoritative source is proxy-blocked | Re-confirmed this session: `geocoding.geo.census.gov` still `403` | **D** (its recommendation) / mergeable documentation (the PR itself) | The **~65 published rows with a positive parking count and no coordinates** stay invisible to Trip Planner and Near Me | Owner: allow egress to `geocoding.geo.census.gov`, then run the queue canary-first (5 → audit → remainder), stamping `geocode_source` + `coord_verification_status` | Branch is clean and mergeable as-is | small (docs) | parking, geocoding |
| **#220 finding — capacity double-counting** | 13 shared addresses repeat a parking count across co-located rows (2,189 spaces over 16 redundant rows) | Nothing in the product sums `parking_spaces` today | **E** | A future report would overstate real capacity | Owner decides which row owns a shared count | n/a | small | directory data |
| **#220 finding — 4 coordinate collisions** | Distinct businesses sharing one point | Needs the unreachable geocoder | **D** | Imprecise map pins | Quarantine, resolve after egress | n/a | small | directory data |
| **#220 finding — provenance gap** | 1,623 of 1,973 coordinate rows have `coord_verification_status` and `geocode_source` NULL while `directory-loader.ts` claims every coordinate came through human review | The columns exist in production; the discrepancy is real | **H** | The provenance claim in code cannot be evidenced | Reconcile the comment or the data — do not guess which is wrong | n/a | small | directory data |
| **#157 / #158** — Census geocoder runner + corridor interpolation | Superseded by `src/lib/directory/census-geocoder.ts` + `geocode-pipeline.ts` on main — an injected-fetch adapter behind a seam, strictly better than the standalone runner. `data/geocoding/census/` is on main | **B** | none | Close | **No** | — | geocoding |
| **#156** — I-75 GA/TN interpolation package | Dry-run artifacts only; `data/geocoding/i75-package` absent from main | **D** | Coordinate coverage stays where it is | Fold into the post-egress geocoding run rather than reviving | **No** | — | geocoding |
| **#35** — 3-way geocoding queues | Superseded by `scripts/geocode-stage-report.ts` + `src/lib/directory/backfill-stages.ts` on main | **B** | none | Close | **No** | — | geocoding |
| **~50 `feat/directory-batchNN-*` PRs** (#56–#121) — corridor candidate CSVs, "no import" | Production carries listings in **all 48 CONUS states**, including the I-10/20/30/40/70/80/90 corridors these batches proposed — the coverage landed through the operator-master / TA / Pilot / Love's / NTAD import paths, not through these CSVs | **B** for the corridors already covered | none | Close in bulk | **No** | — | directory data |
| **Exception — Northeast I-95 batches** (#114 PA, #115 NJ, #116 NY, #117 CT, #118 RI, #119 MA, #120 NH, #121 ME) | Production has CT 6 · RI 1 · MA 2 · NH 1 · ME 1 (0 published) · VT 1 (0 published). These batches genuinely did **not** land | **D** | The Northeast I-95 corridor is close to empty for drivers | Owner-run import after re-validation; the CSVs are 13 months of drift old and must be re-checked, not trusted | **Data only**, never the branch | medium | directory data |
| **#32 / #34 / #39** — I-65 KY, I-24 TN, I-24 KY batches | KY 132 rows / TN 221 rows in production; corridors covered | **B** | none | Close | **No** | — | directory data |

### 2.4 Founders, sponsors and revenue

| PR | Original problem | Evidence | Class | Risk if ignored | Next action | Reuse branch? | Scope | Overlap |
|---|---|---|---|---|---|---|---|---|
| **#219** — founder recognition execution record | Records 31 founders, raised $11,305, "$245 left to open the school" | **Production has 51 founders and raised $12,060 — past the goal.** Every number in the record is stale, and its 31-check harness asserts those numbers | **G** | Merging it would enter a *wrong* execution record into the tree and add a harness that fails against reality | Close. `docs/operations/founder-wall-51-roster.sql` on main is the current record | **Never** | — | founders |
| **#194** — Founder Wall least-privilege grants + tier amounts | The **database half is applied**: `founders` grants to `anon`/`authenticated` are gone (service-role only), the public read runs through a PUBLIC-role `is_public` policy. The code half (`scripts/e2e-founders-wall.mjs`) is absent from main | **A** (grants) / **E** (tier dollar amounts) | Tier thresholds stay `<Placeholder>` — a founder cannot see what a tier costs | Owner supplies the approved amounts; the e2e harness is optional debt | **No** (branch is 159 commits stale and touches evolved files) | small | founders, monetization |
| **`founder-wall-51-roster.sql` header drift** | The file on main says "**NOT EXECUTED. NOT RUN BY ANY MIGRATION.**" | Production tier counts match it **exactly** (4/11/20/16 = 51), so it *was* executed | **C** (documentation accuracy) | A future reader is told a live change is pending | One-line header correction in a docs PR | n/a | trivial | founders |
| **#192** — first-customer prep (placement terms, queue, outreach kit, pilot SOP) | `src/lib/directory/placements.ts` and most of `data/revenue-readiness/` are on main; `FIRST-10-QUEUE.csv`, `OUTREACH-FIRST-10.md`, `docs/directory/{first-sale-baseline,first-sale-security-review,pilot-sales-sop,pilot-scorecard}.md` are **not** | **E** | No documented first-sale process; revenue path is code-ready but process-less | Owner decides whether to adopt the SOP as written (it is a sales process, not a code change) | Docs may be cherry-picked after re-reading | medium | monetization |
| **#162** — launch readiness (monetization paths, KC conversions, email funnel, `/go` links, sponsor polish, guides) | The engineering half **is on main**: `scripts/crawl-links.mjs`, `preview-crawl.yml`, `test-{analytics,go-links,kc-conversions,lead-funnel,newsletter,sponsor-inquiry}.ts`, `docs/{analytics-setup,youtube-funnel-guide}.md`. Missing: `docs/{launch-checklist,post-merge-checklist,directory-monetization-guide,sponsor-program-guide}.md` | **B** (code) / **E** (the four guides) | Operational checklists live only in a stale branch | Rewrite the four guides against current main if wanted — do **not** merge a 190-commit-stale 105-file branch | **Never** | large | many |
| **#52** — Academy thermometer ISR | `export const revalidate = 60` and the live `campaign_progress` read are on main (`src/app/(academy)/academy/page.tsx:51`) | **A** | none | Close | **No** | — | academy, founders |

### 2.5 Navigator

Source: `docs/operations/navigator-technical-debt-audit-2026-08.md` (14
findings). Re-verified against main this session.

| Finding | Status on main | Class | Risk if ignored | Next action |
|---|---|---|---|---|
| **1 — HIGH: off-route voice announcement unreachable** | **FIXED.** `DrivingScreen.tsx:1675` now keys the announcement off the render-time `lcState`, which is exactly the seam the audit proposed | **A** | none | Update the audit doc's status |
| **2 — MEDIUM: a failed destination search caches `[]` and poisons that query** | **STILL LIVE.** `DestinationSearch.tsx:215` calls `coord.accept(decision.seq, [])` on failure; `search-coordination.ts:78` caches unconditionally, so retyping returns `{kind:'cached', places: []}` → "No places found." | **C** | A driver is told a truck stop does not exist when the request merely failed once | Own follow-up PR — **highest-ranked unresolved Navigator item**, no owner decision needed |
| **5 — `beginHold` re-entrancy** · **10 — `GpsProvider.start()` throw path** · **8 — `resourcesReleased()`** · **11/12 — marker churn, `announced` cap** | Not re-verified individually; audit lists them as no-owner-decision follow-ups | **C** | Leaks and annoyances, no safety impact | Batch into one Navigator hygiene PR, each with its own failing test |
| **3, 4, 6, 7** | Audit explicitly lists these as owner-decision-first | **E** | — | Owner answers the four questions in §"Owner decision required first" |
| **Process note** — behaviour pinned by regex over source text | Still the dominant harness style | **C** | A pin can pass against code that cannot execute (that is how Finding 1 survived) | Prefer driven tests wherever a pin guards behaviour. *This PR's new harness does exactly that* |
| **050–053 navigator account migrations** | Written, marked PROPOSED, gated on `NAVIGATOR_ACCESS_MODE=account`. `navigator_profiles` / `navigator_state` / provider-usage tables **absent from production**; the admin usage page degrades with an explicit "Migration 051 must be applied" message | **E** | Account mode cannot launch | Owner decides launch; 049 must be applied first (050 depends on it) |

### 2.6 Security

| Item | Status | Class | Next action |
|---|---|---|---|
| Migration **054** public-API-surface lockdown | **Applied** in production (ledger `20260818230334`) | **A** | none |
| `spatial_ref_sys` advisor ERROR | Still fires — the lint reads the RLS flag, which only Supabase can change; 054's guard trigger blocks API-role writes | **E** | Owner decision #1 of the 2026-08-18 RLS audit: support ticket, then dashboard acknowledgement |
| 17 `rls_enabled_no_policy` INFO notices | Deliberate default-deny on server-only tables | **A** | none — do not "fix" these |
| Leaked-password protection disabled | Confirmed still disabled by the advisor | **E** | One dashboard toggle (owner decision #4) |
| `location_reviews` has no public SELECT policy | Confirmed: RLS on, no policy. The detail page reads approved reviews with the **service-role** client inside a server component, so the feature works — but anon direct reads return nothing | **E** | Owner decision #3: is public review display wanted? |
| TruckLifePWA project named in the same advisor email | Out of scope of the RLS audit and of this one — a **different Supabase project** | **H** | Triage separately |
| Five unauthenticated planner POST endpoints (`/plan` `/route` `/stops` `/cost` `/hos`) | Verified: rate-limited 20/min per IP per instance, 512 KB body cap, zod-validated, pure compute, no DB write, no provider spend | **E** | "Delete or gate" is a product question (ship split-sleeper?), not a defect to fix unilaterally |
| `lib/legal/company.ts` `OWNER TO CONFIRM` markers | Still present | **E** | Owner confirms legal entity details before public reliance |

### 2.7 SEO

| Item | Status | Class |
|---|---|---|
| Crawl audit **PR-A** (`/terms` in sitemap, honest `lastmod`, admin noindex) | **On main** — `sitemap-entries.ts:118` carries `/terms`; `lastModified` only where a real date exists | **A** |
| **PR-B** (indexability gate redesign, `noindex, follow`) | **On main** — the detail page passes `follow: true` with the "PR-B, 2026-08-17" note | **A** |
| **PR-C** (server-rendered links to money pages) | **On main** — Header/Footer carry curriculum + financing + requirements; `scope-links.ts` cross-links parking and CAT-scale state pages | **A** |
| **PR-D** (sitemap segmentation) | **On main** — `/sitemaps/{core,directory-hubs,directory-exits,directory-details,directory-directions}.xml` behind the stable `/sitemap.xml` index | **A** |
| **PR-E / PR-F** (Academy content depth, template + conversion work) | Not started. **Binding owner decision:** the Dalton school is not yet open, so copy and Course schema must use planned/opening language | **E** |
| **"Netlify cached-404 class"** listed under §18 *Dangerous findings (owner attention)* | Closed for exit pages by #215 + #216; **open for detail pages until this PR** | **C → fixed here** |
| TikTok handle conflict (`sameAs` vs homepage deep links) | Unresolved; external verification is blocked by the same egress policy | **H** |
| SEO Scout | `seo-scout.yml` is manual-dispatch by design; no cron until one or two real runs are observed | **E** |
| "SEO Fact Gate" | **No such artifact exists** anywhere in the repo — no code, no doc, no branch. Recorded so it is not searched for again | **H** |

### 2.8 Experimental / product-direction branches

| PR | Status | Class | Next action |
|---|---|---|---|
| **#154** — Road Ahead cinematic scaffold | `/road-ahead` and `src/components/road-ahead/*` are **on main**, with `test-road-ahead.ts` and the prebuild manifest generator | **A** | Close |
| **#153** — Founders Movement POC (FM-1/2/3) | `src/components/founders-movement/*` and `/founders-movement` are **absent** from main. It adds `@react-three/fiber` + `three` scenes | **E** | Product decision, not a defect. 191 commits stale |
| **#159** — books catalog 3 → 6 | Covers and audit workflow absent from main | **E** | Needs real ASINs/covers — owner data |
| **#152** — KC Hazmat + Owner-Operator clusters | Its migrations are numbered `046`/`047`, which **collide with the applied `046_sms_consents` and `047_mile_marker_overnight_status`** | **G** | Never merge as-is. Re-cut the seeds at `057+` if the content is wanted |
| **#179** — add `CLAUDE.md` | Absent from main | **C** (trivial) | Rewrite against current main; a 174-commit-stale codebase guide would document a repo that no longer exists |

---

## 3. Explicitly completed or superseded — do not revive

The following are **on main already**. Reviving any of them means re-landing
work that exists, and in several cases regressing a better implementation.

- **TP-1 … TP-6**, the controlled I-75 road-test instrumentation, and the
  Trip Planner engine.
- **#228** — the lead insert-or-merge fix, `merge.ts`, migration `049` (file),
  the 145-assertion harness and its doc.
- **#216** — `collectAllRows`, the corroborated terminal condition,
  count-on-the-page, the build-phase memo, and `test-directory-complete-read`.
- **#215** — the empty-vs-error read contract and the exit page's three-outcome
  resolution.
- **#218's finding** — the Exit 369 root cause (a server-side ~1,000-row
  PostgREST cap) is diagnosed *and fixed*; the diagnostic workflow itself is
  throwaway.
- **#37** → superseded by `request-cache.ts`. **#36** → superseded by the
  segmented sitemaps. **#35** → superseded by `backfill-stages.ts` +
  `geocode-stage-report.ts`. **#157/#158** → superseded by
  `census-geocoder.ts` behind the `geocode-pipeline.ts` seam. **#38** →
  superseded by the 207-harness suite.
- **#52** — Academy thermometer ISR (`revalidate = 60`).
- **#194's database half** — Founder Wall least-privilege grants, applied.
- **#162's engineering half** — crawl-links, preview-crawl workflow, and six
  harnesses.
- **#48's search core** — `lib/directory/browse.ts`.
- **Migration 054** — the public API surface lockdown, applied.
- **SEO PR-A / PR-B / PR-C / PR-D** — sitemap hygiene, the indexability gate
  redesign, money-page internal links, and sitemap segmentation.
- **LOCAL-SEO-1**, the SEO Search Console Scout, migrations **055** and
  **056**, the Knowledge Center article visual infrastructure and the Class A
  vs Class B infographic.
- **Navigator technical-debt Finding 1** — the off-route voice announcement,
  fixed via the render-time `lcState` seam.
- **~50 directory corridor batch PRs** — the corridors they proposed are
  populated in production through the operator-import path.

---

## 4. Ranked unresolved queue

Ranked by the standing order: active data corruption → security/privacy →
driver safety/HOS → production availability → lost leads or revenue →
SEO/indexing → performance/mobile → maintenance debt.

| # | Candidate | Severity | Confidence | Size | Owner decision? | Production write? |
|---|---|---|---|---|---|---|
| **1** | **Detail-page false 404** — a failed read on `/directory/location/[slug]` becomes a cached `notFound()` across 2,454 indexed pages | **critical** | **high** | small | no | no |
| 2 | Northeast I-95 directory coverage — CT/RI/MA/NH/ME/VT effectively empty for drivers | high | high | medium | yes (import approval) | **yes** |
| 3 | ~65 published rows with parking but no coordinates — invisible to Trip Planner and Near Me | high | high | small | yes (egress + import) | **yes** |
| 4 | Navigator Finding 2 — a failed search caches `[]` and permanently poisons that query | high | high | small | no | no |
| 5 | `getListingRefs` 2,000-row cap — submit/review pickers see a truncated listing set | medium | high | small | no | no |
| 6 | Facet trim/case normalization divergence — latent variant-spelling 404 | medium | medium | small | no | no |
| 7 | Directory category/map page payload — 113 KB / 198 KB gzipped on a driver's phone | medium | high | medium | no | no |
| 8 | Netlify build regression from #216 — 135 s → 230–257 s, cause not isolated | medium | low | unknown | no | no |
| 9 | Navigator hygiene batch — Findings 5, 8, 10, 11, 12 | low | medium | medium | no | no |
| 10 | Documentation drift — `founder-wall-51-roster.sql`'s "NOT EXECUTED" header; the RLS audit's claim that 047 is unapplied (it is applied, via a guarded MCP application under a different ledger name) | low | high | trivial | no | no |

---

## 5. Migration reconciliation

The Supabase ledger is **not** a complete record of what is applied — several
migrations were applied through guarded MCP calls that recorded a different
name, and `047` was applied that way deliberately (its own header says so).
Objects were therefore checked directly.

| Migration | In repo | Objects present in production | Verdict |
|---|---|---|---|
| 001 – 046, 048 | yes | yes | applied |
| **047** mile-marker + overnight status | yes | `locations.mile_marker`, `mile_marker_source`, `overnight_status`, `overnight_status_source` all exist | **applied** — the 2026-08-18 RLS audit's "047 not yet applied" line is out of date |
| **049** email consents | yes, marked PROPOSED | `email_consents`, `email_unsubscribes` **absent** | not applied — blocked on `EMAIL-CONSENT-01` (owner) |
| **050–053** navigator accounts | yes, marked PROPOSED | navigator tables **absent** | not applied — gated on `NAVIGATOR_ACCESS_MODE=account`; 050 depends on 049 |
| **054** public API surface lockdown | yes | applied (ledger `20260818230334`) | applied |
| **055**, **056** KC article seeds | yes | applied | applied |

**This PR adds no migration and applies none.** No production DDL or DML was
issued in this session; every statement was a `SELECT`.

---

## 6. Branch hygiene

No branch is merged, closed or deleted by this audit — that is the owner's
call. For the record: **every open PR's branch is between 97 and 292 commits
behind main**, and the three largest (#162 at 105 files, #48 at 43 files, #157
at 21 files) touch modules that have since been rewritten. The safe pattern
for anything still wanted from them is **reimplement the idea against current
main**, not rebase the branch. The two exceptions where a branch is genuinely
clean and reusable are **#220** (documentation + one guard test, mergeable as
is) and **#219** — which is clean but *wrong*, and must not be merged.

---

## 7. What this audit did not do

- No live HTTP probe of production (egress denied by policy — see §1).
- No production write of any kind.
- No migration applied.
- No PR merged, closed, or auto-merged; no branch deleted.
- No secret, key, or private production value printed.
- Findings for the **TruckLifePWA** Supabase project were not triaged; it is a
  separate project and out of scope.

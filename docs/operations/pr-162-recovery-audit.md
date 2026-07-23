# PR #162 Recovery Audit

**Date:** July 2026 · **Current main:** `f4e578700b670c89498180b7f293d316b1c5dbf5`
**Stale PR:** #162 `claude/launch-readiness` (draft, open, base `f0aefb3`) — head `2bf5a33`.

PR #162 was stacked on the (since-merged) platform-activation branch. Its own
"block-2" work is commits `36f1fa8..2bf5a33`. Main has moved far past #162's
base (PRs #161, #163–#173 merged since), so #162 is **not rebased or
modified** — the still-needed, low-risk portions are **reimplemented cleanly
against current main** here. PR #162 is left untouched.

## Method

Isolated #162's own diff (`git diff e03b780..2bf5a33`), confirmed each new
file is absent from current main, salvaged the architecture-independent pure
logic (maps, allowlists, taxonomies) as reference, and re-checked every
destination route, category slug, table column, and admin gate against
current main before rebuilding.

## Feature classification

| # | PR #162 feature | Classification | Notes |
|---|---|---|---|
| 1 | KC "Keep going" conversion blocks (`kc/conversions.ts` + `KcNextSteps`) | **STILL MISSING — SAFE TO REBUILD** | All 6 category slugs (`hours-of-service`, `dot-compliance`, `cdl-training`, `getting-your-cdl`, `trucking-careers`, `health-on-the-road`) still valid; all destinations are confirmed-live static routes. Rebuilt in **PR A**. |
| 2 | `/go/[slug]` tracked YouTube links (`go-links.ts` + route) | **STILL MISSING — SAFE TO REBUILD** | Allowlist + `Object.hasOwn` prototype-chain guard salvaged. Reduced to slugs whose destinations are **confirmed-live static routes** (KC-category-dependent targets dropped — those routes render only if a DB category row exists). Rebuilt in **PR A**. |
| 3 | Sitemap gaps (`/road-ahead`, `/trip-planner`, `/books`, `/apps`, `/sponsors`, …) | **STILL MISSING — SAFE TO REBUILD** | Confirmed still absent from `sitemap.ts`. Plus `/dot-tools`, `/directory/parking`, `/privacy`, `/sms-terms` (new since #162). Rebuilt in **PR A**. |
| 4 | Directory "Get featured" CTA (`GetFeaturedCta`) on 8 surfaces | **STILL MISSING — SAFE TO REBUILD** | Deep-links to the existing sponsor inquiry pipeline. Rebuilt in **PR B** with a bounded interest preselect. |
| 5 | Sponsor inquiry **message** shown in CRM (`/admin/sponsors`) | **STILL MISSING — SAFE TO REBUILD** | Confirmed: the inquiry message is stored in `sponsors.notes` (via `/api/sponsor-inquiry`) but `getSponsors()` never SELECTs it. Read-only fix in **PR B**. |
| 6 | `/admin/leads` read-only segmented view (`leads/funnel.ts`) | **STILL MISSING — SAFE TO REBUILD (read-only only)** | `leads` table exists (`008_leads.sql`: email, first_name, phone, sms_consent, source, utm, created_at). Segment taxonomy salvaged for **display only**. Rebuilt read-only in **PR B**. |
| 7 | `/api/lead` first-touch attribution + `sms_consent` optional | **DEFERRED — OUT OF SCOPE** | Changes lead **upsert + consent semantics**, which this work block explicitly forbids ("do not alter lead upsert or consent semantics"). **Not ported.** Documented for a future dedicated review. |
| 8 | Mobile menu close-on-navigation / Escape (`MobileMenu.tsx`) | **ALREADY PRESENT** | Current `HeaderMenu.tsx` (client shell) already closes on route change (`usePathname` effect) and on Escape (returns focus to the trigger). No change needed. |
| 9 | Sponsor `/sponsors` FAQ block | **STILL MISSING — SAFE TO REBUILD (optional)** | Process-facts FAQ, no pricing. Low priority; folded into PR B only if it does not expand scope, else deferred. |
| 10 | Owner guides (sponsor/directory/youtube/launch/post-merge) | **STILL MISSING — SAFE TO REBUILD (selective)** | The YouTube funnel guide is rebuilt in PR A alongside `/go`. Others are re-created only where they document shipped behavior. |
| 11 | `tier_interest` bounding in the inquiry schema | **ALREADY PRESENT / VERIFY** | The current schema bounds `tier_interest`; PR B preselects an existing allowed value only. |
| 12 | Preview-crawl GitHub workflow + `crawl-links` retries | **DEFERRED** | CI/workflow scaffolding — out of scope for a content/lead block; not reintroduced. |

## Guardrails carried forward

No `/api/lead` semantic change · no migrations · no new DB columns · no
writes from admin pages (read-only additions) · server-side `requireAdmin()`
on every admin surface · allowlist-only `/go` redirects · confirmed-live
routes only · DOT Tools links point solely to the static landing and never
imply the tools are functional.

## Not touched

PR #162 itself (not rebased, not modified, not closed); functional DOT
Tools; the standalone Reg Deck app; Store catalog; Directory imports;
Newsroom.

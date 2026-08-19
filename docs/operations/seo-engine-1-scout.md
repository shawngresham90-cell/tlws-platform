# SEO-ENGINE-1 — Search Console Opportunity Scout

A read-only evidence collector that answers one question:

> "What Google searches are already giving us an opening, and which
> existing page should we improve first?"

It fetches the last 28 complete days of (query, page) performance from
Search Console plus the preceding 28 days, classifies opportunities with
documented deterministic thresholds, and writes a bounded owner report. It
creates nothing, publishes nothing, opens no PRs, and touches no database.
Everything downstream (briefs, content, fact-checking, publishing) is a
LATER milestone and stays human-gated.

## What Shawn must do to connect Search Console (one-time)

The Scout fails clearly (exit 2) until this is done — it never invents data.

1. In **Google Cloud Console** (any project, e.g. a new "tlws-seo" project):
   - enable the **Google Search Console API**;
   - create a **service account** (no special roles needed);
   - create a **JSON key** for it and download the file.
2. In **Search Console** for the `truckinglifewithshawn.com` property:
   Settings → Users and permissions → **Add user** → the service account's
   email (`…@….iam.gserviceaccount.com`) with **Full** or **Restricted**
   (Restricted is enough — the Scout only reads).
3. In the **GitHub repo**: Settings → Secrets and variables → Actions →
   **New repository secret** named `GSC_SERVICE_ACCOUNT_JSON`, value = the
   entire JSON key file contents.
4. Run the **"SEO Scout (manual)"** workflow from the Actions tab and
   download the `seo-scout-report` artifact.

If the account holds a URL-prefix property instead of the domain property,
dispatch the workflow with the `property` input set to
`https://truckinglifewithshawn.com/` (the code defaults to
`sc-domain:truckinglifewithshawn.com`).

Local runs work the same way:
`GSC_SERVICE_ACCOUNT_JSON="$(cat key.json)" npx esbuild scripts/seo-scout.ts --bundle --platform=node --format=cjs --outfile=/tmp/scout.cjs && node /tmp/scout.cjs`

**Never commit the key file.** It exists only as the CI secret / a local
env var. The Scout never prints it, and `scripts/test-seo-scout.ts` fails
the build if credential references ever appear under `src/` (browser code).

## What the report contains

`seo-scout-output/report.md` — sections per commercial cluster
(Academy/Local, National Information, Product Support), per opportunity
type (Striking Distance, Decay, Potential Gaps, Strengthen), and a
**Recommended Owner Review Queue** capped at 15 items (hard ceiling 20).
Every ranked item shows its full score decomposition. `data.json` carries
the same rows machine-readably.

Each item carries one recommended action, and the distinction is the point:

- **IMPROVE_EXISTING_URL** — the default. Strengthen the page that already
  ranks (or the designated existing route, e.g. Academy queries → `/academy`).
- **POSSIBLE_NEW_PAGE** — a suggestion only, raised only for high-volume
  gaps with no suitable existing route. The Scout never creates pages;
  unreviewed page generation is how cannibalization and doorway pages
  happen.
- **MANUAL_REVIEW** — ambiguous signals; a human looks first.

## Thresholds and weights

All in `scripts/seo-scout/config.ts`, each with its rationale:
striking distance = position 4–20 with ≥ 50 impressions/28d; decay and
strengthen require both a relative and an absolute change over a meaningful
base, so tiny-volume noise never qualifies; cluster weights
(academy_local 3.0 > product_support 1.5 > national_info 1.0) are an
owner-reviewed **prioritization heuristic** — they encode what a click is
worth to the business and are not a Google ranking factor. The score is the
Scout's own number, never presented as Google's.

## Storage decision (why there are no new Supabase tables)

SEO-ENGINE-1 produces one bounded report per run, and the prior-period
comparison comes from the API itself — nothing needs to be queried across
runs yet. Per the post-#340 security posture, no table means no new RLS
surface: the output is a local/gitignored directory locally and a
90-day-retained workflow artifact in CI. If a later milestone genuinely
needs run-over-run history, that becomes a separately reviewed migration
(minimum tables, RLS-enabled from creation, service-role-only, contract
tests) — not a side effect of this one.

## Guardrails inherited from the merged SEO/security program

No city pages, no licensing claims, no Academy fact changes, no GBP edits,
no FMCSA/DOT content generation, no sitemap/canonical/schema rework — the
Scout only *identifies* opportunities against the already-merged
architecture. Weekly automation is deliberately absent until at least one
real run has been reviewed.

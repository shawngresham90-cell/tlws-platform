# Directory revenue milestone — validation record

Run date: 2026-07-26. Branch: `claude/directory-revenue`, on top of `main` at
`1e12221` (PR #189).

## Checks run

| Check | Command | Result |
| --- | --- | --- |
| Format | `npx prettier --check` (src, scripts, new docs) | pass |
| Lint | `npx next lint --max-warnings=0` | pass, 0 warnings |
| Types | `npx tsc --noEmit` | pass |
| All offline harnesses | `node scripts/run-tests.mjs` | **67/67 harnesses pass** |
| Production build | `npm run build` | pass, no errors or warnings |
| Browser e2e | `node scripts/e2e-directory-revenue.mjs` | **84/84 pass** |

New and changed harnesses:

| Harness | Assertions |
| --- | --- |
| `test-directory-offers` | 76 (was 67; +9 for paid-placement disclosure) |
| `test-directory-funnel` | 85 (was 79; +6 for the corridor parameter) |
| `test-directory-inquiry` | 62 (new — the CRM parse round trip) |
| `test-sponsor-inquiry` | 19 (was 14; the old "no pricing anywhere" rule replaced by "every price matches the offers module") |

## What the browser run covers

Against a real `next start` production server, headless Chromium:

- **Accessibility** — axe-core on `/sponsors`, `/sponsors` with listing context,
  `/directory`, `/directory/tire-repair`, and the listing funnel, at 390×844 and
  1280×900. **Zero serious or critical violations** on every page at both sizes.
- **Mobile overflow** — no horizontal scroll on any page at 390px.
- **Keyboard** — all seven form controls reachable by Tab, in visual order.
- **Pricing integrity** — every dollar figure rendered on a public surface is
  one of the six approved values (`$99`, `$999`, `$299`, `$2,999`, and the two
  derived savings `$189`, `$589`). Capacity and inquiry framing are asserted;
  guarantee and scarcity language is asserted absent.
- **Injection** — a query string carrying `"><script>alert(1)`, an `onerror`
  image, a `javascript:` corridor and a bogus state fires no dialog, injects no
  script, preselects nothing, and drops the bad state.
- **Form failure and retry** — an empty submit never posts; field errors show; a
  submit without a verification token never posts and explains why; the form
  stays usable for the retry.
- **Analytics failure** — with `window.plausible` replaced by a function that
  throws, the form is still interactive and no page error escapes.
- **Internal links** — every code-resolved internal link found on those pages
  returns < 400.

## Environment limits, stated plainly

This container has no network route to Supabase. That is not a code defect and
it is not worked around:

- Directory **detail pages 404 locally** and the hub/category pages render their
  empty state. The listing funnel is therefore audited from its own
  server-rendered markup with the production stylesheet — the same component,
  the same CSS, real axe and real layout measurement, but not a live data page.
- `/knowledge/dot-compliance` 404s for the same reason (Knowledge Center
  articles are database-backed). It is reported separately from the link check
  rather than counted as a broken link.
- Both are reported in the e2e output, not suppressed.

The live behaviour of the detail-page funnel was confirmed on the PR #189 deploy
preview, which passed manual review.

## Database drift

No writes were made in this milestone. Measured after all work:

| | |
| --- | --- |
| `locations` | 1556 rows, `is_featured` **0** |
| `locations` last `updated_at` | 2026-07-26 14:46:53 UTC (PR #187's publication run, before this work) |
| `locations` row digest | `911773b876a3a93897401406a14616e2` |
| `sponsors` | 0 |
| `sponsor_touches` | 0 |
| `directory_sponsors` | 0 |

`git diff origin/main...HEAD -- supabase/` is **empty**: no migration was added,
and none was applied.

## The one remaining setup step

`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is not set in Netlify, and no existing Plausible
account covering the production domain could be proven. Analytics was therefore
**not** enabled: no account was created and no charge was incurred. All 14
events are wired and `trackEvent` no-ops safely without the script, so setting
that single variable (Builds scope, correct deploy context, then redeploy) turns
measurement on. Nothing else is pending.

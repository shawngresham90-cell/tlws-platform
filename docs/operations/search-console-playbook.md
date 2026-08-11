# Google Search Console playbook — TLWS platform

Owner-facing operations doc. Current milestone: Google has processed
`https://truckinglifewithshawn.com/sitemap.xml` and reports **~4,890
discovered pages**. This doc is what to do (and deliberately not do) from
here. Nothing in it requires code changes; when it says "open a PR," that
means filing the evidence for an engineering pass.

## 1. What to monitor in Page indexing

Open **Indexing → Pages** and watch three numbers monthly:

- **Indexed** — should climb steadily for months. The directory is ~2,400
  long-tail pages; Google indexes long-tail programmatic content slowly and
  in waves. Climbing = healthy, even if slow.
- **Crawled – currently not indexed** — normal and expected at this scale,
  especially for exit pages and flow-step pages early on. Not a defect
  unless it grows while Indexed stalls for 60+ days.
- **Discovered – currently not indexed** — Google knows the URL from the
  sitemap but hasn't fetched it yet. Expected for weeks after a 4,890-URL
  submission. Patience, not resubmission.

## 2. Exclusion reasons that are EXPECTED (do not panic)

- "Excluded by 'noindex' tag" — should list `/knowledge/search`, practice
  test study/timed/bookmarks/missed screens, `/drive`, `/navigator`, and any
  thin directory listings still below the completeness gate. All deliberate.
- "Alternate page with proper canonical tag" — paginated pages and slug
  variants consolidating correctly.
- "Page with redirect" — `/login`, `/contact`, `/dot-guide`,
  `/directory/trip-planner`, old listing slugs after regeneration.
- "Blocked by robots.txt" — `/admin`, `/api`, `/login` only.
- "Not found (404)" — retired/unknown slugs; fine in modest volume.

## 3. Exclusion reasons that indicate a PROBLEM

- **"Duplicate without user-selected canonical"** on directory state,
  corridor, exit, or location pages — file it: means Google is not accepting
  our canonicals somewhere. Screenshot the example URLs.
- **"Blocked by robots.txt" for anything outside `/admin`, `/api`, `/login`**
  — a robots regression; open a PR immediately.
- **"Excluded by noindex" for a page that should rank** (a state page, a
  corridor page, a complete listing) — the completeness gate or a metadata
  regression; file the exact URL.
- **"Soft 404" in volume** on directory pages — could indicate the empty-page
  classes documented in the audit are getting linked from somewhere; capture
  the URL list.
- **Server errors (5xx)** in more than trace amounts — capture and file.

## 4. Why internal search pages stay noindex

`/knowledge/search?q=…` produces infinite, low-value, parameterized pages.
Google explicitly recommends keeping internal search results out of the
index; indexing them dilutes crawl budget the directory needs. This is
working as designed — do not "fix" it.

## 5. Why all 4,890 URLs will not index immediately

Google budgets crawl by perceived site authority, which is still building.
Programmatic directories index over months, prioritized by internal links
and external signals. The realistic curve: core pages in days, states and
corridors in weeks, the long tail of exits/listings/flow steps over 2–6
months. Resubmitting the sitemap does not accelerate this.

## 6. High-value URLs to inspect manually first

Use **URL Inspection** (spot checks, not mass requests) on roughly this set:

- `/` , `/academy`, `/cdl-pre-school`, `/directory`, `/knowledge`
- `/academy/cdl-school-dalton-ga` (the local-intent money page)
- Two state pages you care most about: `/directory/georgia`,
  `/directory/tennessee`
- Two corridors: `/directory/i75`, `/directory/i75/truck-parking`
- One strong exit: `/directory/i75/exit-333`
- Two complete listing pages you know well
- One KC article that answers a real query

"URL is on Google" + a valid canonical = healthy. Request indexing only for
these hand-picked pages, once.

## 7. Sampling the new parking flow

Inspect one URL per step: `/directory/parking/ga` →
`/directory/parking/ga/i-75` → `/directory/parking/ga/i-75/northbound`.
Expect "Discovered/Crawled – not indexed" early; expect the direction page to
index before the picker steps (it has the content). If after ~90 days no
direction pages are indexed at all, file that.

## 8. Sampling the CAT Scale flow

Same drill: `/directory/cat-scales/near-me`, `/directory/cat-scales/tn`,
`/directory/cat-scales/tn/i-40/eastbound`. Near-me is a search tool page —
"Crawled – not indexed" is acceptable for it; the state/direction pages are
the ones that should eventually index.

## 9. Cadence

- **Weekly** (first month): glance at Indexing → Pages totals. No action.
- **Monthly**: record Indexed / Crawled-not-indexed / Discovered-not-indexed
  counts somewhere durable; inspect 3–5 sample URLs from §6–8.
- **Do NOT** resubmit the sitemap on a schedule. Resubmit only after a deploy
  that materially changes the URL set (Search Console re-reads it on its own
  anyway; the hourly revalidation keeps it fresh).
- **Do NOT** request indexing for thousands of URLs individually — it does
  nothing at scale and burns the daily quota.

## 10. What evidence justifies a code PR

Any of: a §3 exclusion on a page family (not a single stray URL); Indexed
count flat or falling for 60+ days while the site publishes; canonicals
Google reports differing from the ones we emit; robots.txt or sitemap fetch
errors in Settings → Crawl stats; a spike in 404/5xx in Crawl stats. Capture
the GSC screenshots + example URLs in the issue — the audit doc maps each
family to its owning template.

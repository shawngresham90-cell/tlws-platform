# CDL Pre-School — Old-Site Transition Plan

Scope: what to do with **https://cdl-preschool.netlify.app** after the
integrated `/cdl-pre-school` pages on truckinglifewithshawn.com go live.
**No change was made to the old Netlify project in this milestone**, per the
milestone rules. Every step below requires explicit owner approval.

## Current state (verified via the owner's Netlify account, 2026-07-13)

- Netlify site `cdl-preschool` (id `f8b60cb1-dc78-4be7-bcb9-dbb2e2f5c40d`),
  Next.js, deployed from `github.com/shawngresham90-cell/cdl-preschool@main`.
- Publicly reachable, no site password, Netlify Forms off.
- Last production deploy 2026-07-07 ("add workbooks").

## Precondition before ANY transition step

Confirm that **course access for existing buyers does not depend on old-site
URLs**. If buyers reach content at `cdl-preschool.netlify.app/...` (rather
than through Stan Store), a blanket redirect would lock them out. This is the
single open question from the access audit
(`docs/cdl-preschool-integration-audit.md` §6). Until it is answered, do
nothing.

## Options

### Option A — Permanent 301 redirect (RECOMMENDED once the precondition clears)
Add to the old site (its `netlify.toml` or `_redirects`):

```
/*  https://truckinglifewithshawn.com/cdl-pre-school  301!
```

If specific old paths deserve better targets (e.g. an old FAQ page →
`/cdl-pre-school#faq`), enumerate them above the catch-all. If any paths are
private course content, exclude them explicitly or choose Option B.

- Pros: consolidates all SEO authority onto the platform origin immediately;
  one canonical sales page; zero maintenance.
- Cons: irreversible in search engines within weeks; requires the
  precondition.

### Option B — Keep the old site temporarily, canonical to the new route
Deploy a small change to the old site setting
`<link rel="canonical" href="https://truckinglifewithshawn.com/cdl-pre-school">`
on its marketing pages (and a visible banner linking to the new page), leaving
any course/access paths untouched.

- Pros: zero risk to existing buyers; search engines migrate gradually.
- Cons: two live sites to maintain; slower SEO consolidation; banner upkeep.

### Option C — Replace the old site with a migration notice
Replace the deploy with a single static page: "CDL Pre-School now lives at
truckinglifewithshawn.com/cdl-pre-school" + link (and `meta refresh` or 301
after a grace period).

- Pros: unambiguous for humans.
- Cons: worst SEO option (soft-404 pattern); still requires the precondition.

## Recommendation

1. Owner answers the access question (§6 of the audit doc).
2. If access is Stan-Store-delivered (most likely): **Option A**, done in the
   `cdl-preschool` repo/Netlify UI, after `/cdl-pre-school` is deployed to
   production and spot-checked.
3. If any access flows through old-site URLs: **Option B** until those flows
   are migrated or documented, then Option A.
4. After 301s have been live ~30 days and Search Console shows the new URL
   indexed: optionally archive the `cdl-preschool` repo and downgrade/delete
   the Netlify site (keep the repo for history).

## Explicitly out of scope in this milestone

- No DNS, redirect, deploy, or repo change to the old site.
- No deletion of anything.

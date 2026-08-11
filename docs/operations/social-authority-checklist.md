# Social authority checklist — owner actions

The Master Blueprint flags social bios pointing away from the domain as an
authority leak. Everything below is an OWNER action on external platforms —
no code deploy involved except the two flagged items. What the repo itself
asserts today (and Google reads via `sameAs` on every page):

- YouTube: `https://www.youtube.com/@TruckingLifewithShawn`
- Facebook: `https://www.facebook.com/TruckingLifewithShawn`
- TikTok: `https://www.tiktok.com/@truckinglifewithshawn`

## 1. Resolve the TikTok handle conflict (blocking, five minutes)

The site config + footer + all schema say `@truckinglifewithshawn`; the
homepage "Featured Videos" cards deep-link videos under
`@trucking.life.with.shawn`. **One of these is wrong.** Open both URLs on a
phone:

- If the real account is `@trucking.life.with.shawn` (dotted): the footer
  link and the `sameAs` identity Google consolidates are pointing at a
  non-existent or wrong profile → tell the engineering session to update
  `src/lib/seo/site.ts` (one line).
- If the real account is `@truckinglifewithshawn` (undotted): the two
  homepage video cards are dead/wrong links → update `FeaturedVideos.tsx`
  (three lines).

Either way this is a one-line code PR once you confirm which handle is real.

## 2. Point every bio link at the domain

On each platform, the bio/profile website field should be
`https://truckinglifewithshawn.com` (or a deep page, never a third-party
hub):

- **YouTube** — channel "About" website field + the featured link on the
  banner. Video descriptions for DOT/CDL topics should link the matching
  `/knowledge/...` article or `/dot-tools`, not the old Netlify apps.
- **TikTok** — the single bio link. If it currently points at Stan, consider
  that Stan checkout links live INSIDE the site now (`/store`,
  `/cdl-pre-school`) — the domain link earns search authority and still
  converts.
- **Facebook** — page Website field + any pinned post links.
- **Stan Store** — product descriptions that mention the CDL Pre-School
  should link `https://truckinglifewithshawn.com/cdl-pre-school` (this is
  also called out in `docs/cdl-preschool-transition-plan.md` item 2).

## 3. Legacy Netlify properties (ties into the redirect plan)

Before any redirects ship, export from Netlify for each legacy site
(DOT-tools app, `cdl-preschool.netlify.app`,
`truckinglifewithshawn-website.netlify.app`):

- Analytics → top pages + referrers (who still links in)
- Any custom domain settings

That export is the evidence the redirect audit says is missing — without it,
no redirect map gets built (the repo's own migration docs make the same
call: redirects ship on the LEGACY sites as `_redirects`, reversible, and
never before the vault/course-access questions are answered).

## 4. Consistency once the handle is fixed

After #1 is resolved, the `sameAs` set in schema, the footer, and the video
cards will all agree — that agreement is what lets Google's knowledge graph
consolidate the channel, the page, and the site into one entity. Check
quarterly that new platforms (Instagram? X?) get added to
`src/lib/seo/site.ts` rather than linked ad-hoc, so schema stays the single
source of truth.

## 5. What was already fixed in code (for reference)

- Footer identity links now carry `rel="me noopener noreferrer"` +
  `target="_blank"` (identity token kept, tab-hijack risk removed).
- `/contact` now permanently redirects (was temporary), so old business
  listings pointing at it consolidate onto the site.

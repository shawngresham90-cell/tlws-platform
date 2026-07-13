# CDL Pre-School Integration — Source-Site Audit

Milestone: Integrate CDL Pre-School Into Trucking Life With Shawn
Branch: `feat/cdl-preschool-sales-integration`
Date: 2026-07-13

## 1. Source site access — blocked, not circumvented

The audit target was the fully rendered site at **https://cdl-preschool.netlify.app**.

This build environment's egress policy blocks `*.netlify.app` (and the CDN
hosting Netlify's deploy screenshots). Direct fetches of the rendered site and
the deploy screenshot both returned **HTTP 403 from the egress proxy**. The
Stan Store product page (https://stan.store/TRUCKINGLIFEWITHSHAWN/p/cdl-preschool--founding-student)
is also blocked (403). Per the milestone rules, no attempt was made to
circumvent the policy.

### What WAS verifiable through the authenticated Netlify API (owner's account)

The Netlify MCP connector (authenticated to the owner's team) exposes site and
deploy *metadata* — not page content. Verified facts about the existing site:

| Fact | Value |
| --- | --- |
| Netlify site | `cdl-preschool` (site id `f8b60cb1-dc78-4be7-bcb9-dbb2e2f5c40d`), team plan `nf_team_pro` |
| Framework | **Next.js** (`@netlify/plugin-nextjs@5.15.12`, one server function, one edge function) |
| Source repository | `github.com/shawngresham90-cell/cdl-preschool`, branch `main` |
| Latest production deploy | 2026-07-07, commit `f6a004c` titled **"add workbooks"**, 474 files scanned, state `ready` |
| Access control | **Public** — no site password, no SSO gate |
| Netlify Forms | Not enabled |
| Redirect rules | 2 (contents unknown — likely framework defaults) |
| Header rules | 1 |

Implications:

- The site is a real Next.js app with server rendering, not a static brochure.
- The commit title "add workbooks" confirms **workbooks exist** as part of the
  product, but their names and count are **not verifiable** from metadata.
- The site itself is publicly reachable (to normal visitors) and has **no
  password/login gate at the site level**. Whether course *content* is behind
  an application-level login could not be determined (see §6).

### Source repository not used

The deploy metadata identifies `shawngresham90-cell/cdl-preschool` as the
source repo. This milestone's scope is explicitly "Use only:
shawngresham90-cell/tlws-platform", so that repository was **not** read. If
the owner wants a higher-fidelity content migration, granting that repo to a
future session is the single highest-value unlock.

## 2. Content sources actually used

Only owner-supplied and in-repo content was used. No curriculum details were
invented.

1. **The milestone brief itself** (owner-supplied): offer terms ($149 Founding
   Student, first 20 verified, name on a dedicated Founding Student Wall),
   headline/supporting copy for the homepage card, CTA labels, the
   "what it is not" disclaimers, the who-it's-for list, and the FAQ list.
2. **`src/app/(marketing)/apps/page.tsx`** (in-repo, pre-existing): the only
   prior CDL Pre-School copy in the platform —
   "Permit prep the driver way — what the test actually asks, without the
   textbook fog", plus three benefit bullets (built around what the permit
   test actually asks; plain talk from a CDL instructor; study from anywhere).
3. **Academy pages** (in-repo): verified founder-credibility facts already
   published by the platform (17 years driving, zero violations, Dalton GA,
   ELDT-compliant CDL-A academy mission) — reused verbatim for the
   credibility section.
4. **Netlify deploy metadata** (above): existence of workbooks; tech facts for
   the transition plan.

## 3. Content migrated vs. omitted vs. unresolved

### Migrated (verified)
- Positioning: pre-CDL preparation before school/permit training.
- Offer: $149 Founding Student price; capacity 20 verified students; public
  name on the Founding Student Wall; no deadline (none advertised).
- Purchase URL (owner-supplied, exact):
  `https://stan.store/TRUCKINGLIFEWITHSHAWN/p/cdl-preschool--founding-student`
- Founder credibility facts already published on this platform.
- The three verified benefit bullets from `/apps`.

### Omitted
- Any section of the old site that could not be verified (testimonials,
  specific imagery, old navigation, old legal wording). Nothing unverified was
  copied, approximated, or reconstructed from memory.

### Unresolved — needs owner confirmation before the placeholders can be filled
| Item | Where it appears | Current state |
| --- | --- | --- |
| Module/lesson names, grouping, and count | Sales page "curriculum" section | Structure built; content is a clearly-labeled "curriculum being finalized" block. **No count or names are claimed.** |
| Workbook names/count | Sales page "what you get" | Mentioned only as "workbooks included" (verified by deploy commit); no count claimed. |
| Refund policy for the $149 purchase | FAQ | Marked "confirm with Stan Store checkout" — no policy invented. |
| Course access flow after purchase | FAQ + Phase 8 audit (§6) | Described only as "delivered through Stan Store after checkout" pending confirmation. |
| Testimonials | Sales page | None shown — none verifiable. |
| Old site's legal/privacy wording | — | Not reproduced; platform's existing pages govern. |

## 4. Technical differences (old site → platform rebuild)

| | Old site | Platform integration |
| --- | --- | --- |
| Stack | Standalone Next.js site on its own Netlify project | Routes inside tlws-platform (Next.js 14 App Router), same domain as the rest of the brand |
| Branding | Unverified | Platform tokens: asphalt/ink/signal-yellow/diesel-red, Anton display headings |
| Checkout | Stan Store (external) | Same — unchanged, external, no on-site payment processing |
| Founding Student Wall | Unknown/none | New, DB-backed, moderated, capacity-enforced (20) |
| SEO | Separate origin, splits authority | Consolidated under the platform origin; canonical pages + sitemap |

## 5. External dependencies

- **Stan Store** — sole checkout + (presumed) course delivery. No API
  integration exists or was added; purchase verification is manual (admin
  compares the claim email against the Stan Store order list).
- **Cloudflare Turnstile** — reused for the claim form (existing platform
  pattern).
- **Supabase** — new tables via migration 028 (committed, NOT applied).

## 6. Access-after-purchase audit (Phase 8)

Determinable now:
- Site-level: the old site is public; no Netlify password/SSO. Netlify Forms
  is off, so any forms on it post elsewhere.
- The platform never receives purchaser data from Stan Store (no webhook, no
  API) — so the platform cannot grant access automatically, and does not try.

Not determinable without the rendered site or the owner:
- Whether the old site links a login/portal, exposes course pages publicly, or
  relies on Stan Store's own content delivery/emails.

Consequences applied to the build:
- No private course URL is published anywhere in the new pages.
- The sales page says only what is verifiable: checkout happens on Stan Store,
  and access is delivered through Stan Store after purchase — with the exact
  wording flagged for owner confirmation in §3.
- No authentication was rebuilt.

**Owner follow-ups:** confirm (a) how a buyer reaches the course today
(Stan Store content area? emailed link? old site URL?), (b) the refund policy
shown at checkout, (c) module list for the curriculum section.

## 7. Recommended retirement/redirect plan (summary)

Full plan in `docs/cdl-preschool-transition-plan.md`. Recommendation:
**permanent 301 from cdl-preschool.netlify.app to
https://truckinglifewithshawn.com/cdl-pre-school** once this PR is live and the
owner confirms course access does not depend on old-site URLs. No change to
the old Netlify project was made in this milestone.

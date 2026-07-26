# Directory funnel — capability map (audited before any code changed)

What already existed, what this change adds, and what is deliberately still
missing. No new analytics vendor, cookie system, paid tool, connector,
migration, or payment path was introduced.

## Already existed — reused as-is

| Capability | Where | Reused how |
|---|---|---|
| Vendor-agnostic event dispatch | `src/lib/analytics.ts` → `trackEvent()` | Every new directory event goes through it. Silent no-op when no provider is configured, wrapped in try/catch, so analytics can never break a click. |
| Analytics provider mount | `src/components/analytics/PlausibleAnalytics.tsx` | Untouched. Enabled only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set. |
| First-touch campaign attribution | `src/components/analytics/AttributionCapture.tsx`, `leadAttribution()` | Untouched — already site-wide and already survives navigation. |
| Business inquiry API | `POST /api/sponsor-inquiry` | Both funnel paths post here. Inserts into `sponsors` (stage `contacted`) and logs an inbound `sponsor_touches` row. |
| Inquiry form | `src/components/sponsors/SponsorInquiryForm.tsx` | Extended, not replaced: keeps Turnstile, the single-use-token remount retry, accessible errors, and focus management. |
| Spam / abuse guard | `guardedPost()` → rate limit → zod → Turnstile | Unchanged; the funnel inherits all of it. |
| Sponsor CRM + admin view | `sponsors`, `sponsor_touches`, `/admin/directory/sponsors` | Where every inquiry lands. No new table. |
| Driver-side corrections intake | `/directory/submit`, `POST /api/directory/submission` | Left for drivers. Not used for claims — see the constraint below. |
| Listing view counting | `src/components/directory/ViewBeacon.tsx` → `/api/directory/view` | Untouched; still the server-side view counter. |
| Business CTA into sponsorship | `src/components/directory/GetFeaturedCta.tsx` | Still present on hub/category/parking pages. |
| Sponsored slot rendering | `SponsorSlot`, `SPONSOR_PLACEMENTS` | Untouched — the inventory this funnel sells into. |

## Added in this change

| Addition | File | Notes |
|---|---|---|
| Bounding + event contract | `src/lib/directory/funnel.ts` | Pure, no side effects. The single place URL params and event props are sanitized and length-capped. |
| Claim / featured CTAs on a listing | `src/components/directory/ListingFunnelCtas.tsx` | Two links into the existing inquiry form. Submits nothing itself. |
| Directory events | `src/components/directory/DirectoryEvents.tsx` | One listing-view event per mount, plus **one** delegated passive click listener for outbound actions. |
| Outbound click markers | detail page anchors | `data-dir-event="directions｜website｜phone"`. Markup otherwise unchanged, so nothing became a client component that was not one already. |
| Listing context on the inquiry | `SponsorInquiryForm.tsx`, `sponsors/page.tsx` | Bounded params → visible "About this listing" panel → one labelled line appended to the message. |
| Tests | `scripts/test-directory-funnel.ts` | 81 assertions. |

## Events implemented

`directory_listing_view`, `directory_directions_click`,
`directory_website_click`, `directory_phone_click`, `directory_map_interact`,
`directory_claim_interest`, `directory_featured_interest`,
`directory_inquiry_start`, `directory_inquiry_submit`,
`directory_inquiry_fail`.

Declared and ready, not yet wired to a surface:
`directory_view`, `directory_category_view` (via `DirectorySurfaceEvent`),
`directory_search`, `directory_filter`.

### Payload rules

Only bounded, non-personal context: `listing_id`, `slug`, `category`, `state`,
`corridor`, `surface`, `action`, `interest`, and a failure `reason`. **Never**
an email, phone number, message body, address, credential, or the business
name as typed — the name is reduced to the same slug the URL already exposes.
Enforced by `listingEventProps()` and asserted in the tests.

## Not done, and why

| Gap | Reason |
|---|---|
| A dedicated `claim` submission kind | `location_submissions.kind` is CHECK-constrained to `new｜correction｜closure｜missing-info｜amenity-change`. Adding `claim` needs a **migration**, which this milestone forbids. Claims therefore reuse the sponsor pipeline, where `tier_interest` is free text and needs no schema change. |
| Storing the listing id as a column on `sponsors` | Same reason — no `location_id` column exists and adding one is a migration. The listing rides in the CRM note instead, in a labelled line the sender can see before sending. |
| Search / filter / map-interaction events | Those live in `DirectoryBrowser` / map components; instrumenting them is a larger client-side change and was left out to keep this PR reviewable. Event names are already reserved. |
| Real audience numbers in outreach copy | No analytics history exists yet — these events ship in this PR. Quoting traffic would be inventing it. |
| Any price, payment, or auto-claim | Explicitly out of scope; all flagged for Shawn's approval in `LAUNCH-TOP-25.md`. |

## Privacy and consent

No cookie is set, no identifier is minted, and no personal field is sent to
analytics. `trackEvent` only forwards to a provider the site already loads and
is a no-op otherwise, so with `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` unset the whole
funnel emits nothing at all. The inquiry form's existing consent language ("if
you share a phone number, we use it only to reply to this inquiry, not for
automated text messages") is unchanged.

## Honesty guardrails enforced by tests

The CTA and form copy are asserted to contain no price, no "guarantee", no
"more leads", no "top of search", and no "verified owner" claim; the CTA must
state that no payment is collected and that review happens before anything
changes. A failed submit fires `directory_inquiry_fail`, never
`directory_inquiry_submit`.

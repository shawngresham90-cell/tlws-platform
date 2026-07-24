# YouTube Funnel — `/go` Tracked Short Links

Say-on-camera short links for video descriptions and pinned comments.
`truckinglifewithshawn.com/go/<slug>` 302-redirects to the real page with
YouTube UTM parameters attached, so arrivals from the channel segment cleanly
in analytics (Top Sources → `youtube`, campaign = the slug).

## How it works

- Allowlist only — `src/lib/go-links.ts`. A slug that isn't in the list
  redirects to the homepage (never a 404, never off-site).
- Every destination is an **internal, confirmed-live route**. There are no
  external/affiliate targets, no open redirects, no personal data in URLs,
  and no database writes.
- Each redirect appends `utm_source=youtube`, `utm_medium=video`, and
  `utm_campaign=<slug>`. Existing destination query params and hashes are
  preserved.

## Slug table

| Say this on camera | Redirects to |
|---|---|
| `/go/cdl-pre-school` (or `/go/preschool`) | `/cdl-pre-school` |
| `/go/academy` | `/academy` |
| `/go/apply` | `/academy/apply` |
| `/go/practice-test` (or `/go/tests`) | `/practice-tests` |
| `/go/directory` | `/directory` |
| `/go/trip-planner` (or `/go/trip`) | `/trip-planner` |
| `/go/truck-parking` (or `/go/parking`) | `/directory/parking` |
| `/go/books` | `/books` |
| `/go/store` | `/store` |
| `/go/sponsors` (or `/go/sponsor`) | `/sponsors` |
| `/go/founders` | `/founders` |
| `/go/knowledge` | `/knowledge` |
| `/go/dot-tools` | `/dot-tools` (informational landing) |

## Adding a slug

1. Add `'<slug>': '/internal/route'` to `GO_LINKS` — the route must already
   exist and be live (the internal-link crawl will catch a typo).
2. Add a row to `scripts/test-go-links.ts` if it needs bespoke coverage (the
   suite already checks every allowlist entry generically).
3. Never point a slug at an external URL — this file is internal-only by
   design.

## Reading the results

In Plausible (when enabled), filter Top Sources by `youtube` and break down
by UTM campaign to see which video is driving which destination. No analytics
is activated by this feature itself.

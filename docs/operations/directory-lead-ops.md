# Directory monetization + lead operations (PR B)

Recovered, low-risk lead-path work from stale PR #162, rebuilt against
current main. All read-only or additive; no migrations, no production writes,
no `/api/lead` change.

## What shipped

1. **Directory "Get featured" CTA** (`GetFeaturedCta`) — a single quiet line on
   every major directory surface (hub, category, state, corridor, parking,
   top-truck-stops, corridor truck-parking, listing detail) that deep-links to
   the existing sponsor inquiry form with the interest preselected
   (`/sponsors?interest=directory-placement#inquire`). No pricing, no promise
   of placement/traffic/leads/ranking, never in a driver-safety control, never
   dressed up as a listing. Organic ranking and Trip Planner safety ranking are
   untouched; sponsored placements stay clearly labeled (existing behavior).

2. **Sponsor inquiry message in the CRM** — `/admin/sponsors` now shows the
   message the prospect submitted (stored in `sponsors.notes`, previously
   collected but never read). Read-only, React-escaped, wraps long text.

3. **Read-only `/admin/leads`** — the existing `leads` table, server-gated by
   `requireAdmin()`, `force-dynamic` + noindex. Shows date, email, first name,
   source, inferred segment, UTM campaign summary, and SMS-consent status, with
   per-segment counts for ready-made send lists. **No sends, exports, edits,
   deletes, or mutations.** Phone is omitted (not operationally necessary).

## Known limitation — surface-source persistence (deferred)

The `sponsors` table has **no source/surface column**, and this block forbids
new columns / migrations / API-semantic changes. So the originating directory
surface is passed on the CTA URL as a bounded `from=<surface>` param for
**analytics only** (visible to Plausible when enabled) and is **not persisted
to the CRM**. Persisting per-surface attribution would need a small migration
(add `sponsors.source` + thread it through `/api/sponsor-inquiry`) — deferred
for a dedicated, reviewed change. The inquiry form ignores `from`.

## Deferred — `/api/lead` first-touch attribution (NOT in this block)

PR #162 also changed `/api/lead` to first-touch attribution and made
`sms_consent` optional. That alters **lead upsert and consent semantics**,
which this work block explicitly excludes. **Not ported.** The read-only
`/admin/leads` view and the segment taxonomy (`src/lib/leads/funnel.ts`) are
display-only and do not depend on it. Revisit under a dedicated review.

## Rollback

Every change is additive and reversible: remove the `GetFeaturedCta` usages,
the `notes`/leads columns from the two admin readers, the `/admin/leads` page
+ nav entry, and the `defaultInterest` prop. No data migration to undo.

# Most-Viewed — Privacy & Abuse Design (Milestone 25)

This documents the privacy posture of the directory's "most-viewed" foundation.
The foundation is built; **public most-viewed rankings are intentionally NOT
enabled** and will not be until there is enough real, clean data and a
deliberate decision to surface them.

## What is collected

- **Only** an aggregate counter: `directory_view_daily(location_id, day, views)`.
- One row per listing per **UTC day**, incremented atomically.

## What is NOT collected — by design

- No IP addresses. (The ingestion route uses the client IP **transiently, in
  memory, for rate limiting only** — it is never written to the database and
  never logged.)
- No user agent, referrer, device, or account identifier.
- No precise or coarse geolocation.
- No cookies, no `localStorage` identifiers, no fingerprinting.
- No third-party analytics or trackers of any kind.
- No per-user, per-session, or per-request rows — there is nothing to join back
  to a person.

## How a view is recorded

1. A client-only `ViewBeacon` (no JS bots → no count) sends `{ id }` — just the
   listing UUID — to `POST /api/directory/view`, once per session per listing
   (`sessionStorage` guard).
2. The route enforces **same-origin**, validates the UUID, and applies
   **per-IP (20/min) + global (2000/min) in-memory rate limits** before any
   write. Floods and obvious bots are dropped.
3. On success it calls the `record_directory_view(uuid)` `SECURITY DEFINER`
   function, which upserts today's counter. Nothing identifying is stored.

## Access & exposure

- Counts are **admin-only**. Migration 025 grants the public roles **no**
  read access (`revoke all ... from anon, authenticated`); there are no RLS
  read policies. Reporting lives at `/admin/directory/popular`.
- No public "Most Viewed" ranking ships in this milestone. Enabling one later
  is a separate, explicit decision — not automatic — and would require
  reviewing whether the data is sufficient and non-manipulable first.

## Deployment state

- Migration `025_directory_view_events.sql` is **committed but NOT applied**.
  Until it is applied, the ingestion route and admin report both **fail soft**:
  nothing is written and the report shows an empty/"not enabled" state.

## Why this is not "invasive tracking"

There is no identity, no cross-site data, no profile, and no way to reconstruct
who viewed what. The system can answer only "roughly how many times was this
listing viewed on this day," in aggregate — the minimum needed to one day rank
popular listings honestly, and nothing more.

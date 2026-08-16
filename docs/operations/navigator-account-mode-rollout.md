# Navigator Account Mode — Rollout, Rollback, and What Is Actually Guaranteed

**Operations document. Written alongside the sync wiring, the server-side
endpoint gate and the centralized usage guard.**

> ## Production is on `pilot`. Nothing in this document changes that.
>
> `NAVIGATOR_ACCESS_MODE` is unset or `pilot` in production and stays that way.
> `account` is enabled nowhere. `public` is merged code that must not be
> enabled or tested in production — see `navigator-public-beta-cost-audit.md`.
> No production environment variable was changed by this work, no migration was
> applied, and no Supabase setting was touched.

---

## 1. What the four access modes do

| Mode | Who gets in | Metered endpoints | Usage guard |
|---|---|---|---|
| `closed` | nobody; surfaces answer 404 | 404 | inert |
| `pilot` | passcode holders | passcode cookie, server-verified | **inert** |
| `public` | anyone | nobody is refused | **enforced** |
| `account` | verified email accounts | Supabase session, server-verified | **enforced** |

Anything unrecognized — unset, mistyped, a value from a deploy context nobody
configured — resolves to `pilot`. That fallback is deliberate and is the
rollback path: every failure that can reach the resolver is indistinguishable
from the others, and the only safe reading of "I do not know what mode this is"
is the closed-ish one.

### Why the guard is inert in `pilot`

This is the one asymmetry worth defending, because it looks like a gap.

Production runs `pilot`. Making the guard fail closed there would give the live
pilot a brand-new way to fail: a Supabase hiccup, an unapplied migration, or a
missing environment variable would stop a real driver getting a real route, in
a cab, at a truck stop. The bounded-spend benefit would be small, because
`pilot` access is already bounded by a passcode held by a handful of known
drivers — a tighter bound than any counter.

`account` and `public` are the modes where someone the operator has never met
can reach a metered endpoint. Those are the ones that need a counter.

---

## 2. Rollback to `pilot`

**One environment variable. No rebuild, no revert, no deploy of a different
artifact.**

```
NAVIGATOR_ACCESS_MODE=pilot
```

Unsetting the variable entirely has exactly the same effect, because `pilot` is
what an unset value resolves to. The variable is read at **runtime** and carries
no `NEXT_PUBLIC_` prefix, so Next cannot inline it into a client bundle and
changing it does not require rebuilding.

What comes back immediately:

- the passcode screen at `/navigator/access`, its throttle, and its cookie —
  all untouched by this work
- the metered endpoints refusing anonymous callers with
  `pilot-access-required`, in the same words as before
- the usage guard going inert, so no Supabase dependency stands in front of a
  driver

What a driver loses: cloud sync. Their **device records are untouched** — the
truck, the preferences, the clocks and the briefing state all live in local
storage and are read from there first in every mode. A driver who was mid-trip
when the mode changed is not interrupted.

**The pilot rollback path is not removed, reduced, or routed around by anything
in this change.** It is asserted by `test-navigator-metered-endpoints`
(section 6) and by the access-mode suite.

---

## 3. Readiness checklist — all of it, not a majority

`account` mode must stay off until every line is done.

- [x] **1. Sync wiring complete and tested.** The four domains — truck, route
      preferences, driver-entered HOS clocks, onboarding state — are wired into
      the real `DrivingScreen` save and restore paths and proved against the
      mounted component (`test-navigator-account-sync`, 64 assertions).
- [x] **2. Every metered endpoint verifies the session server-side.** Both
      handlers go through one shared gate that calls `getUser()` before any
      limiter token, budget reservation or configuration probe
      (`test-navigator-metered-endpoints`, 86 assertions).
- [x] **3. Centralized atomic usage guard built.** Migration `051`, a Postgres
      reservation function, per-user and global monthly ceilings, endpoint
      weights, fail-closed behaviour and admin reporting
      (`test-navigator-usage-guard`, 137 assertions).
- [ ] **4. Custom SMTP and an authenticated sender domain confirmed.** Not
      verifiable from the build environment — the Supabase management tools
      available there expose no auth/SMTP settings and the network policy blocks
      direct API calls. **Owner action.**
- [ ] **5. Migrations `049`, `050` and `051` reviewed and applied, in that
      order.** None has been applied anywhere. None is syntax-validated against
      a live server.
- [ ] **6. Terms and Privacy updated.** There is still no Terms of Service page;
      the signup checkbox accepts the Privacy Policy only and
      `terms_accepted_at` stays null. The Privacy Policy still does not describe
      accounts. **Owner action** — no wording has been drafted.
- [ ] **7. Budget configuration set** (section 4 below). Until it is, account
      mode refuses every metered request — which is the intended fail-closed
      behaviour, not a bug to work around.
- [ ] **8. Real-phone tests pass** (section 6).
- [ ] **9. Provider alerts configured and enforcement question answered**
      (section 5). **Owner action.**

---

## 4. Budget configuration

Three variables. **Account mode refuses every metered request until all three
are set and coherent** — missing budget configuration fails closed.

| Variable | Meaning |
|---|---|
| `NAVIGATOR_PROVIDER_MONTHLY_ALLOWANCE` | The contracted monthly allowance. Reporting and the sanity check. |
| `NAVIGATOR_PROVIDER_MONTHLY_THRESHOLD` | The number actually enforced. **Must be strictly below the allowance.** |
| `NAVIGATOR_PROVIDER_USER_MONTHLY_LIMIT` | Per-driver monthly ceiling. |

Optional: `NAVIGATOR_PROVIDER_WEIGHT_ROUTE`, `NAVIGATOR_PROVIDER_WEIGHT_SEARCH`
(default `1` each).

A threshold **equal to** the allowance is rejected as a configuration error, not
accepted as a strict setting. Equal means zero margin, and the margin is the
entire reason there are two numbers: it is the room to notice and react before
the allowance is gone rather than after.

Usage is visible at **`/admin/navigator/usage`** (and as JSON at
`/admin/navigator/usage/json`), by month and by endpoint. Both authenticate
themselves; the route handler does not rely on the dashboard layout, because
route handlers are not wrapped by it.

### What the counter is, and what it is not

**It is not a mirror of HERE's billing and must never be described as one.**

1. **Two products, one unit.** Truck routing and Discover search bill against
   different HERE products with different quotas — and the cost audit records
   the search quota as *undocumented*. Summing them into one "units" figure is
   an aggregation this repository invented. It has no counterpart on an invoice.
2. **It counts requests we may not have made.** The reservation happens *before*
   the provider call. A cache hit, a timeout, a request the provider rejected —
   each still consumed a unit.
3. **HERE may count differently.** Whether one routing request with a truck
   profile is one transaction or several is a contract detail this repository
   cannot read.

The honest description, and the one the admin page prints next to the number:
**a conservative upper bound on requests that could have billed.** It should
over-count, never under-count. That is why reservations are never refunded — on
a partial failure we do not know whether the provider counted the request, and
refunding would mean under-counting exactly during an incident, which is the
worst possible moment to start under-reporting.

**This accounting has not been reconciled against a HERE invoice.** Until it
has, treat the figure as directional and keep the threshold below the
contracted allowance.

---

## 4a. The live-database test

`npm test` is hermetic — no network, no database, CI-safe — and three things
about migrations 049–051 cannot be proved that way: that the SQL executes at
all, that two callers racing the last unit cannot both have it, and that RLS
actually refuses a cross-user read rather than merely being written as though
it would.

```
NAVIGATOR_TEST_DATABASE_URL='postgresql://…' npm run test:db
```

**It skips cleanly** — prints why, exits 0 — when the URL is unset, `psql` is
absent, or the server does not answer. A skip reports as SKIPPED, never as a
pass: absent evidence is recorded as absent.

**It refuses to touch anything live.** The connection URL is checked against
the known project refs *before any connection is opened*, and the target is
then rejected if `sms_consents`, `leads` or `navigator_profiles` holds rows.
The script drops and recreates tables; both rails must pass first.

### Results — 2026-08-16, PostgreSQL 16.13, **75 passed, 0 failed**

| What | Result |
|---|---|
| 049, 050, 051 execute in order | ✅ all three |
| Re-applied a second time (idempotency) | ✅ all three no-op cleanly |
| **Global threshold under real concurrency** | 24 parallel backends, **600 attempts → exactly 100 accepted**, month row 100 |
| **Per-user limit under real concurrency** | 16 parallel backends, **160 attempts → exactly 15 accepted** |
| Refused-global undo | per-user units and request count left untouched |
| Endpoint weights | a weight of 7 consumes 7 units and 1 request; a weight that would cross the ceiling is refused whole |
| Month rollover | August exhausted, September allows from zero; `2026-13` rejected by the check constraint |
| Limit-reached / invalid input | zero units, unknown endpoint and a zero threshold all refuse and write nothing |
| RLS and cross-user isolation | each driver sees only their own row; insert-for-another and re-owning on update both refused |
| Anonymous access | `anon` cannot read `navigator_state` or `navigator_profiles` at all, and cannot execute the reservation function |
| Ledger access | neither `anon` nor `authenticated` can read the usage tables or the admin view directly |
| No PII in usage records | read off the live catalog: no email, phone, name, position, destination, search, route, movement, IP or user-agent column; `user_id` appears only on the per-user table |
| Location-shaped sync domain | refused by the `navigator_state.domain` check constraint |
| Cleanup | all fixtures removed; ledger and state tables empty |

### The negative control

A test that cannot fail proves nothing, so the atomic reservation was replaced
with the naive read-then-write it exists to avoid and the same race re-run:

| Implementation | Attempts | Accepted | Month row | Threshold |
|---|---|---|---|---|
| Read-then-write (mutant) | 600 | **120** | **120** | 100 — **overshoot** |
| Shipped `UPDATE … WHERE units + n <= threshold` | 600 | **100** | **100** | 100 — exact |

The mutant overshoots by 20% under the same load the shipped function holds
exactly. The race is real, the test detects it, and the shipped SQL is on the
right side of it.

### What this run does NOT establish

It ran against **PostgreSQL 16.13 in a throwaway local cluster**, not a
Supabase test project. Stock PostgreSQL has no `auth` schema and none of the
Supabase roles, so `scripts/sql/supabase-shim.sql` creates a minimal stand-in
first — the roles, `auth.users`, Supabase's own `auth.uid()` definition,
`tlws_set_updated_at()`, and Supabase's default table grants. The shim is
applied **only** when `auth.users` is absent, which on any real Supabase
project it never is.

So the SQL, the concurrency, the grants and the policy behaviour are proved on
a real server. What remains unproved is that the real project's managed `auth`
schema behaves identically, and anything at the PostgREST layer. Supabase runs
PostgreSQL 17; this was 16. Row-locking semantics under READ COMMITTED are the
same across both, but the run is not a substitute for gate 5 below — **applying
049–051 to a disposable Supabase test project is still outstanding.**

---

## 5. HERE: alerts are not a spending cap

**Do not describe HERE dashboard notifications as a hard cutoff.** An alert
notifies; it does not refuse requests. Writing it up as a ceiling would put a
false backstop in the record — exactly the kind that gets relied on.

Owner actions:

1. **Configure usage alerts** in the HERE dashboard, below the threshold
   configured above, so the warning arrives before the guard starts refusing.
2. **Ask HERE directly** whether the plan supports an **enforceable
   account-level quota** that refuses requests past a limit.

Until HERE confirms enforcement in writing, **the centralized guard in migration
`051` is the only thing that actually stops spend**, and it should be described
that way — including its own limits above.

---

## 6. Real-phone checklist

Items 4–6 were blocked on sync and are now runnable; nothing here has been run,
because it needs a phone, applied migrations and working SMTP.

- [ ] 1. New signup and OTP delivery
- [ ] 2. Returning login
- [ ] 3. Reload without signing in again
- [ ] 4. Truck and preferences restored
- [ ] 5. Sign in on a second device and verify restoration
- [ ] 6. Offline save, then synchronization on reconnect
- [ ] 7. Stationary GPS loss under cover
- [ ] 8. Actual movement safety lock
- [ ] 9. Marketing refusal still grants Navigator access
- [ ] 10. Consent withdrawal removes the driver from the next Stan CSV
- [ ] 11. Account deletion removes the profile, saved state and usage rows

---

## 7. What syncs, and what may never

**Synced — four records, and this is the whole list:**

| Domain | What it holds |
|---|---|
| `truck` | dimensions, weight, axles, hazmat class, avoidances, confirmation |
| `route_prefs` | avoid tolls, avoid ferries |
| `hos_clocks` | four integers the driver typed, and when they typed them |
| `onboarding` | whether the briefing has been read |

**Never synced, never stored server-side at all:** position, position history,
destination, search text, route, geometry, turn-by-turn record, movement,
provider response.

That list is enforced in three independent places: a `check` constraint on
`navigator_state.domain` (widening it takes a reviewed migration, which is where
someone gets to ask whether the new domain is a location), the four-domain map
in the client, and a test that drives the real screen and then inspects every
byte that crossed the wire.

**Local storage is always the immediate source.** Every save writes to the
device first and returns; the cloud write is debounced and happens off that
path. A cloud failure cannot delay a save, cannot surface an error on the
driving surface, and cannot stand between a driver and Start —
`syncFailureBlocksDriving()` returns `false` and is named so that changing this
means arguing with a function rather than with a comment.

---

## 8. Conflict resolution

Newer wins, **per domain**, and a tie changes nothing.

Per domain rather than per driver, because the four records are edited
independently: a driver who adjusts clocks on a phone and a truck on a tablet
has newer copies of different things in different places, and a whole-account
"last device wins" would throw one of them away.

An upload is re-checked against the server row **immediately before writing**,
not only when the driver stopped typing — a debounce means seconds pass, and
another device may have written in the gap.

A record that predates this build carries no write time. It is treated as the
**oldest** thing in existence, not the newest. If the account is empty it still
uploads (the timestamp is not consulted when there is nothing to compare
against); if the account holds a copy, that copy wins. Claiming `now` for an
undated record would let a stale device silently overwrite an account set up on
another phone — the exact failure the conflict rule exists to prevent, firing
once per driver, invisibly, at upgrade.

**A restored truck is re-checked, not trusted.** The confirmation fingerprint
must still match the restored values or the truck comes back *unconfirmed* and
Start stays disabled. Restoring a truck must never restore permission to route
for a truck nobody checked.

# Navigator Pilot — Adversarial Probe, 2026-08-10

A live probe of the pilot gate, run against real production builds of
`origin/main` (`b6a1260`) served on localhost. **No production system was
touched.** Placeholder Supabase values were used because the middleware
constructs a Supabase client on every request; they point at an invalid host
and reach nothing.

This is the record. The behaviours worth keeping are pinned by
`scripts/test-navigator-adversarial.ts` and
`scripts/test-navigator-pilot-access.ts`, which run offline in every test
pass.

---

## 1. The gate holds

### Flag and configuration states

| Request | flag **unset** | flag on, **no password** | flag on, password, **no cookie** |
|---|---|---|---|
| `GET /` | `200` | `200` | `200` |
| `GET /drive` | **`404`** | `307` → `/navigator/access?next=%2Fdrive` | `307` → access |
| `GET /navigator` | **`404`** | `307` → access | `307` → access |
| `GET /navigator/access` | `200` | `200` | `200` |
| `POST /api/navigator/route` | **`404`** `not-enabled` | **`401`** `pilot-access-required` | **`401`** |
| `GET /api/navigator/destination-search` | **`404`** `not-enabled` | **`401`** | **`401`** |

**A misconfigured deploy fails closed.** Flag on with no password: the pages
redirect to a screen that can never succeed, and both APIs answer 401. It
does not fall open.

**`/navigator/access` stays reachable in every state.** By design — gating
the password screen behind the password would loop forever — but note the
consequence: **feature-disabling Navigator does not hide that a pilot
exists.** If concealment is the goal, the flag is not the tool.

### Cookie forgery, tampering, expiry

A valid token was minted locally and eleven malformed variants presented to
a Navigator API:

| Presented | Result |
|---|---|
| Forged MAC (64 zeroes) | `401` |
| MAC signed with a different password | `401` |
| Valid MAC with a tampered `issuedAt` | `401` |
| Correctly signed, 13 hours old (limit 12) | `401` |
| Correctly signed, 10 minutes in the future | `401` |
| `v2.` version prefix | `401` |
| No dots / four parts / non-numeric `issuedAt` / empty | `401` (all) |
| Percent-encoded RTL-override characters | `401` |
| 20,000 characters | `431` — refused before the app saw it |
| **Correctly signed and current** | **`200` on `/drive`** |

### Redirect handling

`sanitizeNextPath` collapses every hostile `?next=` value to `/drive`:
absolute URLs, protocol-relative `//evil.example`, the backslash trick,
`javascript:`, `data:`, unrelated internal paths, API paths, and the access
page itself. Pinned by test rather than by this probe, because the value is
consumed by a server action rather than by a URL.

### Leakage

Neither the homepage nor the access page contained the password or any
secret-shaped value.

---

## 2. What the probe found — one real defect

### The pilot password had no rate limit

Every other Navigator surface is throttled: the route endpoint allows six
requests an hour per IP, destination search thirty a minute. **The password
form — the single control between the open internet and truck guidance, and
between the open internet and provider spend — accepted unlimited attempts
at whatever rate the server would take them.**

The comparison itself is constant-time, so the password does not leak
through timing. That defends against a subtle attack while leaving the
obvious one wide open: a shared static secret with no lockout, no throttle
and no delay is guessable at line rate, and nothing anywhere would have
noticed it happening.

**Fixed in this PR.** Eight attempts in a burst, one earned back every
ninety seconds, per IP.

Three design points, each pinned by test:

1. **The token is spent BEFORE the password is compared.** A correct
   submission costs the same as a wrong one, so the presence of throttling
   can never answer *"was that guess right?"*.
2. **Per-IP buckets, no global cap.** A global ceiling would be better
   against a distributed attack and much worse for the pilot: anyone could
   exhaust it and lock out the two or three drivers who need in. Turning a
   brute-force attempt into a denial of service against the people driving
   is the wrong trade.
3. **The bucket key is the LAST `x-forwarded-for` hop**, the one the edge
   proxy appended. Keying on the first would let an attacker mint a fresh
   bucket per attempt by changing a header.

**Known limitation, stated rather than implied:** the bucket store is
in-memory, so on serverless the cap is per warm instance, not global — the
same limitation the existing limiters already document. This is a large
improvement on unlimited and it is not a complete defence. **The complete
defence is a long password**, which is an operational decision: use a long
random one for the pilot, and rotate it before any outside driver sees it.

---

## 3. What the probe could NOT establish

**Input validation on the API endpoints was not exercised live.** With no
`HERE_API_KEY` in the drill environment, both endpoints answer
`503 provider-not-configured` *before* validation runs — the configuration
check is deliberately ordered ahead of it so a keyless deploy says so
plainly instead of looking like an empty result. Query length, coordinate
range and body shape are covered by the offline destination-search and
route-API harnesses instead.

Do not read the 503 rows in any probe transcript as a validation pass.

**The unlock action itself was not driven end to end.** It is a Next server
action, not a plain form POST, so exercising it over `curl` is not
meaningful. The throttle is proven by unit tests against the same limiter
and the same constants, plus a structural check that the throttle call
precedes the password comparison in the action's source.

---

## 4. Offline coverage added alongside

`scripts/test-navigator-adversarial.ts` feeds the same twenty hostile
strings — newlines, carriage returns, control characters, RTL overrides,
zero-width joiners, a BOM, script tags, SQL, path traversal, template
injection, URLs, coordinates, an API-key-shaped run, emoji, 100,000
characters, whitespace, and empty — into every driver-facing input:

| Surface | Rule enforced |
|---|---|
| First name | Refused or cleaned; never a line break; never over the cap; rejection describes nothing about the expected value |
| Problem-report note | Capped and collapsed; **never carries a line break**, because one would forge a section header in the plain-text report it is pasted into |
| Truck profile | Rejected without exposing internals; a legal profile still validates clean |
| Build metadata | Cannot become a sha, a channel or a timestamp; a mis-set secret renders as `unknown` |
| `?next=` | Always collapses to a Navigator path; never absolute, never protocol-relative |
| Report scrubber | Coordinates and secret-shaped values redacted; a route mile is not mistaken for a coordinate |

Plus the ordering claims both API endpoints depend on: the flag is checked
first, authorization before the provider key is read, and **an unauthorized
caller cannot even spend a limiter token**.

---

## 5. Recommended operational follow-ups

| # | Action | Why |
|---|---|---|
| 1 | **Rotate the pilot password before any outside driver sees it**, to something long and random | The throttle bounds guessing; length is what makes bounded guessing pointless |
| 2 | Give each driver the password directly, not in a group thread | It is a shared secret with no per-driver revocation — the only revocation is rotating it for everyone |
| 3 | Answer the open question from the rollback doc: does changing the password in Netlify take effect without a redeploy? | It is the fastest access stop in the system and the answer is not knowable from this repository |
| 4 | Treat any unauthorized access as `unauthorized-navigator-access` — a P0 | See the stop policy |

# Navigator Public Beta — Cost and Abuse Audit

**Every geocoding, search, routing and map request the Navigator can make,
audited against one question: what happens when the passcode is no longer
standing in front of them?**

The short answer is in the next section. The rest is the evidence.

No dollar amounts appear here. Pricing is a contract term that changes
without notice and is not readable from this repository; a number invented
here would be quoted back later as if it had been checked. The same rule
`navigator-provider-volume.md` follows.

---

## The verdict

**The code is ready for `public`. The provider budget is not.**

Nine of the ten things worth checking pass, several of them comfortably.
The one that does not is the one that decides:

> **There is no ceiling on total provider spend that survives a serverless
> host running more than one instance.** Every limiter in this repository —
> the per-IP ones, the routing adapter's free-tier guard, and the
> all-callers ceiling added by this change — keeps its counters in the
> memory of a single process. The effective global ceiling is therefore
> *that number × however many instances the platform decided to run*, which
> is not a number this code can read, cap, or even observe.

Under the passcode this was theoretical: you had to know the password to
reach an endpoint at all, and the people who did were two or three drivers.
Remove the passcode and it is the whole exposure.

**So `NAVIGATOR_ACCESS_MODE` must not be set to `public` yet.** What has to
be true first is listed under [What would unblock this](#what-would-unblock-this).
Everything else in this change — the three modes, the fallback, the
public-beta surface, the tests — is safe to merge and changes nothing while
the mode stays `pilot`.

---

## What was audited

Four request families. Every one of them, not a sample.

| | Provider | Where the key lives | Metered |
|---|---|---|---|
| **Truck routing** | HERE Routing v8 | `HERE_API_KEY`, server-side | Yes |
| **Destination search** | HERE Discover (Geocoding & Search v7) | `HERE_API_KEY`, server-side | Yes |
| **Map tiles** | OpenStreetMap raster | No key exists | No — but see below |
| **Reverse geocoding** | *None. There is no such call.* | — | — |

---

## The ten checks

### 1. Secrets are server-side ✅

`HERE_API_KEY` and `NAVIGATOR_PREVIEW_PASSWORD` carry no `NEXT_PUBLIC_`
prefix, so Next cannot inline them into a client bundle even by accident.
Both are read only in route handlers and server components. A test in
`scripts/test-navigator-access-modes.ts` scans every file under
`src/components` and `src/lib/navigator` for `process.env.<SECRET>` and
fails the build on a hit.

The full set of `NEXT_PUBLIC_` variables the app reads is:
`BUILD_COMMIT`, `BUILD_CONTEXT`, `BUILD_TIME`, `NAVIGATOR_ENABLED`,
`PLAUSIBLE_DOMAIN`, `SITE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`,
`TPC_PLANNER_ENABLED`, `TURNSTILE_SITE_KEY`. None is a routing credential.

### 2. Browser keys are narrowly restricted ✅ — by not existing

There is no browser-held routing, geocoding or map key to restrict. The map
is OpenStreetMap raster tiles, which take no key at all
(`src/lib/navigator/map-style.ts`). Satellite ships deliberately disabled
with its reason attached, precisely because every satellite basemap worth
using is licensed, keyed and metered.

This is the strongest finding in the audit: the usual public-beta disaster —
a Maps key in the bundle with no HTTP-referrer restriction — cannot happen
here, because there is no key in the bundle.

### 3. Route and search inputs are validated ✅

| Input | Bound |
|---|---|
| Coordinates | `lat` ±90, `lng` ±180, must be finite |
| Waypoints | `NAVIGATOR_MAX_WAYPOINTS`, and duplicates of an endpoint rejected |
| Avoidances | Enum-checked, max 5 |
| Search query | `MIN_SEARCH_LENGTH` … `MAX_SEARCH_LENGTH` |
| Country | Allowlisted to `USA` / `CAN` — never forwarded raw into `in=countryCode:` |
| Truck profile | Validated before any transaction is spent; an impossible truck causes no provider call |
| Tank / mpg / safety factor | Positive, capped |

### 4. Request sizes, waypoint counts and timeouts are bounded ✅

Body cap 512 KB, checked twice — once against the declared `content-length`
before reading, once in real bytes after. Both provider fetches carry
`AbortSignal.timeout(5000)`. The routing adapter does not retry on 4xx,
because a request or auth failure will not fix itself and retrying only
spends quota.

### 5. Automated abuse cannot create unlimited routing requests ⚠️ **PARTIAL**

This is the finding.

**Before this change**, the only rails were per-IP:

| Endpoint | Per-IP rail |
|---|---|
| `/api/navigator/route` | 6 / hour |
| `/api/navigator/destination-search` | 30 / minute |

A per-IP limiter bounds a rude visitor. It does nothing against a script: a
caller with a thousand addresses gets a thousand buckets and every one of
them is full. Worse, the client IP is derived from a header
(`x-nf-client-connection-ip`, falling back to the last `x-forwarded-for`
hop) — correct, and still only as good as one hop of edge proxy.

**This change adds** `src/lib/navigator-api/public-budget.ts`: an
all-callers ceiling, consulted only in `public` mode, that counts every
request together regardless of source address — 40 routes/hour and 400
searches/hour per process, spent *before* any provider work happens. That
converts "unbounded per address" into "bounded per process regardless of
address," which is a large improvement.

**It is still not a global cap.** The store is in-memory. On a serverless
host the real ceiling is `40 × instances`, and nothing in this repository
knows what `instances` is. That is the blocker.

Note also that search is the sharper edge of the two: routing sits behind
the adapter's own free-tier guard (100 live calls/hour/instance) *and* a
response cache, while search has neither. Search goes straight to the
provider on every miss.

### 6. Excess traffic receives a clear rate-limit response ✅

429 with a machine code and a sentence written for a driver, not a
developer: *"The Navigator public beta has reached its hourly limit for
this server. Nothing is wrong with your truck or your route — try again
shortly."* The per-IP limiters keep their existing 429s. `closed` answers
404 rather than 403, so a scanner learns nothing from probing.

### 7. Logs do not store unnecessary precise-location history ✅

Strongly so, and it predates this change.

- The pilot event schema is an **allowlist**, not a redaction pass: there is
  no field for a coordinate, a road name, a provider string or a driver
  name. There is nowhere to put one.
- Timestamps are **relative to session start**. A route plus a wall clock is
  a location even with no coordinate in it.
- Every free-text detail that does get stored passes through
  `redactCoordinates()`, which replaces anything shaped like a signed number
  with 4+ decimal places.
- Nothing is persisted at all. The event stream ships as a schema, a port
  and an in-memory implementation, wired to no store.

### 8. Provider quotas and failure responses are documented ✅ / ⚠️

`navigator-provider-volume.md` is a tested model — `scripts/test-navigator-provider-volume.ts`
fails the build if the caps it quotes drift from the code. It documents
**5,000 truck transactions/month** as the free allowance and says plainly:

> **The search-product quota.** The 5,000/month figure the adapter documents
> is for truck transactions. Destination search uses a different product
> with a quota this repository does not record.

**That gap is now load-bearing.** Under a passcode, an undocumented search
quota was a footnote. In public beta, search is the endpoint with no cache,
no adapter cap, and the higher call rate.

### 9. Public mode does not change truck routing ✅

The access mode is read in exactly two places inside a request: the access
gate and the public-budget rail. It is not read by the route contract, the
truck validator, the route validator, the geometry normalizer, or the
provider adapter — pinned by test. A public visitor's truck is validated
with the same rules and routed with the same parameters as a pilot driver's.

### 10. Map tiles ⚠️ **A DIFFERENT KIND OF RISK**

The tiles are free and keyless, so they cost nothing. They are also served
by the OpenStreetMap Foundation's volunteer-funded tile servers, whose Tile
Usage Policy asks that heavy or automated use go elsewhere.

Turn-by-turn navigation is a continuous tile fetch for the length of a trip.
At two or three pilot drivers that is unremarkable. At public-beta volume it
is exactly the pattern the policy asks people not to send them, and the
enforcement is a block, not a bill — which would take the map out for
everyone at once, mid-trip.

This is not a spend risk. It is a **dependency risk with no warning shot**,
and it deserves an owner decision separately from the provider budget.

---

## What would unblock this

In the order that makes them worth doing.

| # | What | Why it is the blocker |
|---|---|---|
| **1** | **A spend limit set with HERE directly, on the account.** | This is the only ceiling that is actually global, because it is enforced where the meter is rather than in one of N processes. Everything else is a best effort in front of it. |
| **2** | **Establish the real allowance for BOTH products** — truck transactions *and* the search product. | The search quota is undocumented, and search is the endpoint with no cache and no adapter cap. Half the exposure is currently unmeasured. |
| **3** | **Re-run the volume model with a public-beta driver count.** | The existing model says 50 drivers exceeds the documented allowance under *ordinary* driving, and 10 drivers exceeds it in the worst case the code permits. "Public beta" has no driver count, which is the point. |
| **4** | **Decide the tile question.** | Either accept the OSM policy risk explicitly, or fund a keyed provider. Both are owner decisions; neither is a code change. |
| **5** | *Optional, and second-best:* move the limiter counters to a shared store. | Supabase is already in the stack. This would make the ceilings genuinely global. It is listed last because item 1 achieves the same protection without new infrastructure. |

Items 1 and 2 are the ones that change the answer. Until they are done, the
honest position is that public mode's cost is bounded by nothing this
repository controls.

---

## What this change did ship

Safe to merge with the mode left at `pilot`, which is what an unset variable
means:

- One access policy replacing the password-only gate, with `closed`, `pilot`
  and `public`, failing safe to `pilot` on anything it cannot parse.
- The all-callers ceiling described in check 5, inert outside `public`.
- The public-beta surface: a compact standing label and the
  posted-signs-govern sentence, with no account, no email capture, and no
  interstitial in front of route planning.
- 153 tests in `scripts/test-navigator-access-modes.ts`, including that
  nothing unrecognized ever resolves to `public`.

# Trip Planner Phase 1 — Plan My Day

**Date:** 2026-08-15
**Status:** engines, UI, results map and browser proof complete. Draft PR #318.
**Scope:** the calculation spine — provider traffic contract, route timing,
available drive time, safety buffer, parking eligibility, break placement and
weather relevance — plus the Plan My Day input flow at `/trip-planner`, the
results screen, the MapLibre results map, and the eight-viewport browser bench.
The original cost planner is preserved at `/trip-planner/classic`. Navigator is
unchanged except for shared pure authorities.

---

## 1. Audit findings

The Trip Planner is not a greenfield build. `src/lib/trip-planner/` already held
~5,800 lines, nine API routes and an 864-line client at `/trip-planner`. Much of
Phase 1's arithmetic existed; what it lacked was an honest time source.

### 1a. The provider request already asks for traffic

`buildHereRouteUrl` sends:

| Parameter | Value |
| --- | --- |
| `transportMode` | `truck` |
| `return` | `polyline,summary,actions,instructions` |
| `units` | `imperial` (instruction wording only) |
| `departureTime` | **a real ISO timestamp** from `departAtMs` |
| truck params | via the single `truckWireParams` authority |

**It does not use `departureTime=any`.** HERE v8 treats a missing departure
time, or the literal `any`, as free-flow and excludes current and predicted
traffic. TLWS has been sending a real timestamp all along, so the durations
coming back have been traffic-aware — the concern that opened this milestone did
not apply.

### 1b. But nothing proved it, and there was no delay figure

The parser typed each section summary as `{ length, duration }` and dropped
**`baseDuration`**. HERE returns that free-flow baseline only when it applied
traffic, so it is the provider's own confirmation. Without it, TLWS could
neither show "12 minutes slower than a clear road" nor state that traffic was
applied at all.

**Closed.** `baseDuration` is now parsed, and two rules govern it:

- **All-or-nothing across sections.** One section missing it discards the whole
  baseline. A partial sum understates free-flow time, which understates the
  delay — the direction that hurts a driver.
- **A baseline longer than the duration is discarded.** That is not negative
  traffic; it is a payload that cannot be describing congestion.

### 1c. `spans` are not requested, so segment-level traffic does not exist

There is no span-level congestion data in the response. Phase 1 therefore shows
**no green/orange/red route colouring**, per the milestone's own instruction not
to fabricate it. What does exist is per-action `duration`, `length` and `offset`
— a defensible provider-timed mapping at action granularity.

### 1d. Three places computed position from assumed speed

| Module | Assumption | What it decided |
| --- | --- | --- |
| `route-estimate.ts` | 55 mph × 1.2 circuity | the fallback route |
| `last-stop.ts` | per-leg `avgSpeedMph` | which parking was reachable |
| `nws-weather.ts` | `AVG_PROGRESS_MPH = 50` | when the truck meets an alert |

Distance ÷ assumed speed places the truck **further along than it will get**,
and does so worst exactly when traffic is bad. For a clock marker that is the
dangerous direction. Removing it from the three decisions above is the spine of
this milestone.

### 1e. What was reused unchanged

`hos-engine.ts` (49 CFR 395.3, pure), the `RemainingClocks` model, the truck
profile authority, `directory-layer` scoring, and the Last Stop engine's
**hard reachability filter** — reachability is a filter, never a score weight,
so commission cannot outrank safety by construction. That design was already
correct and was kept.

---

## 2. The traffic contract

`traffic.ts` is the only authority on what a screen may claim.

| Confidence | When | What the driver reads |
| --- | --- | --- |
| `live` | departure time sent **and** `baseDuration` returned | delay in minutes, or "no significant delay" under 2 min |
| `unconfirmed` | asked correctly, no baseline came back | "Live traffic unavailable — showing the provider travel time." |
| `not-requested` | no departure time, or `any` | "Live traffic unavailable — estimate is not traffic-adjusted." |

Asking is necessary but not sufficient. A request can be perfect and the
response still arrive without evidence, and in that case the estimate is not
labelled live. The plan is always built from the traffic-aware duration.

---

## 3. Route timing, and where it refuses

`route-time-axis.ts` walks HERE's action durations and offsets and
cross-checks their sum against the route summary within **2%**. Beyond that
tolerance the actions are not a decomposition of this route and the axis
refuses — it is never scaled into agreement.

It answers two questions, and degrades asymmetrically on purpose:

| Question | Needs | Degrades when |
| --- | --- | --- |
| "Where is the truck at time T?" | action timings **+ geometry** | no polyline → refuses |
| "When does the truck reach mile N?" | action timings only | never, while timings exist |

The planner's routing port does not retain polylines. Refusing it timing on
that basis would have pushed parking eligibility straight back onto assumed
speed, so the **map pin degrades and the safety filter does not**.

**Coarse vs tight.** A single interstate action can span 60 miles, and inside it
there is no information about where the truck slows. Projections carry the
containing action as a window and are marked `coarse` past 10 minutes, so a
caller renders a **stop zone** rather than a false pin.

There is no average-speed fallback anywhere in the module, and a structural test
asserts it contains no `mph` constant and never imports the estimator.

---

## 4. Available drive time and the safety buffer

`drive-window.ts` produces two numbers that must never blur:

- **Clock limit** — the last minute the supported rules allow. The engine's
  answer; the driver does not choose it.
- **Stop target** — earlier by the driver's chosen buffer. A preference, not a
  regulation.

Presets are 15 / 30 / 45 / 60 / 90 minutes, **45 recommended**. The buffer is
clamped at zero so a negative value cannot buy time back, and floored so an
oversized one means "stop now" rather than a negative target. Proved across
every preset against a spread of clock sets: **no buffer can move the stop
target later than the clock limit**.

The required 30-minute break burns the 14-hour window, which never pauses — the
trap that costs new drivers their evening — and that cost is taken before the
limits are compared.

Rounding for anything a driver reads is **down**, fixed in one place, because an
estimate that rounds up hands them minutes the clock does not have.

**Rules modelled:** 11-hour driving, 14-hour window, 60/70-hour cycle, 30-minute
break. **Not modelled and not implied:** split sleeper berth, adverse driving,
personal conveyance, Canadian HOS. **No recap projection** is produced from a
cycle balance — the existing refusal is untouched and load-bearing.

---

## 5. Parking eligibility

The filter is unchanged; the time source is not. `RouteTiming` is a **required**
argument, which is what forced every call site to be revisited rather than
leaving one quietly on the old path.

- **Decided on the worst case.** Provider timing for a point is a window; a stop
  counts as reachable only if it is reachable at the **late** end. That is what
  excludes a coarse window straddling the deadline.
- **No timing, no eligibility.** A straight-line estimate yields zero slots and
  says why. "No parking within your clock" and "we could not work out when you
  get there" call for different actions, so `timingAvailable` carries the
  difference.
- **Existence is still answerable.** Whether reservable parking sits on the
  corridor is a directory fact needing no timing, so it is reported either way.
- **Safety before preference.** Only what survives the filter is scored.

An earlier draft carried an `uncertain` flag beside the worst-case rule.
Mutation testing showed it could never be true — a stop failing at the late end
is already refused — so it was removed. Dead safety code reads as protection
nobody is getting.

---

## 6. Break placement

`break-plan.ts` aims **20 minutes before** the break becomes mandatory, and
locates that time through the same provider timing parking uses, so the break
and the stops planned around it cannot disagree about when the truck arrives.

When the drive ends before the break clock does, it says so in the engine's own
terms: *"No 30-minute break is expected before today's planned stop window."* It
never asserts that a particular stop or pause **qualifies** as a legal break —
that is a fact about the driver's day, not something a planner can claim.

Without provider timing it refuses to place a break at all.

---

## 7. Weather

### United States — NWS

`api.weather.gov`, free, no key, server-side only, fail-soft. Alerts are matched
on **place and time**: the arrival window comes from provider timing, and an
alert whose expiry falls before the truck's **earliest** possible arrival is
dropped. Matching on place alone would show a driver warnings that had already
lapsed, which teaches them to scroll past the one that mattered.

Only trucking-relevant hazards are surfaced — winter storm, blizzard, ice,
freezing rain, high wind, flooding, severe thunderstorm, tornado, dense fog,
extreme heat and cold. Weather failure never destroys an otherwise valid plan.

### Canada — **not available in Phase 1**

**Blocker, measured 2026-08-14 from the build environment:**

| Endpoint | Result |
| --- | --- |
| `weather.gc.ca` (RSS battleboard) | `CONNECT tunnel failed, 403` |
| `dd.weather.gc.ca` (MSC Datamart CAP) | `CONNECT tunnel failed, 403` |
| `api.weather.gc.ca` (GeoMet-OGC) | `CONNECT tunnel failed, 403` |

The environment's egress policy denied the CONNECT for all three. **This is not
a Canada-specific finding**: `api.weather.gov` returned the same `403` from the
same environment, while the US adapter works in deployed contexts. So the
correct conclusion is narrow — **the ECCC feed's access method, redistribution
terms and technical format could not be verified in this block**, not that it is
unusable.

Re-characterised 2026-08-15: the policy is an **allowlist**, not a general
block, which is why several unrelated verifications land in the same place.

| Host | Result |
| --- | --- |
| `api.github.com` | `200` |
| `example.com` | CONNECT `403` |
| `tile.openstreetmap.org` | CONNECT `403` |
| `deploy-preview-318--…netlify.app` | CONNECT `403` |

One policy therefore explains three separate limitations recorded in §10: the
unverified ECCC feed, the blank basemap under the map markers, and the fact
that **the Netlify preview could not be fetched from this environment**. CI
reported `verify` green and Netlify reported the deploy ready with its redirect
and header checks passing — but no claim is made here about how the preview
*renders*, because it was never loaded from here.

Until verification happens, the product says:

> Canadian route weather alerts are not available in this pilot. Check
> Environment Canada before you drive.

**A US feed is never substituted for Canadian territory.** The region gate is
checked before anything else is computed, so a Canadian route with perfect
timing still receives the honest refusal rather than an empty alert list — "no
alerts" and "we do not cover this" are different sentences and only one is true.

**To close this:** verify from a network-permitted context, confirm the MSC
Datamart CAP licence terms and User-Agent policy, pin the CAP XML shape with
fixtures, then implement behind the existing `eccc-ca` source tag.

---

## 8. What the fallback estimate may never produce

A straight-line estimate produces **no** HOS stop marker, break location,
parking eligibility or weather encounter time. `compose-quote` sends
`timingUnavailable(...)` for an estimated route, and a structural test asserts
it never hands the stop engine a `Route` again.

---

## 8a. What end-to-end verification of the endpoint found

Driving `POST /api/trip-planner/quote` against a running production server —
rather than reading the code — surfaced two defects that every unit test had
missed, because both live in the wiring between layers that unit tests stub.

### Two constants named `DEFAULT_SAFETY_BUFFER_MIN`, and the buffer went nowhere

The screen offered 15/30/45/60/90-minute presets, persisted the choice, and
displayed the selected value. `quoteRequestSchema` had no `bufferMin` field, so
the number never left the browser. Every plan was computed against
`selectLastStops`'s own default — **30 minutes** — while the results card
printed whichever preset the driver had tapped. A driver who chose 90 minutes
got a 30-minute plan under a "90 min" label.

Two constants named `DEFAULT_SAFETY_BUFFER_MIN` existed with **different
values** — `last-stop.ts` = 30, `drive-window.ts` = 45 — and each file's tests
passed against its own copy. That is how they got to disagree: nothing ever
compared them. They met for the first time on the results screen.

**The ambiguity was the NAME, not the number.** The first repair collapsed both
to a single 45-minute constant — which fixed the ambiguity and silently moved
the classic cost planner from 30 to 45. That is a behaviour change to a screen
this milestone was explicitly told to preserve, and drivers have been reading
its stop recommendations against 30 minutes since it shipped.

So the **validation is shared** and the **defaults are named for their screens**:

| Constant | Value | Owner |
| --- | --- | --- |
| `PLAN_MY_DAY_DEFAULT_BUFFER_MIN` | 45 | Plan My Day's recommendation |
| `CLASSIC_PLANNER_DEFAULT_BUFFER_MIN` | 30 | the classic cost planner, unchanged |

Both live in `drive-window.ts`, both pass the same `isSafetyBufferPreset`
guard, both go through the same clamping inside `driveWindow`, and **neither is
called "the" default** — naming the surface is now mandatory to get a number at
all, so no future caller can pick one up by accident.

An omitted `bufferMin` on the wire resolves to the **classic** 30, because the
classic planner is the only caller that never sends one. Plan My Day always
sends the preset the driver tapped.

Verified over real HTTP at 15, 30, 45 and 60 minutes, plus an omitted-buffer
case proving the classic path still plans against 30 and that the two callers
genuinely get different windows — see §8b.

### The Canadian refusal was unreachable

`relevantWeather` has a region gate, tested and mutation-verified (§7). The
endpoint passed a hardcoded `country: 'US'`, so it could never fire: a route
into Canada silently received US-coverage treatment, and "no alerts" was
indistinguishable from "clear skies".

**A route has two countries, and the first fix did not.** Deriving one label
for the trip ("Canadian if either end is") is false at one end of every
crossing, and it hides the US half of the weather that genuinely exists on a
US-to-Canada haul. So `route-region.ts` resolves each end **separately**:

| Field | Meaning |
| --- | --- |
| `origin`, `destination` | `'US' \| 'CA' \| 'unknown'`, resolved per end |
| `crossBorder` | both ends known **and** different |
| `fullyUS` | both ends provably US — the only state NWS may answer for |
| `touchesCanada` | either end provably Canadian |

The weather gate reads `fullyUS`, never "is it Canadian", and each refusal
names the actual situation:

| Shape | Notice |
| --- | --- |
| both US | answered (no region refusal) |
| both CA | `CANADA_WEATHER_UNAVAILABLE` |
| US ↔ CA either direction | `CROSS_BORDER_WEATHER_PARTIAL` — half-covered, not Canadian |
| either end unplaceable | `ROUTE_COUNTRY_UNDETERMINED` |

**The caller's claim outranks geography.** A directory anchor carries a state
or province code — an attested fact about the record, not an inference — and
Plan My Day passes it as `origin.country` / `destination.country`. This is what
makes Windsor–Detroit answerable at all: `countrySideOf` returns `'unknown'`
for both (no half-plane puts Windsor in Canada without taking Detroit with it),
and with the codes attached it becomes a crossing rather than a guess. An
unrecognised code claims nothing and falls through to geography.

### One submission, one route request

Proven in two halves, because no single tool can see both:

| Half | Where | Assertion |
| --- | --- | --- |
| Browser → endpoint | `trip-planner-viewports.mjs` | one tap sends exactly one POST; five rapid taps still send one |
| Endpoint → provider | `test-trip-planner-api.ts` | one composed quote calls the routing port once; one port call makes one provider request |

The provider call is made server-side, so Playwright cannot observe it — which
is why the second half is a unit assertion rather than a claim about the
browser run. The adapter's documented retry policy is pinned too: a 4xx is
never retried (it will not fix itself and retrying spends quota), a 5xx is
retried exactly once.

---

## 8b. Measured verification

### Endpoint, over HTTP against a production build

`scripts/verify-trip-planner-endpoint.mjs` — **31 checks, 0 failures.**

- the buffer at 15/30/45/60 min reaches the parking filter, the drive window
  and the displayed caption **unchanged**, and `clockLimitMin − stopTargetMin`
  equals the chosen buffer exactly;
- a wider buffer measurably shortens the usable day;
- US→US, CA→CA, US→CA, CA→US, Detroit→Windsor attested, and Detroit→Windsor
  with no claims each get their own answer;
- the fallback estimate claims **nothing**: no live traffic, no clock
  geography, no break geography, no parking eligibility, no timed weather, no
  drawn road.

### Browser, 12 scenarios × 8 viewports

`scripts/bench/trip-planner-viewports.mjs` — **1,838 checks, 0 failures, 2
known-open notes.**

Viewports: 320×568, 360×640, 375×667, 390×844, 412×915, 430×932, 844×390,
932×430. Scenarios are generated by `trip-planner-fixtures.ts` calling the real
`planMyDay`, so a scenario that stops producing the state it is named for fails
rather than silently rendering something else.

Proven from the browser with no fixture involved: one tap sends exactly one
POST to `/api/trip-planner/quote`; five taps inside one in-flight window still
send one; the live endpoint answers and its refusal path renders;
`/trip-planner/classic` still serves its three-step flow, its origin,
destination and departure inputs and its truck-profile fields.

### Two defects the bench itself found

1. **The map drew nothing while the legend said it had.** `PlanMap` added its
   layers on MapLibre's `load` event, which fires only after the first
   visually complete render — so when the tile server was unreachable, the
   canvas mounted, the legend read "Clock limit — marked", and **zero markers
   existed**. Bad signal and needing the plan are the same moment in a truck,
   so this was the wrong failure to have. Now drawn on `style.load` (parsed
   style, no tile involved) with `load` and `idle` as fallbacks; `draw` is
   idempotent. The bench now counts the markers the plan earned against the
   markers actually in the DOM — the assertion whose absence hid this.

2. **The rapid-tap probe was measuring the fixture, not the guard.** The stub
   answered in under a millisecond, so a later tap started a second, entirely
   legitimate request — a driver re-planning after results appeared. The stub
   now answers in 1,500 ms and the probe asserts the taps landed **inside**
   that window before asserting one request.

### Bench infrastructure

`mock-postgrest.mjs` gained `like`/`ilike`. Without it every
`/directory/<hwy>/exit-<n>` page threw during prerender (the corridor query
narrows with `.ilike('interstate', '%75%')`), which made the site unbuildable
against the mock and any bench needing a populated directory unrunnable. With
it the build completes with **zero** directory read failures and the planner
sees 3,882 anchors.

---

## 8c. The destination input, and the gap it closed

The first version restricted both ends to the TLWS directory dropdown. The
directory stores `state` with no country or province column, so every anchor
is a US listing — which meant the Canadian and cross-border paths, tested and
correct in the engine, **could not be reached through the actual screen**. A
promise of US and Canadian planning that a driver cannot exercise is a product
gap, not a documentation footnote.

### One search system, two doors

Plan My Day now uses the Navigator's `DestinationSearch` component directly —
its 350 ms debounce, its request coordinator (sequencing, same-query caching,
stale-response rejection), its `DestinationCandidate` model, and the
`in=countryCode:USA|CAN` filter that carries accents, provinces and postal
codes. Nothing about searching was reimplemented; a harness asserts the new
route builds no provider URL and parses no provider fields of its own.

What differs is the **door**, and only the door:

| | Navigator | Plan My Day |
| --- | --- | --- |
| Route | `/api/navigator/destination-search` | `/api/trip-planner/destination-search` |
| Access | signed pilot cookie | free, public |
| Flag gate | `NEXT_PUBLIC_NAVIGATOR_ENABLED` | none |
| Rate limit | 30/min/IP | 30/min/IP, **separate bucket** |
| Search behaviour | `@/lib/navigator-api/destination-search` | the same module |

A second door was necessary because Plan My Day is free and its visitors hold
no pilot cookie — every keystroke would have 401'd. The alternative was
widening the pilot gate, which would expose a pilot-budgeted endpoint to the
open internet as a side effect of a planner feature. The buckets are separate
so public typing can never drain the pilot's allowance, or the reverse.

### The directory is a shortcut, not a fence

Directory locations remain available behind a disclosure control on each end.
They are what TLWS actually knows about — verified stops with parking counts —
and a driver who wants one should not have to type its name. They are simply
no longer the only way in.

### Each end carries an attested country

A searched place claims the country its search was **filtered to**; a directory
pick claims its listing's own state code. Both are facts about the record
rather than inferences, which is what makes Windsor–Detroit answerable at all
— no latitude rule separates them, so coordinates alone leave both ends
unplaceable.

### Typing never buys a route

Search and routing are different endpoints and different budgets. The browser
bench asserts that typing and picking across four region shapes produce
**zero** POSTs to the quote endpoint, and that exactly one is sent after the
button is tapped. The button stays disabled until both ends are chosen.

### Verified through the screen, not only the endpoint

US→US, CA→CA, US→CA and CA→US are each driven through the real UI — type,
pick, tap — and the weather sentence is read off the rendered page. This is
possible without a routing key because the **region gate runs before the
timing gate** by design: a Canadian route still gets its honest refusal, and a
crossing still gets "only available for the United States portion", even when
every timing answer refuses.

---

## 8d. A screen that worked and could not be read

`navigator-design.css` defines `--nav-bg`, `--nav-surface`, `--nav-good` and
the rest on `:root`, and it was imported by the `(navigator)` layout **only**.
Plan My Day lives in the `(directory)` group, so on `/trip-planner` every one
of those variables resolved to nothing — and Tailwind classes like
`bg-nav-good` compile to `background-color: var(--nav-good)`, which with no
value is transparent.

Measured, not guessed:

| Element | Before | After |
| --- | --- | --- |
| "Plan My Day" button | `rgb(20,20,20)` text, transparent fill, on an `rgb(20,20,20)` page — **black on black** | 4.5:1+ against its painted fill |
| Selected chips (buffer, units, country) | identical to unselected | visibly distinct |

The screen was fully functional and almost unreadable — the worst combination
for a bench to miss. Nothing threw; every assertion about text, size and tap
target passed. **2,072 checks certified a screen whose primary action was
invisible**, because the bench measured geometry and words and never once
measured contrast.

Fixed by importing the same stylesheet from a `/trip-planner` layout rather
than copying its token block: a second copy would drift, and the night palette
is a safety decision (colour = meaning, never decoration) that must not fork.
The bench now computes WCAG contrast for the primary action and asserts a
selected chip differs from an unselected one.

---

## 8e. Is the HERE key available to these endpoints?

**Same variable, same runtime.** Every consumer reads `process.env.HERE_API_KEY`:

| Route | Purpose |
| --- | --- |
| `/api/navigator/route` | Navigator truck routing |
| `/api/navigator/destination-search` | Navigator search |
| `/api/trip-planner/quote` | Plan My Day routing |
| `/api/trip-planner/destination-search` | Plan My Day search |
| `/api/trip-planner/places` | geocoding |

All are Next route handlers in the same Netlify Functions runtime, so any
context where the Navigator's search works supplies the same value here. The
known failure mode is **scope**, already documented at
`api/navigator/route/route.ts`: a Netlify variable scoped to Production only,
or to builds but not functions, is invisible to a Deploy Preview.

**No secret was added, rotated, exposed or changed**, and none can be read from
this environment. What exists instead is a safe way to *check*, using only a
status code:

```
GET /api/trip-planner/destination-search?q=windsor&country=CAN
```

| Response | Meaning |
| --- | --- |
| `503 provider-not-configured` | the key is not visible in this deploy context — check context AND functions scope |
| `200` with places | configured; the quote endpoint reads the same variable |

Verified locally: with no key the route returns exactly that 503, and the body
carries no key material, no upstream URL and no provider detail.

**Consequence for the phone review:** if that probe returns 503, the map will
show "Clock-limit location cannot be mapped safely" rather than a pin. That is
the refusal working correctly on an estimated route, not a broken map.

---

## 9. Test totals

| Harness | Checks |
| --- | --- |
| `trip-planner-foundation` | 69 |
| `trip-planner-parking-timing` | 24 |
| `trip-planner-break-weather` | 30 |
| `trip-planner-clock-marker` | 22 |
| `trip-planner-plan-my-day` | 76 |
| `trip-planner-api` | 114 |
| Full offline suite | **183 harnesses, all passing** |

Every invariant above was **mutation-verified** — the rule was inverted in the
source and the tests were confirmed to fail:

| Mutation | Failures |
| --- | --- |
| partial `baseDuration` baseline | 2 |
| remove the timing cross-check | 2 |
| buffer adds instead of subtracts | 4 |
| decide eligibility on the early end of the window | 3 |
| accept eligibility without provider timing | whole run |
| compare alert expiry against departure, not arrival | 1 |
| let a US feed answer a Canadian route | 3 |
| place the break at the exact limit | 2 |

`tsc`, `next lint`, Prettier, `git diff --check` and the production build are
clean.

---

## 10. Known limitations

1. **No segment-level traffic colouring.** The response carries no `spans`, and
   fabricating it was explicitly out of bounds.
2. **Clock markers are action-granular.** Coarse windows render as a zone, not a
   pin. Honest, but less precise than a driver might expect.
3. **Canadian weather unavailable** — §7, with the exact blocker.
4. **Canadian HOS is not calculated**, and no US calculation is carried across
   the border.
5. **The break lead is a flat 20 minutes**, not scaled to how coarse the timing
   at that point is.
6. **The live HERE round trip is unproven in this environment.** No
   `HERE_API_KEY` is set, so every local quote takes the estimate path. The
   browser bench records this as a note rather than a pass. What *is* proven:
   one composed quote calls the routing port exactly once, one port call makes
   exactly one provider request, a 4xx is never retried and a 5xx is retried
   exactly once (`test-trip-planner-api.ts`). The provider call is server-side
   and Playwright cannot observe it.
7. **Map tiles do not load in the sandbox** (no egress to
   `tile.openstreetmap.org`). Route line, pins and zones all render over a
   blank basemap — which is now a deliberately supported state, see §8b — but
   no run asserts that a tile arrived.
8. **The twelve browser scenarios are provider-shaped, not provider-sourced.**
   The maneuvers carry the offsets, lengths and durations HERE returns, but no
   HERE request produced them.
9. **The 44px floor is measured on the planner's own controls.** The shared
   site header and footer contain 22 smaller links (including a 1px `sr-only`
   skip link, correct by design) and MapLibre's required OpenStreetMap
   attribution link at 14px. None are driver controls; none changed in this
   PR; all are reported as a bench note rather than silently excluded.
10. **Canadian HOS is still not calculated**, and no US calculation is carried
    across the border — only the weather refusal distinguishes the crossing.
11. **The Netlify preview was not fetched from this environment.** CI reported
    `verify` green and Netlify reported the deploy ready with its redirect and
    header checks passing, but the preview host is outside this environment's
    egress allowlist (§7), so nothing here claims how it renders. Shawn's own
    check of the preview remains the gate on merging.

---

## 11. Remaining Phase 1 work

Input flow (region/units → truck → origin → destination → clocks → buffer →
Plan My Day), the results screen, the `/trip-planner` route, the production
browser bench across the eight required viewports, and the TPC authorization
check before any booking affordance ships.

# Navigator truck routing — wire audit

**What a fleet manager is entitled to ask:** which of the numbers on the
truck-profile screen actually changed the route? This document answers
that field by field, and it is derived from the REAL request builder
(`buildHereRouteUrl`), not from memory. `test-navigator-truck-integrity`
and `test-navigator-pilot-docs` re-derive the same facts on every test
run, so this table cannot quietly go stale while the code moves.

Audited on **2026-08-12** against `main` = `e082d30`.

---

## 1. The matrix

Internal units are the app's; the wire column is exactly what leaves the
server. Conversions are `ft × 30.48 → cm` (rounded) and
`lb × 0.45359237 → kg` (rounded).

| Driver field | Internal unit | HERE parameter | Sent? | Supported? | Driver disclosure |
|---|---:|---|---|---|---|
| Height | feet (13.5) | `truck[height]` = `411` cm | **Yes** | Verified in production use | Editable; listed in "Route planned for" |
| Width | feet (8.5) | `truck[width]` = `259` cm | **Yes** | Verified in production use | Editable; listed |
| Length | feet (70) | `truck[length]` = `2134` cm | **Yes** | Verified in production use | Editable; listed |
| Gross weight | pounds (80,000) | `truck[grossWeight]` = `36287` kg | **Yes** | Verified in production use | Editable; listed |
| Axle count | integer (5) | `truck[axleCount]` = `5` | **Yes** | Verified in production use | Editable; listed |
| Hazmat class | US placard class or none | `truck[shippedHazardousGoods]` = `flammable` (class 3) | **Yes**, omitted when none | Verified in production use | Editable; listed, or "Hazmat: none" |
| Avoidances | feature ids | `avoid[features]` = `tollRoad,ferry` | **Yes**, omitted when empty | Whitelist below | Editable; each listed |
| Departure time | ms epoch | `departureTime` (ISO 8601) | **Yes** | Verified in production use | Not driver-editable (always "now") |
| **Weight per axle** | — | *(none)* | **No** | **Unverifiable here** — see §3 | Shown under **Not used for routing** |
| **Trailer count** | — | *(none)* | **No** | **Unverifiable here** — see §3 | Shown under **Not used for routing** |
| **Hazmat tunnel category** | — | *(none)* | **No** | **Unverifiable here** — see §3 | Shown under **Not used for routing** |
| **Vehicle / trailer type** | — | *(none — provider default applies)* | **No** | **Unverifiable here** — see §3 | Shown under **Not used for routing** |

The complete parameter set on the wire, with the key redacted:

```
transportMode=truck
origin=35.000000,-85.000000
destination=35.100000,-85.000000
return=polyline,summary,actions,instructions
units=imperial
departureTime=2026-02-02T02:40:00.000Z
truck[height]=411          # 13.5 ft
truck[width]=259           # 8.5 ft
truck[length]=2134         # 70 ft
truck[grossWeight]=36287   # 80,000 lb
truck[axleCount]=5
truck[shippedHazardousGoods]=flammable
avoid[features]=tollRoad,ferry
apiKey=<redacted>
```

Nothing else is sent. A parameter appearing here that is not in the table
above is a routing change and fails the integrity harness.

## 2. Enumerations actually accepted by this build

**Avoidances** (`HERE_AVOID_FEATURES`, whitelist — anything else is
dropped before the request): `tollRoad`, `ferry`, `tunnel`, `dirtRoad`,
`uTurns`.

**Hazmat mapping** (`hazmatToHereGoods`, US placard class → HERE value):

| Class | Wire value | | Class | Wire value |
|---|---|---|---|---|
| 1 | `explosive` | | 6 | `poison` |
| 2 (incl. 2.1) | `gas` | | 7 | `radioactive` |
| 3 | `flammable` | | 8 | `corrosive` |
| 4 | `combustible` | | 9 | `other` |
| 5 | `organic` | | none | *(parameter omitted)* |

**Accepted ranges** (`TRUCK_LIMITS`; outside these the request is refused
before any network call): height 8–15 ft, width 7–9 ft, length 20–120 ft,
gross weight 10,000–164,000 lb, axles 2–9.

## 3. The blocker: no reachable official HERE documentation

The milestone required official HERE documentation as the authority for
any NEW provider parameter. **Every HERE-owned documentation host is
blocked by this environment's network egress proxy:**

| Host attempted | Result |
|---|---|
| `www.here.com/docs/bundle/routing-api-v8-api-reference/...` | `EGRESS_BLOCKED` |
| `developer.here.com/documentation/routing-api/...` | `EGRESS_BLOCKED` |
| `docs.here.com/routing/docs/routing-v8-vehicle-properties` | `EGRESS_BLOCKED` |
| `docs.here.com/routing/docs/routing-v8-truck-routing` | `EGRESS_BLOCKED` |
| Context7 mirror of HERE's official `router_api.yaml` | Monthly quota exceeded |

A general web search returned prose that *describes* `weightPerAxle`,
`trailerCount` and `tunnelCategory` as HERE concepts, but a search-engine
summary is not the provider's contract: it does not establish the exact
parameter spelling, the unit, the accepted range, or the enum values, and
it cannot be re-verified. **A truck-safety parameter is the last place to
guess.**

**Consequence, and it is deliberate:** this milestone adds **no new
provider parameter**. The request is byte-for-byte the same shape it was
before. The four unverifiable fields are shown to the driver under a
labelled **Not used for routing** section that says plainly that the
route does not account for them.

**To close this later**, one of these must happen first:

1. the egress policy allows a HERE documentation host, or
2. someone with access pastes the official parameter table (name, unit,
   range, enum) into this document, or
3. a HERE support/contract response is attached here.

Then the parameter goes on the wire, this table's "Sent?" column flips,
and the "Not used for routing" section shrinks — in a change whose only
job is that.

## 4. What the driver may change, and what it costs

Editable, because each one is verified on the wire: height, width,
length, gross weight, axle count, hazmat class, and the five whitelisted
avoidances.

- Editing is **parked-only**, through the shared safety-lock authority
  (`edit-destination`) — no second motion rule exists.
- Changing any routing-relevant value **invalidates the confirmation**
  and the planned route; the next trip must be planned fresh.
- Confirming a profile costs **zero** provider transactions. So does
  changing avoidances, or any camera action.
- One Start attempt is still at most one route request; an invalid
  profile produces **zero**.

## 5. Route decisions

| Outcome | What the driver sees | Where |
|---|---|---|
| Accepted | "Route planned for" + only the restrictions actually sent, and the honest limit that signs, closures and work zones are not guaranteed | Parked briefing |
| Warned | The existing briefing pause, warnings in plain language, each labelled with its SOURCE — provider response, local plausibility check, or missing truck information | Parked briefing, never collapsed |
| Refused | One reason and one safe next action; the driver stays parked, nothing retries on its own, and **no car route is ever substituted** | Parked controls |

## 6. Persistence

The confirmed profile is stored in `sessionStorage` for the browser
session only: dimensions, weight, axles, hazmat class, avoidances, and
the confirmation fingerprint. **No position, no route history, no
identity, no driving behaviour** travels with it — the same rule the trip
snapshot already follows (AD-7).

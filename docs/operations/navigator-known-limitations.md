# Navigator Pilot — Known Limitations

**The one authoritative list.** If something is claimed about Navigator's
limits anywhere else, this file wins.

Every line below was verified against the code on **2026-08-10** at `main`
= `b6a1260`; the off-route reversal row was updated the same day after
PR #272 merged (`main` = `1ee4932`). `scripts/test-navigator-pilot-docs.ts`
re-verifies the mechanical ones on every test run, so this document cannot
quietly go stale while the code moves underneath it.

**Read this before you hand the password to anybody.**

---

## 1. The big one: this is not certified truck routing

Navigator asks a routing provider for a truck route using the dimensions you
configured, and shows you what comes back. It does not verify the answer
against a legal database, because no such verification exists in this
application.

**Signs, posted restrictions, and the driver's own judgment always win.**
That is not a disclaimer written by a lawyer; it is a statement of what the
software actually knows.

---

## 2. What the truck profile actually sends

This is generated from `TRUCK_PROFILE_COVERAGE`, which is itself pinned to
the request builder by test. It is what goes on the wire, not what a screen
implies.

### Sent to the provider

| What | Provider parameter | Why it matters |
|---|---|---|
| Height | `truck[height]` | Low bridges and overpasses |
| Width | `truck[width]` | Narrow lanes and restricted roads |
| Length | `truck[length]` | Turn radius and length-restricted routes |
| Gross weight | `truck[grossWeight]` | Posted bridge and road weight limits |
| Axle count | `truck[axleCount]` | Axle-count restrictions and toll classification |
| Hazmat class | `truck[shippedHazardousGoods]` | Roads and crossings closed to placarded loads |
| Avoid options | `avoid[features]` | Tolls, ferries, tunnels, dirt roads, U-turns |
| Departure time | `departureTime` | Time-of-day restrictions and traffic |

### **Not** sent — read these carefully

| What | Status | What it means on the road |
|---|---|---|
| **Vehicle type** | Provider default — nothing is sent | The provider decides for itself what kind of truck this is. A combination unit turns and is restricted differently from a straight truck, and Navigator is not telling it which one you are driving. |
| **Weight per axle** | Not modelled anywhere in the app | Many bridge postings are per-axle, not gross. Gross weight alone cannot express them. |
| **Trailer count** | Not modelled anywhere in the app | Doubles and triples are barred from some roads outright. The request cannot say you are pulling two. |
| **Hazmat tunnel category** | Not modelled anywhere in the app | Tunnel access for placarded loads is governed by category, not by hazmat class alone. |

**The vehicle-type gap is unresolved on purpose.** Establishing the correct
provider parameter needs primary provider documentation, which has not been
reachable from the build environment. **Nothing was guessed.** A wrong
vehicle-type parameter would be worse than none: it would silently change
routing while looking like a fix. See the open owner decision below.

---

## 3. Route guidance

| Limitation | Detail |
|---|---|
| **No route is guaranteed legal** | Validation checks that a route is *usable* — it has maneuvers, it ends where it was asked to, its implied speed is possible. It does not check that it is *legal*. |
| **Only one route is requested** | No alternatives are asked for. You get the provider's answer, not a choice of three. |
| **No verified truck-turnaround dataset exists** | Navigator cannot identify a place a 70-foot combination can legally and safely turn around, and it does not try. If a route ever implies one, that is a P0 — report it and stop. |
| **Off-route reversal protection is merged but not road-verified** | The guard that refuses a replacement route beginning with an implied turnaround merged in **PR #272 on 2026-08-10** and is on `main`. No drive has verified it: the owner Hwy 92 / Charles Hardy road retest is **NOT PERFORMED**, and a production build deployed from before the merge still has no reversal check at all. |
| **The plausibility advisory is an advisory** | It flags a route that looks wrong for a truck. It does not approve one that does not. |

## 4. Destinations and arrival

| Limitation | Detail |
|---|---|
| **Truck entrances are usually unverified** | A destination is routed to as a point. When no verified truck entrance is known, Navigator says so and routes to the point anyway — it never fabricates an entrance or a gate. |
| **A verified entrance requires data that mostly does not exist yet** | Entrance data comes from the directory. Coverage is partial. |
| **Search finds what the provider knows** | An address or business the provider does not have, Navigator cannot find. |

## 5. Position and the map

| Limitation | Detail |
|---|---|
| **GPS accuracy depends on the phone and the sky** | Buildings, tunnels, canyons and cheap receivers all degrade it. Navigator reports degraded accuracy rather than pretending. |
| **Position is never stored** | Not in a database, not in local storage, not in a report. It exists in memory while the screen is open and then it is gone. |
| **No satellite imagery** | The map is OpenStreetMap street tiles. Satellite needs a licensed provider and a paid tier; the satellite style exists in the code with **no tile URL**, deliberately, rather than pointing at somebody else's imagery. |
| **No offline maps and no offline routing** | Both need the network. Tiles already loaded stay on screen; new ones do not arrive. |
| **Live guidance is heading-up; every other map is north-up** | Since the MapLibre migration the driving camera rotates to the truck's direction of travel, so a spoken left turn branches left on screen. Parked maps, the route briefing and route Overview stay **north-up** deliberately — they answer "where does this go?", which is easiest to read with north at the top. |
| **The heading is inferred, and says so** | Order of evidence: the GPS course while moving, the route's forward bearing when the receiver publishes none, then the last reliable heading. A **parked truck at a cold start has no heading at all** and the map stays north-up rather than inventing one. A sustained reversal is believed after two agreeing samples, so a genuine U-turn arrives about a second late — deliberate, because a single bad sample must never spin the map. |
| **No compass** | Orientation comes from GPS movement only. No device-orientation sensor is read and no motion permission is requested, so a stationary truck cannot be pointed by turning the phone. |

## 6. Voice

| Limitation | Detail |
|---|---|
| **Voice needs a tap first, on every phone** | Mobile browsers refuse to speak until the user has interacted. Enable voice while stopped, before you start driving. |
| **Voice quality is the phone's, not ours** | Navigator uses the device's own speech engine. |
| **Silent switch and Bluetooth routing are the phone's business** | If the phone is muted or the audio is going somewhere you are not listening, Navigator cannot tell. |

## 6a. Hours of service — a planning aid, not an ELD

The driving screen shows four clocks (DRIVE, WINDOW, CYCLE, BREAK) and the
parked screen shows the same four in detail. Every one of them is computed
by the trip-planner HOS engine this app already had. **Navigator is not an
ELD and does not claim to be one**; the display carries that sentence
wherever the clocks appear.

| Limitation | Detail |
|---|---|
| **The clocks start from a FRESH DRIVER, every session** | Nothing is connected to an ELD and there is no place to enter what you have already driven today. If you have been on duty for six hours before opening Navigator, the clocks do not know it. **Check your own logs.** |
| **A reload keeps the clocks it has, but cannot recover the ones it never had** | Since round 3 the trip snapshot carries the clock state, so reloading mid-drive no longer hands you back a fresh eleven hours. It restores what this session had counted — not your real duty day. |
| **Duty status is inferred, not logged** | Time burns while guidance is genuinely active. Time spent on duty but not navigating — loading, fuelling, inspections — is not counted, so the real window is always **shorter** than the screen says. |
| **The 30-minute break is counted, not enforced** | The BREAK clock counts driving time since the last qualifying break in the engine's model. It cannot see a break you actually took while the app was closed. |
| **Cycle is 70/8 by default** | The engine supports 60/7, but nothing in the pilot UI selects it. A 60-hour driver is shown a 70-hour cycle. |
| **No violation is recorded or transmitted** | Overdue clocks are displayed, spoken, and nothing else. There is no log, no report, no upload. |

### Conformance note (recorded, not fixed here)

The engine models the federal property-carrying limits it was written for —
11-hour driving, 14-hour window, 30-minute break, 60/7 and 70/8 cycles. It
does **not** model: sleeper-berth splits, the short-haul exception, adverse
driving conditions, personal conveyance, yard moves, or any state-specific
or agricultural exemption. A driver using any of those will see clocks that
disagree with their ELD, and **the ELD is the record**.

This is written down rather than fixed because changing HOS rules is a
rules-engine change with its own verification burden, and the round-3 item
that surfaced it was a display change. Treated as an owner decision below.

## 7. Session and data

| Limitation | Detail |
|---|---|
| **The pilot session lasts 12 hours** | After that the password is needed again. Enforced server-side from a signed timestamp, so a copied cookie expires too. |
| **Your first name is session-only** | It is held in the screen's memory and nowhere else — no storage, no cookie, no database. **A page reload loses it.** This is deliberate. |
| **Reports are not sent anywhere automatically** | A report is generated and copied to your clipboard. Nothing transmits it. The driver sends it to the owner-selected destination: `shawngresham90@gmail.com` (decision 2, below). |
| **Nothing about the trip is retained** | No trip history, no route archive, no telemetry. When the tab closes, the session is gone. |

## 7a. Canada

The pilot runs in Canada. It does not pretend to be a Canadian product.

| Limitation | Detail |
|---|---|
| **Canadian HOS is not calculated** | The clocks implement US federal property-carrying limits. In Canada mode they are **replaced**, not relabelled, by: *"Canadian HOS is not calculated in this pilot. Use your certified ELD as the record."* Navigation stays fully usable — nothing about the region gates a route. |
| **Canadian truck-routing quality is the provider's, and unverified by us** | The app sends the correct request (`transportMode=truck`, the same metric `truck[...]` parameters). Whether a truck-appropriate Canadian route comes back is HERE's coverage. The status panel says *"Available where provider coverage exists"* — that is a statement about what the app will attempt, not a promise. |
| **Canadian parking coverage is limited** | The parking and truck-stop data is US-built. Nothing Canadian is fabricated to fill the gap, and the app says so: *"Canadian parking coverage is limited in this pilot."* |
| **Cross-border is a reminder, not a border service** | When origin and destination look like different countries the app shows: *"Cross-border route. Verify customs documents, permits, border status, and operating hours separately."* It does not know wait times, permit requirements, or customs status. |
| **Cross-border detection is deliberately imprecise, in the safe direction** | Windsor, Ontario is *south* of Detroit, Michigan, so no latitude rule can separate them. The app refuses to answer from geography in the Great Lakes corridor and falls back to the destination's provider-attested country and the driver's own declared region. It errs toward showing the notice. |
| **The region is a preference, not a jurisdiction** | It changes where the search looks and which units are shown. It is not a compliance mode, it claims no legality, and it is **never** inferred from GPS. |
| **No Canadian legal limit is encoded** | No provincial or federal dimension, weight, or hours limit appears anywhere in the app. The truck profile is the driver's own numbers. There is no "Canada legal" preset. |
| **The region is session-only** | Like the trip and the truck, it lives in session storage under its own versioned key and is gone when the tab closes. It defaults to United States, so existing sessions are unaffected. |

Full audit and compatibility matrix: `navigator-canada-audit.md`.

## 8. Provider limits and volume

| Limit | Value | Where it lives |
|---|---|---|
| Route requests | **6 per hour per IP** | The route endpoint's limiter |
| Destination searches | **30 per minute per IP** | The search endpoint's limiter |
| Reroutes | **6 per hour, 12 per session**, per driver | The reroute controller's budget |
| Reroute failure backoff | **30 s → 60 s → 120 s** | Same |
| Provider allowance | **~5,000 truck transactions per month** on the free tier | Documented in the routing adapter |

Hitting a limit is not a crash. It looks like a route that will not plan, or
a reroute that does not come. That distinction matters when a driver reports
"it stopped working".

---

## ⚠ Open owner decisions

These are recorded rather than resolved. Each one was left alone because
resolving it needs a decision only the owner can make. Decision 2 has since
been made by the owner and is marked resolved below; it stays in the table
so the record of who decided it, and when, survives.

| # | Decision | Why it was not made here |
|---|---|---|
| 1 | **The provider vehicle-type parameter.** | Requires primary provider documentation, unreachable from the build environment. Guessing would change routing silently. The request is byte-for-byte unchanged. |
| 2 | **Where a driver sends a problem report.** ✅ **Resolved 2026-08-10** — the owner selected `shawngresham90@gmail.com`. | The decision was the owner's to make and the owner made it. It is recorded in the driver guide and pinned by test: any *other* destination appearing there still fails the build. |
| 3a | **Whether to extend the HOS engine to sleeper-berth splits, short-haul, adverse-driving and personal conveyance.** | Today a driver using any of those sees clocks that disagree with their ELD. The display says it is a planning aid, but the gap is real and it is a rules-engine change, not a screen change. |
| 3 | **Whether to model weight-per-axle, trailer count and tunnel category.** | Each is real work and each changes what the app claims to enforce. Adding a field to a screen without sending it on the wire would be worse than the gap. |
| 4 | **Whether to license satellite imagery.** | A paid provider decision. |
| 5 | **Whether pilot reports should persist.** | Persistence needs a store, a retention policy, and a privacy position. See the observability memo. |
| 6 | **How to get heading-up navigation: the `leaflet-rotate` plugin, or a MapLibre GL migration.** ✅ **Resolved** — the owner authorized the **MapLibre GL migration** (path B), and it shipped. | The blocker was measured, not assumed — Leaflet 1.9.4 has no bearing API, and the CSS-transform fake breaks coordinates and inverts panning (`navigator-heading-up-blocker.md`, probe still committed at `scripts/bench/navigator-rotation-probe.mjs`). MapLibre now renders the Navigator's map with a real camera bearing; the tile source, its attribution, and both providers are unchanged. Leaflet remains in the repository because the **directory and parking maps** still use it. |
| 7 | **Whether to implement Canadian hours of service.** | Canada's rules differ from the US federal ones in almost every dimension, and this is a rules-engine change, not a screen change. Until it is made, Canada mode replaces the clocks with a sentence naming the gap rather than showing an American clock to a Canadian driver. |
| 8 | **Whether to import Canadian parking and truck-stop data.** | A data-sourcing and licensing decision. The alternative — showing partial or inferred Canadian results — would be worse than the stated gap. No Truck Parking Club listings can be shown without confirmed authorization. |

---

## What this document is not

It is not the marketing copy, and it is not the in-app disclosure. Those
exist separately and are shorter. This is the complete list, written for the
person deciding whether to hand a driver the password.

If you find something true about Navigator's limits that is not on this list,
that is a defect in this document. Add it.

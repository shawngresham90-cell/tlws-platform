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

## 6. Voice

| Limitation | Detail |
|---|---|
| **Voice needs a tap first, on every phone** | Mobile browsers refuse to speak until the user has interacted. Enable voice while stopped, before you start driving. |
| **Voice quality is the phone's, not ours** | Navigator uses the device's own speech engine. |
| **Silent switch and Bluetooth routing are the phone's business** | If the phone is muted or the audio is going somewhere you are not listening, Navigator cannot tell. |

## 7. Session and data

| Limitation | Detail |
|---|---|
| **The pilot session lasts 12 hours** | After that the password is needed again. Enforced server-side from a signed timestamp, so a copied cookie expires too. |
| **Your first name is session-only** | It is held in the screen's memory and nowhere else — no storage, no cookie, no database. **A page reload loses it.** This is deliberate. |
| **Reports are not sent anywhere automatically** | A report is generated and copied to your clipboard. Nothing transmits it. The driver sends it to the owner-selected destination: `shawngresham90@gmail.com` (decision 2, below). |
| **Nothing about the trip is retained** | No trip history, no route archive, no telemetry. When the tab closes, the session is gone. |

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
| 3 | **Whether to model weight-per-axle, trailer count and tunnel category.** | Each is real work and each changes what the app claims to enforce. Adding a field to a screen without sending it on the wire would be worse than the gap. |
| 4 | **Whether to license satellite imagery.** | A paid provider decision. |
| 5 | **Whether pilot reports should persist.** | Persistence needs a store, a retention policy, and a privacy position. See the observability memo. |

---

## What this document is not

It is not the marketing copy, and it is not the in-app disclosure. Those
exist separately and are shorter. This is the complete list, written for the
person deciding whether to hand a driver the password.

If you find something true about Navigator's limits that is not on this list,
that is a defect in this document. Add it.

# Navigator — Canada navigation compatibility audit

**Date:** 2026-08-13
**Scope:** the Navigator pilot only (`src/lib/navigator`, `src/components/navigator`,
`src/lib/navigator-api`, `src/app/api/navigator`, and the one shared provider-mapping
module `src/lib/trip-planner/here-truck-params.ts`).
**Purpose:** establish, before writing any Canadian behaviour, exactly what the app
currently assumes is American — and then record which of those assumptions this
milestone changed and which it deliberately left alone.

---

## 0. The one-paragraph answer

The Navigator was built United-States-first in four places and only four: the
destination search filters to `countryCode:USA`, the unbiased search fallback centre
is in Kansas, every driver-facing number is formatted in miles/feet/mph/pounds, and
the HOS engine implements US federal property-carrying limits. Nothing in the
routing request is American — `transportMode=truck` and the `truck[...]` parameters
are country-neutral, in centimetres and kilograms, and were already correct for
Canada. So Canadian compatibility is a **search, display and honesty** change, not a
routing change, and this milestone treats it as one.

---

## 1. Source access — what could and could not be verified

The milestone instruction requires current official HERE documentation and
authoritative Canadian government sources, and forbids guessing provider parameters
or legal truck limits.

**Primary sources are unreachable from this build environment.** Measured
2026-08-13, every attempt returns `EGRESS_BLOCKED` from the agent proxy
(`gateway answered 403 to CONNECT`):

| Source | Result |
| --- | --- |
| `developer.here.com` (Geocoding & Search dev guide) | `EGRESS_BLOCKED` |
| `www.here.com/docs/...` (Routing v8 API reference, truck coverage) | `EGRESS_BLOCKED` |
| `docs.here.com` (routing-v8-truck-routing) | `EGRESS_BLOCKED` |
| `developer.ibm.com` (HERE API mirror) | `EGRESS_BLOCKED` |
| `tc.canada.ca` (Transport Canada, motor carriers) | `EGRESS_BLOCKED` |
| `www.ccmta.ca` (NSC Standard 9, HOS) | `EGRESS_BLOCKED` |

This is the same egress restriction recorded in
`navigator-truck-routing-audit.md` §3, and it has the same consequence: **no new
provider parameter may be added in this milestone**, because none can be confirmed
against the provider's own documentation.

What this milestone does instead is the only safe option available: it **reuses a
parameter already proven in production**. `in=countryCode:USA` has been on every
destination-search request since the search shipped. The Canadian path changes the
three-letter *value* to `CAN` and nothing else — same parameter, same shape, same
endpoint, same host. No new parameter, no new field, no new credential, no account
change, no paid plan.

Secondary corroboration (search-result summaries only, recorded for traceability and
**not** treated as authority for anything that reaches the wire):

- The `in` filter's documented syntax is `countryCode:{code}[,{code}]*` with ISO
  3166-1 **alpha-3**, uppercase — matching the `USA` value already in use, which is
  the strongest evidence available that `CAN` is the correct sibling value.
- HERE Routing v8 lists Canada at a "Moderate" routing coverage level.

**Consequence for the product:** the app never claims Canadian routing works. The
pilot status panel says *"Available where provider coverage exists"*, which is a
statement about what the app will attempt, not a promise about what it will get.

**Canadian legal limits are not encoded anywhere in this change.** No provincial or
federal dimension, weight, or hours limit appears in the diff. The truck profile is
the driver's numbers, entered by the driver, in whichever units they chose. There is
no "Canada legal" preset, and nothing is labelled compliant, legal, or approved.

---

## 2. Compatibility matrix

Legend for **Implemented?** — ✅ done in this milestone · ➖ already correct, unchanged
· ⛔ deliberately out of scope, with the limit stated in the product.

| Surface | Current U.S. behavior | Required Canadian behavior | Data authority | Implemented? |
| --- | --- | --- | --- | --- |
| **Search country filter** | `buildDiscoverUrl` hard-codes `in=countryCode:USA` | Same parameter, value `CAN`; exactly one country per request | HERE discover `in` filter, already in production with `USA`; alpha-3 shape corroborated | ✅ `searchCountryFor(region)` → `'USA' \| 'CAN'`, threaded search box → port → endpoint → builder |
| **Search country validation** | Endpoint had no `country` input | `?country=` accepted, validated to the two known codes, anything else → `USA` | App-side rail; an arbitrary query string must never reach a provider parameter | ✅ `rawCountry === 'CAN' ? 'CAN' : 'USA'` in the route handler |
| **Cross-border search** | Not possible | One deliberate, labelled tap flips which country the box asks about; region, units and truck untouched | Product decision | ✅ "Search Canada / the United States instead" button; `searchRegion` is separate state from `region` |
| **Search debounce / spend rails** | 350 ms debounce, ≤5 candidates, 30/min limiter, no route on typing | All preserved exactly | Existing pilot spend controls | ➖ unchanged; `country` joins the effect deps so a deliberate switch re-runs, and only that |
| **Search fallback centre** | `UNBIASED_SEARCH_CENTER` = CONUS centroid (Kansas) when there is no fix | A Canadian search with no fix must not be measured from Kansas | Geography | ✅ `UNBIASED_SEARCH_CENTER_CA` (62.4 N, 96.5 W); `unbiasedCenterFor(country)` picks it |
| **Fallback-centre distances** | Stripped when unbiased (`stripDistances`) | Same — a distance from a national centroid is not a distance from the truck | Existing honesty rail | ➖ unchanged; applies identically to the Canadian centre |
| **GPS on typing** | Never requested; permission is bound to the Start tap | Same | Existing rail (startup simplification) | ➖ unchanged |
| **Canadian address fields** | HERE's `address.label` rendered verbatim | Province abbreviations, `A1A 1A1` postal codes and accented names must survive | Provider-returned strings | ➖ unchanged; the results are rendered, never parsed, normalised, upper-cased or validated. Pinned so a future "helpful" formatter cannot break it |
| **ZIP validation** | None exists anywhere in the search path | Must stay none — a 5-digit rule would reject every Canadian postal code | — | ➖ verified absent, and pinned |
| **Routing transport mode** | `transportMode=truck` | Identical | HERE Routing v8 | ➖ unchanged |
| **Truck wire parameters** | `truck[height\|width\|length]` in **cm**, `truck[grossWeight]` in **kg**, `truck[axleCount]`, `truck[shippedHazardousGoods]`, `avoid[features]` | Identical — these are already metric and country-neutral | `here-truck-params.ts`, the one mapping authority (PR #310) | ➖ unchanged. This is why Canada needed no routing work |
| **Route request count** | One Start = one route request; no second provider; no car fallback | Identical, including cross-border | Existing spend rail | ➖ unchanged and pinned |
| **Cross-border disclosure** | None | *"Cross-border route. Verify customs documents, permits, border status, and operating hours separately."* before Start | Product requirement | ✅ `role="status"` above Start; **not** a live-map obstruction |
| **Cross-border detection** | None | Must be right in the Windsor/Detroit corridor | Ranked evidence: the destination's provider-filtered country first, then geography, then the driver's declared region | ✅ see §3 |
| **Truck profile internal units** | Canonical feet / pounds throughout | Unchanged — metric is a display and entry concern only | Architecture decision | ➖ unchanged |
| **Truck profile entry** | Feet and pounds only | Metres and kilograms, converted **once** on the way in | `format-units.ts` | ✅ `metersToFeet` / `kilogramsToPounds` at the input edge; presets and placeholders render in the chosen units |
| **Provider request equivalence** | — | An imperial truck and its metric twin must produce identical bytes | Round-trip identity of the conversions | ✅ pinned: the two request URLs compare equal, parameter for parameter |
| **Confirmation fingerprint** | `routingFingerprint()` over the wire values | A unit-only switch must **not** invalidate a confirmed truck | PR #310's fingerprint design | ➖ unchanged and pinned — the fingerprint reads routing meaning, and units are not routing meaning |
| **Unsupported truck fields** | Listed under **Not used for routing** | Same list, same heading | PR #310 honesty rail | ➖ unchanged. `weightPerAxle`, `trailerCount`, `tunnelCategory`, vehicle type remain absent — see §1 |
| **Route distance / remaining** | `formatDriverDistanceMi` — ft under 0.2 mi, else mi | km / m | `format-units.ts` | ✅ `formatDistance(mi, metric)` |
| **Maneuver countdown** | Same formatter | Same, metric | `format-units.ts` | ✅ same entry point |
| **Speed display** | `${Math.round(mph)} mph` inline | km/h | `format-units.ts` | ✅ `formatSpeed(mph, metric)`; the hand-written mph string is gone |
| **GPS accuracy** | `formatAccuracyFt` ("±80 ft") | metres ("±25 m") | `format-units.ts` | ✅ `formatAccuracy(m, metric)`, on the position preview too |
| **Truck dimensions (display)** | `13′6″` | `4.11 m` | `format-units.ts` | ✅ `formatDimension(ft, metric)` |
| **Truck weight (display)** | `80,000 lb` | `36,287 kg` | `format-units.ts` | ✅ `formatWeight(lb, metric)` |
| **"Route planned for" summary** | Driver-unit values from the wire params | Metres and kilograms, describing the **same** request | `sentRestrictionLines(truck, avoid, metric)` | ✅ same line count, same parameters, different words |
| **Briefing distance + corridor roads** | `mi` | `km` | `format-units.ts` | ✅ |
| **Trip summary ("planned miles")** | `X.X planned miles` | metric | `format-units.ts` | ✅ now `formatDistance(...) planned` |
| **Route-plausibility advisory** | *"…doubles back about 12 miles…"*, *"…ends about 2.3 miles from…"* | The same sentences in kilometres | `route-plausibility.ts`, its own sentence formatter | ✅ the **measurement** is unchanged — `measured` stays canonical miles so a threshold, a harness and a diagnostic report keep comparing the same number; only the sentence moves |
| **Voice maneuver distance** | "In half a mile", "In 800 feet" | Metric landmarks a Canadian sign uses — **not** a converted mile | Product decision; see §4 | ✅ `distanceText(mi, metric)` |
| **Road-test / problem report** | `planned miles`, `speed (mph)` | — | Diagnostic artifact | ➖ **deliberately canonical.** The report is copied to the owner, not read by the driver, and every line already names its unit explicitly. Mixing units across reports would make a Canadian driver's report incomparable with a US one |
| **Voice announcement timing** | Speed-scaled tiers in miles | Unchanged — *when* to speak is a routing decision, not a display one | Architecture decision | ➖ unchanged |
| **Imperial mode fidelity** | 13′6″, 80,000 lb, 25.7 mi, ±80 ft | Byte-identical after this change | — | ➖ pinned: `13.5 ft` must never render as "13.6 feet" |
| **HOS engine** | US federal property-carrying limits | Not changed, not extended, not relabelled | FMCSA rules already implemented | ➖ untouched |
| **HOS display in Canada** | Clocks always shown | Clocks replaced, not relabelled, by *"Canadian HOS is not calculated in this pilot. Use your certified ELD as the record."* | Product requirement | ✅ `aria-label="Hours of service — not calculated"` |
| **HOS disclosure at the point of choice** | — | The limit travels with the region control that creates the expectation | Product decision | ✅ *"…Verify your clocks with your ELD."* on the region panel |
| **Navigation usability in Canada** | — | Fully usable; nothing gates Start on region | Product requirement | ➖ verified: no region check reaches a `disabled` |
| **Map renderer / heading-up** | MapLibre GL, heading-up, attribution, Overview/Recenter | Unchanged in Canada; accented road names come from the tiles | PR #309 | ➖ unchanged. No new tile source, provider or dependency |
| **Reload restore** | Trip snapshot under `tlws-navigator-trip-v1`, zero re-spend | Unchanged; the region rides its own key | Existing restore rail | ➖ unchanged |
| **Truck-profile chip on the live map** | Removed in PR #307 | Stays removed | PR #307 | ➖ verified absent |
| **Parking / directory data** | US-built (TA/Petro, Truck Parking Club) | Must not fabricate Canadian results | Data reality | ⛔ *"Canadian parking coverage is limited in this pilot."* No import started; no TPC listings without confirmed authorization |
| **Canadian HOS rules** | — | — | — | ⛔ out of scope, stated in the product in two places |
| **Fleet-demo presentation** | Password gate, build ID, problem reporting | Add a parked Canadian pilot status panel; no internal names, parameters, credentials, debug coordinates or test controls | Product requirement | ✅ six-row status panel; pinned to contain no `HERE`/`API`/`countryCode`/`truck[`/`transportMode`/coordinate |
| **Region inference from GPS** | — | Must never happen | Product requirement | ➖ verified: the region panel reads no position, and no code path writes the region from a fix |
| **Region persistence** | — | Per session | Product requirement | ✅ third versioned key `tlws-navigator-region-v1`, two enum values, nothing else |

---

## 3. Cross-border detection — why the obvious test is wrong

The first implementation compared two coordinates against a latitude half-plane. It
is worth recording why that was replaced, because it looks correct and is not:

**Windsor, Ontario is south of Detroit, Michigan.** They are about three kilometres
apart across the river, and the Canadian city has the lower latitude. No rule of the
form "north of *L* is Canada" can separate them, and the Windsor–Detroit crossing is
the busiest commercial border crossing on the continent — precisely the trip a
Canadian trucking pilot must get right.

The shipped implementation ranks its evidence and refuses to guess:

1. **The destination's country is attested, not inferred.** The driver picked it from
   a search the provider filtered to exactly one country. That is a fact, recorded at
   pick time.
2. **The origin's country comes from geography, and only where geography can
   answer.** `countrySideOf()` returns `'unknown'` across the Great Lakes / St.
   Lawrence corridor rather than answering confidently and wrongly.
3. **Where geography cannot answer** — that corridor, or no fix yet — the driver's
   **declared region** stands in. That is a comparison of two things the driver chose
   on a parked screen, not an inference about their nationality from a GPS reading.

It errs toward showing the notice. An unnecessary reminder to check paperwork costs a
driver two seconds; a missing one costs them a border.

Verified cases: Toronto → Detroit ✅, Windsor → Detroit ✅, Detroit → Windsor ✅,
Vancouver → Seattle ✅ (geography alone), Toronto → Ottawa ✗, Vancouver → Ottawa ✗,
Chattanooga → Nashville ✗, no destination yet ✗.

---

## 4. Metric voice — a translation is not a localisation

"In half a mile" converted is "in 0.8 kilometres". No road sign in Canada has ever
said that. The metric buckets are metric landmarks of their own:

| Distance | Spoken (metric) |
| --- | --- |
| ≥ 1.2 km | "In 3.1 kilometres" (0.1 km precision) |
| ≥ 0.9 km | "In 1 kilometre" |
| ≥ 0.65 km | "In 800 metres" |
| ≥ 0.4 km | "In 500 metres" |
| below | nearest 50 m, floored at 50 |

800 m is a real rung rather than a rounding artefact: the approach tier at highway
speed fires at half a mile, which *is* 800 m, and rounding the most-heard line in the
country up to a kilometre would be the one sentence a Canadian driver notices is
wrong.

The distance being spoken about is identical in both systems. The announcement
tiers, their speed scaling, and the announce-once flags all remain in miles, because
*when* to speak a maneuver is a routing decision and not a display preference.

---

## 5. Rounding rules, stated once

| Quantity | Metric rule | Imperial rule (unchanged) |
| --- | --- | --- |
| Driver distance | < 1 km → nearest 10 m, floor 10 m; ≥ 1 km → 0.1 km | < 0.2 mi → nearest 50 ft, floor 50 ft; ≥ 0.2 mi → 0.1 mi |
| Speed | whole km/h | whole mph |
| GPS accuracy | nearest 5 m, floor 5 m | nearest 10 ft, floor 10 ft |
| Truck dimension | 2 decimal metres (`4.11 m`) | feet and whole inches (`13′6″`) |
| Gross weight | whole kilograms, `en-CA` grouping (`36,287 kg`) | whole pounds, `en-US` grouping (`80,000 lb`) |
| Spoken distance | see §4 | unchanged |

Every one of these lives in `src/lib/navigator/format-units.ts` and nowhere else. No
component holds a conversion factor; that is pinned.

---

## 6. Blockers and limitations, stated plainly

1. **Provider documentation is unreachable** (§1). No new HERE parameter was added.
   If a future milestone needs `weightPerAxle`, `trailerCount`, `tunnelCategory` or a
   vehicle type, it must first reach the provider's documentation from an environment
   with egress.
2. **Canadian truck-routing quality is unverified by us.** The app sends the correct
   request; whether HERE returns a truck-appropriate Canadian route is the provider's
   coverage, and the product says only "available where provider coverage exists".
3. **Canadian HOS is not implemented.** Stated in the product twice, verbatim.
4. **Canadian parking coverage is not imported.** Stated in the product, verbatim.
5. **Cross-border detection is a reminder, not a border service.** It does not know
   crossing wait times, permit requirements, or customs status, and says so.
6. **The region is a preference, not a jurisdiction.** It changes search and display.
   It is not a compliance mode and nothing in the UI implies it is.

### 6a. A pre-existing wart, found while auditing and deliberately NOT changed here

The truck editor's height presets are `[13.5, 13.6, 14]` **decimal feet**, and in
US mode the buttons render as bare decimals: `13.5`, `13.6`, `14`.

`13.6` is not 13′6″. 13′6″ is `13.5` ft; `13.6` ft is 13′7¼″. A driver whose cab
card says 13′6″ can reasonably tap the button that reads `13.6`.

**Why it was left alone in this PR:**

- It predates this milestone (it arrived with the editor in PR #310) and has
  nothing to do with Canadian compatibility.
- The failure direction is **conservative**: the truck is declared ~3 cm taller
  than it is, so the route returned is more restrictive, never less. No truck is
  sent under a bridge it does not fit.
- The milestone instruction is explicit that imperial display must be preserved
  exactly as it is today. Changing how US-mode feet render is a change to that
  display, and it belongs in its own change with its own harness updates.

**Recommended fix, for a separate change:** render feet fields through the
existing `formatDimension(ft, false)` authority so the buttons read `13′6″`,
`13′7″`, `14′0″` — unambiguous, no stored or wire value altered — and revisit
whether `13.6` was meant to be a distinct preset at all. Note that the
`Route planned for` summary **already** reads `13′6″` correctly, because it goes
through that authority; it is only the editor that does not.

---

## 7. What was deliberately not done

Per the milestone's scope: no Trip Planner work, no Canadian HOS, no Canadian parking
import, no fleet accounts. No change to secrets, environment variables, HERE account
settings, tile providers, billing, Supabase, database schema, CSP, or Netlify
configuration. No additional routing, search, or mapping provider.

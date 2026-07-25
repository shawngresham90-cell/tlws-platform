# Batch 75 — Pennsylvania I-76 / I-80 / I-81 (+ connectors): Source Report

**Status: SCAFFOLD — listing rows PENDING a networked verification run.**

This batch follows the exact manual-verification method used by every prior
corridor batch (I-75, I-95, I-40, I-65, I-24, …): every listing web-verified
against an **official operator or government source as the primary**, with **≥2
corroborating independent sources**, a per-row **verified date**, **no invented
fields** (anything a source does not state is left blank), no bulk scraping, no
paid APIs, and **no coordinates** (geocoding is a separate verified workflow).

## Egress blocker (why this batch ships as a scaffold, not verified rows)

In this execution environment, outbound page fetching is **policy-denied**.
`WebFetch` returns HTTP **403 Forbidden** for every host tried — the official
operator locators (`loves.com`), the corroborating directories
(`truckstopsandservices.com`), and even neutral references (`wikipedia.org`).
The pre-configured agent proxy is healthy (`recentRelayFailures: []`), so this
is an organization egress policy, not a transient error, and per the proxy
guidance such 403 denials must be reported, not retried or routed around.

`WebSearch` is available, but it returns **model-synthesized summaries**, not
dereferenceable primary-source pages. Recording a business's street address,
phone, or amenity set from a search summary that cannot be opened and confirmed
against the operator's own page would (a) fail the "official primary + ≥2
corroborating sources per listing" rule and (b) risk inventing a field — the one
thing the method forbids. **Therefore no PA listing rows were written.** The
method's rule is explicit: *blank when unverifiable* — and here nothing can be
verified to standard, so nothing is asserted.

## What IS in this batch

- `…-batch-075.csv` — the canonical import template (header only, 0 data rows),
  which passes the 32-column schema check (20 recognized columns, 0 unknown,
  name + category present).
- This source report (method + corridor plan + blocker).
- `…-batch-075-review.md` — review notes and pending-status record.
- `…-batch-075-validation.md` — the harness results proving the template is
  structurally clean and the PA dedup baseline.

## Corridor plan (for the future networked run to fill in)

PA is **uncovered**: **0** live Pennsylvania listings in production (verified
read-only, 2026-07-24), so no dedup avoid-list is required — but every row the
networked run adds must still be checked against live PA at fill-in time.

Target corridors and the exit nodes a verifier should work, west→east / N→S:

- **I-76 (Pennsylvania Turnpike mainline)** — the ticketed system's service
  plazas are the primary truck-serving facilities: New Stanton, Somerset,
  Sideling Hill, Plainfield, Highspire, Bowmansville, Peter J. Camiel
  (Valley Forge), King of Prussia. Turnpike interchanges at Breezewood
  (I-70 jct), Bedford, Somerset, Donegal, New Stanton, Carlisle (I-81 jct),
  Harrisburg, Reading/Lancaster, Valley Forge.
- **I-80 (across the northern tier)** — the classic truck-stop corridor:
  Sharon/Mercer (Exit 4/15), Clarion, Brookville (Exit 78/81 area),
  DuBois, Snow Shoe, Milton/Lewisburg (Exit 210–215), Bloomsburg,
  Hazleton (I-81 overlap area, Exit 256+), Stroudsburg (Exit 302–310).
- **I-81 (Cumberland Valley → Scranton)** — Carlisle (I-76 jct, a major
  truck-stop cluster), Harrisburg, Jonestown/Lebanon (Exit 90 node),
  Frackville, Hazleton, Wilkes-Barre, Scranton, Great Bend (NY line).
- **Connectors** — I-70 (Breezewood → I-76), I-78 (Harrisburg → Allentown),
  I-83, I-84, I-380, US-15/I-99 where they carry interstate truck traffic.

Facility types to include (only genuinely-existing ones): truck stops / travel
centers (Love's, Pilot/Flying J, TA/Petro, Sheetz truck-diesel, independents),
Turnpike service plazas, PennDOT rest areas / welcome centers, fixed weigh
stations / ports of entry, CAT scales, and tire/roadside-repair operators.

## Source hierarchy the networked run must apply (unchanged from prior batches)

1. **Primary (required):** the operator's own locator page (loves.com,
   pilotflyingj.com, ta-petro.com, sheetz.com) or the government operator
   (paturnpike.com for service plazas; penndot.pa.gov / 511PA for rest areas
   and weigh stations).
2. **Corroborating (≥2, independent):** iExit, Allstays, TruckMap, Find Truck
   Service, truckstopsandservices.com, CAT Scale locator, coopsareopen.com,
   state rest-area guides.
3. Leave blank anything not stated by a source. No coordinates. No phone,
   address, or amenity guessed from context.

- Records in CSV: **0** (scaffold).
- Pennsylvania existing production listings: **0** (verified live, read-only).

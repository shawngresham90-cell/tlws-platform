# TA/Petro closeout — pre-state, manifest, and dry-run record (2026-07-27)

Authorization: tightly scoped closeout of the four route-usable gaps. No
Pilot/Love's work, no merge. Fingerprints and full pre-state captured
read-only BEFORE any write; this file and CLOSEOUT-ROLLBACK.sql were
committed to disk before execution.

## Pre-execution fingerprints (measured)

| Fingerprint | Value |
|---|---|
| Control digest (1,161 rows outside TA scope) | `64d573283c8c0e35bd39c73bb63819d3` |
| Control digest MINUS beb05d53 (survives a legitimate Correction B) | `20f4d5e101205059e301bc72e11b194a` |
| TA scope rows / id digest | 395 / `52d4c84e71b50adcecc2956a51c58274` |
| Imported name+state / value digests | `e7843f74…` / `2ac6c659…` |
| Counters | live 1556 · published 1165 · with_coords 560 · pub_unmappable 609 · featured 0 · indexable 0 · deleted 0 |
| Overnight true in scope | 30 |

## 1. Site 0269 — TA Knoxville West (EXECUTED)

Row `cd4783d1-b67c-4c09-b056-6a72f5606229` · pre-state: published, 615 Watt
Rd Knoxville TN 37922, lat/lng NULL, parking_spaces 176, no geocode metadata.

| Field | Before | After |
|---|---|---|
| lat / lng | NULL / NULL | 35.8731 / −84.2379 (official master, site 0269) |
| geocode_source | NULL | batch-csv |
| geocode_confidence | NULL | high |
| coord_verification_status | NULL | machine-checked |
| last_geocoded_at | NULL | now() |
| parking_spaces | 176 | **176 — not in the SET list, cannot change** |
| is_published / is_featured / is_indexable | true / false / false | unchanged |

Same-site exception (one record, exact-ID): the global collision guard is
unmodified; the transaction excludes exactly two named UUIDs after re-proving
each is live, published, a companion category, names TA Knoxville West / #269,
and already holds exactly 35.8731/−84.2379:

- `7ac0bc00-385a-48e5-875a-1576872a51f5` "CAT Scale — TA Knoxville West #269,
  Knoxville (Watt Road)" · cat-scales · published · 35.8731/−84.2379 ✓
- `46c70f80-8582-44d1-a7b6-ea9423392fea` "TA Truck Service - TA Knoxville
  West" · tire-repair · published · 35.8731/−84.2379 ✓

Dry-run: 2 rows in radius, 2 qualify for the exception, **0 non-exempt
colliders**.

## 2. Correction A — Atlanta South duplicate (EXECUTED)

`33e41d22-1dac-425b-a17d-c9b6affcda21` "TA Atlanta South #268" (legacy,
published, 122 Truck Stop Way, 33.205898/−84.058286, 108 spaces,
overnight_parking=true).

| Field | Before | After |
|---|---|---|
| is_published | true | false |
| everything else, including overnight_parking and coordinates | — | unchanged |

Guards, all dry-run-verified before execution: duplicate in exactly the
reconciled state (1), twin `15de1227` published + mappable + imported from the
official master and bound to official site 0268 by the committed
reconciliation (1), expected-row-count 1, nothing deleted, twin still
published post-write. The site cannot lose its only pin: the twin's liveness
is a hard precondition.

## 3. Sites 0001 / 0142 — Ashland & Richmond (QUARANTINED, no write)

Required verification: exact street address (100 N Carter Rd ↔ site 0001;
10134 Lewistown Rd ↔ site 0142); city/zip/name alone forbidden.

Measured pre-state: **both candidate rows carry `address = NULL`** —
`e36e07df…` "TA Ashland (TravelCenters of America)" and `7a03c1f5…`
"TA Richmond (TravelCenters of America)", both Ashland VA 23005, unpublished,
blank coordinates and spaces. With no stored street address there is nothing
to match against, and writing the official address onto a row chosen by name
would make the "verification" circular. Unique identity is NOT proven →
both rows stay quarantined, unpublished and untouched, per the authorization.

Unblock path: any independent record of either row's street address
(historical import file, original CSV source, page history) would anchor an
exact-address match.

## 4. Site 0393 — Petro Florence (QUARANTINED, no write)

Cross-brand proof CONFIRMED from both committed official exports:
- Love's export line: store 420 = 730 Highway 80 E, **Flowood, MS** 39232.
- TA master site 0393 = Petro Florence, 3001 TV Rd, Florence SC,
  34.2665/−79.7321, 210 spaces — exactly row `beb05d53…`'s address.
- Row pre-state matches the prepared §B precondition exactly: unpublished,
  3001 TV Rd, zip 29501, blank lat/lng/spaces, name "Love's Travel Stop #420".
- Name "Petro Florence" free in SC ✓ · detail_slug free ✓.

**Failed check — collision**: published pin `33dd16f0-9cfc-486e-822f-83fe6ecf8197`
"Blue Beacon Truck Wash #51 - Florence" (3003 TV Rd, truck-washes,
34.266664/−79.730662) sits inside the collision box of the official 0393
coordinate (Δlat 0.000164, Δlng 0.001438). This is almost certainly the same
complex's co-located truck wash — the same shape as Knoxville — but the
granted same-site exception was **one record, exact-ID, for site 0269 only**,
and the authorization for B required the collision check to pass exactly.
It did not. The prepared §B statement stays unexecuted; its own guard is what
blocks it. No relabel, no publication, no field written.

Unblock path: a one-record, exact-ID exception for `33dd16f0…` analogous to
the 0269 exception (published companion category, names the complex, already
holds a coordinate inside the box).

## Post-execution audit (measured after parts 1 and 2 committed)

| Check | Result |
|---|---|
| 0269 row: official coordinate + metadata, spaces 176, published, not featured/indexable | exact ✓ |
| Atlanta dup unpublished, coordinates + overnight flag intact | ✓ |
| Twin `15de1227` still published & mappable; exactly 1 published Atlanta South pin | ✓ |
| beb05d53 / both Ashland rows / 74398e08 untouched | ✓ (1 / 2 / 1) |
| Counters | published 1165→**1164** · with_coords 560→**561** · pub_unmappable 609→**608** · live 1556, featured 0, indexable 0, deleted 0 unchanged |
| Control digest | `64d573283c8c0e35bd39c73bb63819d3` — unchanged |
| Scope 395 / id digest / imported digests / overnight 30 | all unchanged |
| Published truck-stop pin collisions in TA scope | **0** (the Atlanta pair is resolved) |
| Route-usable (distinct official Site IDs) | **344 of 347** — 344 rows now map 1:1 to sites |

## Would-be before→after for B (NOT applied — recorded for the future decision)

| Field | Current | Would become |
|---|---|---|
| name / slug / detail_slug | Love's Travel Stop #420 / love-s-travel-stop-420 / love-s-travel-stop-420-florence-sc | Petro Florence / petro-florence / petro-florence-florence-sc |
| lat / lng | NULL / NULL | 34.2665 / −79.7321 |
| parking_spaces | NULL | 210 |
| geocode metadata | NULL | batch-csv / high / machine-checked / now() |
| is_published | false | false during correction; separate guarded publish only after every gate passes |

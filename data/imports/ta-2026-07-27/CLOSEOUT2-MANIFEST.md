# TA/Petro closeout 2 — the final three gaps (2026-07-27)

Authorization: independent official TA public-page evidence replaces the
earlier address-only identity requirement for sites 0001/0142; Correction B
authorized with a one-record, exact-ID exception for the Blue Beacon pin;
publication authorized per-site after gates. No Pilot/Love's bulk work, no
Flowood insert, no merge. This manifest and CLOSEOUT2-ROLLBACK.sql were
committed BEFORE execution.

## Source evidence, cross-checked

The sha256-verified official artifact (`locmaster20260727.xlsx`,
`a0c612f0…63f7`) reproduces EVERY fact of the cited official pages:

| Site | Official page | Artifact row |
|---|---|---|
| 0001 TA Ashland | ta-petro.com/location/va/ta-ashland/ — 100 North Carter Rd, Ashland VA 23005-0712, 804-798-6011, 183 spaces | identical, + coordinate **37.7598 / −77.4631** (Location ID 5045) |
| 0142 TA Richmond | ta-petro.com/location/va/ta-richmond/ — 10134 Lewistown Road, Ashland VA 23005, 804-798-6021, 317 spaces | identical, + coordinate **37.7237 / −77.4479** (Location ID 210) |
| 0393 Petro Florence | (prior proof) | 3001 TV Rd., Florence SC 29501, 843-669-5736, **34.2665 / −79.7321**, 210 spaces (Location ID 6393) |

The page names bind each address to a distinct row name — the identity
anchor the null-address rows lacked. Love's export line 293 still puts
store #420 at 730 Highway 80 E, **Flowood MS** 39232.

## Pre-write fingerprints (measured after closeout 1, re-verified in guards)

control digest `64d573283c8c0e35bd39c73bb63819d3` · control-minus-beb
`20f4d5e101205059e301bc72e11b194a` (the invariant that survives C) ·
scope 395 / `52d4c84e…` · imported `e7843f74…` / `2ac6c659…` ·
live 1556 · published 1164 · with_coords 561 · pub_unmappable 608 ·
featured 0 · indexable 0 · deleted 0 · overnight-in-scope 30.

Dry-runs: 0 published pins collide with 37.7598/−77.4631; 0 with
37.7237/−77.4479; the 0393 radius holds exactly one row — Blue Beacon
(`33dd16f0…`, published, truck-washes, existing coordinate). Exactly two
truck-stop rows exist for Ashland VA, uniquely named, both unpublished with
NULL address/phone/coordinates — no contradiction, no third candidate.

## A. `e36e07df…` — TA Ashland, site 0001

| Field | Before | After |
|---|---|---|
| address | NULL | 100 North Carter Rd |
| phone | NULL | 804-798-6011 |
| lat / lng | NULL | 37.7598 / −77.4631 |
| parking_spaces | NULL | 183 |
| geocode metadata | NULL | batch-csv / high / machine-checked / now() |
| is_published | false | **true** (same transaction, after gates) |
| zip | 23005 | 23005 — nonblank, never overwritten (official 23005-0712 is compatible) |
| is_indexable / is_featured / overnight | false | unchanged |

## B. `7a03c1f5…` — TA Richmond, site 0142

| Field | Before | After |
|---|---|---|
| address | NULL | 10134 Lewistown Road |
| phone | NULL | 804-798-6021 |
| lat / lng | NULL | 37.7237 / −77.4479 |
| parking_spaces | NULL | 317 |
| geocode metadata | NULL | batch-csv / high / machine-checked / now() |
| is_published | false | **true** (same transaction, after gates) |
| zip / flags | | unchanged |

Cross-assignment guard: the Ashland-named row must receive the Carter Rd
identity and the Richmond-named row the Lewistown identity; each transaction
asserts the row's name contains its own site's name token and NOT the
other's, and the two official coordinates/addresses are distinct constants.

## C. `beb05d53…` — Petro Florence, site 0393 (two transactions)

Correction (stays unpublished):

| Field | Before | After |
|---|---|---|
| name / slug / detail_slug | Love's Travel Stop #420 / love-s-travel-stop-420 / love-s-travel-stop-420-florence-sc | Petro Florence / petro-florence / petro-florence-florence-sc |
| lat / lng | NULL | 34.2665 / −79.7321 |
| parking_spaces | NULL | 210 |
| geocode metadata | NULL | batch-csv / high / machine-checked / now() |
| website (stale Love's attribution) | https://www.loves.com/locations/420 | NULL — removed, no invented replacement |
| description (stale Love's attribution) | "Love's at I-95 Exit 169 (TV Rd, Florence) with …" | "Petro Florence (Petro Stopping Center) at I-95 Exit 169 (TV Rd, Florence) with …" — identity token replaced, remainder verbatim |
| is_published | false | false — publication is the separate transaction below |
| address / zip / city / state / exit / interstate / amenities / flags | | unchanged |

One-record exception, embedded in this transaction only: the collision
check excludes exactly `33dd16f0-9cfc-486e-822f-83fe6ecf8197`, and only
after re-proving it is published, categorized truck-washes, named Blue
Beacon #51, and still holds its existing coordinate (34.266664/−79.730662).
Any other row in the radius aborts. The global guard is unmodified.

Publish (separate guarded transaction, only after the correction audit):
`is_published` false → true, with gates re-proven: correct Petro identity,
coordinate, positive spaces, category, slugs, not featured/indexable, and
the radius still containing only Blue Beacon.

## Post-execution audit — ALL MEASURED, all passed

- A/B/C rows verified field-exact against this manifest (1/1/1); Blue Beacon
  proven untouched at its own coordinate; Petro Florence published in the
  separate transaction only after re-proving the audited state and the
  radius still holding only the exempted record.
- Counters: live 1,556 · published 1164→**1167** · with_coords 561→**564** ·
  pub_unmappable **608** unchanged · featured 0 · indexable 0 · deleted 0.
- `control_minus_beb` digest `20f4d5e101205059e301bc72e11b194a` —
  **byte-identical**: every row outside the TA scope except the corrected
  Florence row is unchanged. Scope 395→396 (the corrected row entered under
  its official name). Imported digests unchanged; overnight-in-scope 30;
  Goasis/Thorntons 0; deleted-in-scope 0.
- **Route-usable: 347 rows, 0 truck-stop pin-collision pairs → 347 distinct
  official Site IDs. Gate 4a = 348/348 ✅. Gate 4b = 347/347 ✅.**

Live pages (`/directory/location/<detail_slug>`):
`ta-ashland-travelcenters-of-america-ashland-va` ·
`ta-richmond-travelcenters-of-america-ashland-va` ·
`petro-florence-florence-sc`.

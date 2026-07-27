# Quarantine review — all 14 execution quarantines, plus conflicting record #749

Read-only review, 2026-07-27, under the Pilot closeout authorization. **No
quarantined row was modified.** Nothing here corrects, publishes, unpublishes,
inserts or grants a collision exception — every recommendation below requires
its own explicit authorization first.

Evidence sources: the checksummed official export (`all_locations.csv`,
sha256 `d39ab57d…e330a`), the committed reconciliation
(`data/sources/pilot-master/2026-07-27/`), and fresh read-only queries against
the live directory (nearest published pins within a ±0.004° window; the insert
guard's own box is ±0.0015° per axis, ~150 m).

## A. Insert quarantines — coordinate adjacency (8 records)

Every one of the eight is a **published official-TA-network pin at a shared
interchange**, written earlier on 2026-07-27 under the merged TA authorization.
In each case the official Pilot-network address and brand differ from the
neighbour, and the official export carries both operators separately — the
classic multi-operator exit. All eight are classified **legitimate separate
locations**; none looks like a duplicate of the TA pin.

| Official ID · brand | Official name, address, coords, spaces | Proposed action | Nearest published pin (id · category · distance) | Classification | Recommendation / narrow exception required |
|---|---|---|---|---|---|
| **#282** · Pilot | Pilot Travel Center #282, 2591 Commerce Pkwy, Barstow CA 92311 · 34.8549172, −117.0874803 · 18 | Net-new insert (official values, unpublished) | `5c4f1bd6` TA Barstow · truck-stops · **181 m** | Legitimate separate location | Insert under a **one-record exemption naming `5c4f1bd6`** in the adjacency guard (the TA-closeout 0269/0393 pattern); guard text otherwise unchanged |
| **#46** · ONE9 | ONE9 Travel Center #46, 2929 Scottsville Rd, Franklin KY 42134 · 36.716046, −86.525849 · 35 | Net-new insert | `ce461491` TA Truck Service Franklin · truck-stops · **132 m**; also import sibling `112c5f71` Pilot #438 at 200 m (outside the guard box) | Legitimate separate location — three-operator exit (I-65 Exit 6) | One-record exemption naming `ce461491` |
| **#17** · Pilot | Pilot Travel Center #17, 15901 11 Mile Rd, Battle Creek MI 49014 · 42.3029752, −85.0824189 · 75 | Net-new insert | `92690d91` TA Battle Creek · truck-stops · **109 m** | Legitimate separate location (I-94 Exit 104) | One-record exemption naming `92690d91` |
| **#266** · Pilot | Pilot Travel Center #266, 2681 W Amador Ave, Las Cruces NM 88005 · 32.2965151, −106.8102598 · 28 | Net-new insert | `811fb0fb` TA Las Cruces · truck-stops · **176 m** (per-axis inside the box) | Legitimate separate location (I-10 Exit 139) | One-record exemption naming `811fb0fb` |
| **#387** · ONE9 | ONE9 Travel Center #387, 791 10th St, Carlin NV 89822 · 40.7197077, −116.1061135 · 60 | Net-new insert | `704ccbb5` TA Express Carlin · truck-stops · **165 m** | Legitimate separate location (I-80 Exit 280) | One-record exemption naming `704ccbb5` |
| **#303** · Pilot | Pilot Travel Center #303, 905 American Rd, Napoleon OH 43545 · 41.4164809, −84.1048044 · 75 | Net-new insert | `5d0a8618` Petro Napoleon · truck-stops · **149 m** | Legitimate separate location (US-6/24 Exit 41) | One-record exemption naming `5d0a8618` |
| **#12** · Pilot | Pilot Travel Center #12, 3430 Libbey Rd, Perrysburg OH 43551 · 41.5226873, −83.4622287 · 23 | Net-new insert | `3032b5f3` TA Toledo · truck-stops · **133 m** | Legitimate separate location (I-80/90 Exit 71) | One-record exemption naming `3032b5f3` |
| **#195** · Pilot | Pilot Travel Center #195, 91485 Biggs Rufus Hwy, Wasco OR 97065 · 45.6694389, −120.8349498 · 37 | Net-new insert | `1c2e6308` TA Express Biggs Junction · truck-stops · **70 m**; import sibling `0506ddee` EZ Trip #1226 at 238 m | Legitimate separate location, but the **closest pair of all eight** — Biggs Junction clusters several operators on one frontage | One-record exemption naming `1c2e6308`, **plus independent official-page/street evidence for #195's own parcel before applying** (the 70 m gap deserves a second source) |

## B. Insert quarantines — store-number guard (2 records)

| Official ID · brand | Official name, address, coords, spaces | Proposed action | Clashing row | Classification | Recommendation / narrow exception required |
|---|---|---|---|---|---|
| **#35** · Pilot | Pilot Travel Center #35, 6424 W Brick Rd, South Bend IN 46628 · 41.736021, −86.336832 · 70 | Net-new insert | `1f830c7e` **Family Express #35** · truck-stops · published · coordless · Rensselaer IN, 8805 W State Road 114 — a **different city ~55 mi away** | **Store-number false positive** — Family Express is an unrelated regional chain whose store numbering collides with Pilot's | Add `family express` to the third-party name-prefix exclusion list (`southern tire mart|speedway|blue beacon|pro stop`). This *scopes* the guard to the brands it was written for — it does not weaken the duplicate check for actual network numbers. Then insert #35 normally, no per-record exemption needed |
| **#700** · Flying J | Flying J Travel Center #700, 26415 Warns Dr, Perrysburg OH 43551 · 41.5346888, −83.4607348 · 150 | Net-new insert | `861f3ac4` **CAT Scale — Flying J Travel Center #700, Perrysburg** · cat-scales · published · coordless · **same address 26415 Warns Dr** | **Same-complex companion** — the site's own colocated CAT-scale service row (which, per the map-pin rule, deliberately carries no coordinate) | Restrict the store-number clash candidates to `category_slug = 'truck-stops'` (or extend the CAT exclusion to the `^CAT Scale —` name format). A service row that exists *because* the site exists must not block the site's own pin row. Then insert #700 normally |

## C. Enrichment quarantines — published-pin collision (4 records)

These four pre-existing rows were **not enriched at all** (they remain
coordless), because the coordinate each would receive lands within the
±0.0015° box of an already-published pin. They are also the reason the Phase A
publication set is 25 and not 29.

| Official ID · brand | Official values (coords · spaces) | Target row (unenriched) | Colliding published pin(s) (id · category · distance) | Classification | Recommendation / narrow exception required |
|---|---|---|---|---|---|
| **#1330** · ONE9 | 2101 US-49, Brinkley AR · 34.9125443, −91.1962187 · 42 | `69f1f244` ONE9 Travel Center (Pilot Company), Brinkley | `e945424b` Diesel Truck Repairs · roadside-service · **48 m** (csv-import legacy pin) | Probably legitimate separate — but at 48 m the low-trust legacy pin may actually sit **on the ONE9 parcel** | Verify the Diesel Truck Repairs pin against its own street address first. If it is genuinely a neighbour: one-record exemption naming `e945424b`, then enrich + publish #1330. If its pin is misplaced onto the ONE9 lot, correcting *that* row is a separate authorization |
| **#1550** · Pilot | 1600 County Road 437, Cullman AL (Good Hope) · 34.1168650, −86.8637400 · 72 | `d7247403` Pilot Travel Center #1550 (Good Hope) | `f972d0f0` Jack's Truck Stop · truck-stops · **93 m** and `0e24e007` its truck wash · truck-washes · **93 m** (the two legacy rows share one identical coordinate) | Likely legitimate separate — an independent truck stop at the same I-65 Exit 304; the shared-coordinate pair is itself one of the 29 pre-existing duplicate-pin groups | One-record exemption naming both `f972d0f0` and `0e24e007` after confirming Jack's parcel is distinct; flag the Jack's/wash shared pin for the legacy dedup backlog |
| **#353** · Pilot | 110 Triport Rd, Georgetown KY · 38.2760555, −84.5533554 · 175 | `a8a32662` Pilot Travel Center #353 | `076b546a` Motel 6 Georgetown · hotels-truck-parking · **153 m**; `5b586188` First American Truck Wash · truck-washes · **173 m** | Legitimate separate — both colliding pins are different-category neighbours inside the box at I-75 Exit 129 | One-record exemption naming `076b546a` and `5b586188`, then enrich + publish #353 |
| **#95** · Pilot | 493 FL-44, Wildwood FL · 28.8739185, −82.0951580 · 10 | `76f653aa` Pilot Travel Center #95 (Wildwood, 493 SR 44) — DB address matches the official address | `245d9e0f` TA Wildwood · truck-stops · **172 m** (per-axis inside the box) | Legitimate separate cross-operator neighbour (I-75 Exit 329); the DB row's own address equals the official #95 address | One-record exemption naming `245d9e0f`, then enrich + publish #95 |

## D. Conflicting record #749 VA — kept separate

| | |
|---|---|
| Official | **Flying J Travel Center #749**, 24279 Rogers Clark Blvd, Ruther Glen VA 22546 · 37.9329286, −77.4729755 · **199 spaces** · I-95 Exit 104 |
| Directory row | `9b0bb934` "Flying J Travel Plaza #749 (Carmel Church)" · truck-stops · **unpublished, coordless** · address **23866 Rogers Clark Blvd** |
| The contradiction | 23866 Rogers Clark Blvd is the official address of **#876 Flying J Ruther Glen** — the site inserted and published in the canary. The stale row pairs #749's store number with #876's street address. Meanwhile **no pin of any kind exists within ±0.004° of official #749's coordinate** — the real #749 site is entirely unrepresented |
| Classification | **Unresolved conflict** (store number matches, street address contradicts — exactly why enrichment was refused) |
| Recommendation | Obtain independent official-page evidence for #749 (the TA-closeout Ashland/Richmond pattern). Then, under a one-record exact-UUID authorization, either **(a)** correct the stale row's address/identity to official #749 and enrich it, or **(b)** insert #749 net-new from official values and review the stale row as a duplicate-of-#876 candidate. Until then: no SQL, row stays unpublished and untouched |
| Narrow exception required | None yet — the blocker is identity evidence, not a guard |

## Summary

- **12 of 14** quarantines look like legitimate separate locations blocked by
  correct, working guards at dense interchanges (8 TA adjacencies + 4
  enrichment collisions, one of which — #1330 — needs a pin-accuracy check
  first).
- **2 of 14** are guard-scoping false positives (#35 Family Express, #700
  own-CAT-scale) fixable by narrowing the guard's *candidate set*, not its
  strength.
- **#749 VA** is the only true data conflict and needs page evidence before
  any write.
- Fully resolving all 15 records (14 quarantines + #749) under the
  recommendations above is what closes Gate 3a from 809 → **820** and, with
  the 25-row publication and the four repaired enrichments, Gate 3b from
  763 → **803**.

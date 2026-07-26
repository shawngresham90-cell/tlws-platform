# Northeast corridor — coverage analysis & candidate prep (read-only)

Read-only preparation for the next directory expansion, focused on the verified
Northeast gaps (I-95 corridor and its feeders). **No rows were inserted,
published, or modified.** All figures are live read-only query results
(2026-07-26). Held/excluded networks (Love's, Sapp Bros, Pilot/Flying J, Goasis,
Thorntons) and manual-review records are kept out of the candidate set.

## 1. Verified full-directory coverage (the DE/MD ambiguity, resolved)

Earlier reports called DE and MD "uncovered." Against the **whole** table
(published + unpublished) that is wrong — they have directory rows that are
merely **unpublished**. Corrected picture for the Northeast:

| State | Total rows | Published | Unpublished | TA/Petro (all pub) | Notes |
|---|--:|--:|--:|--:|---|
| PA | 14 | 14 | 0 | 14 | TA/Petro only; strong corridor spine (I-80/81/76/70/90) |
| NY | 7 | 7 | 0 | 7 | TA/Petro only |
| NJ | 4 | 4 | 0 | 4 | TA/Petro only |
| CT | 3 | 3 | 0 | 3 | TA/Petro only |
| RI | 1 | 1 | 0 | 1 | TA/Petro only |
| NH | 1 | 1 | 0 | 1 | TA/Petro only |
| **MD** | **38** | **0** | **38** | 0 | **has data, all unpublished** (csv-import) |
| **DE** | **10** | **0** | **10** | 0 | **has data, all unpublished** (csv-import) |
| **MA** | **0** | 0 | 0 | 0 | **truly empty** |
| **ME** | **0** | 0 | 0 | 0 | **truly empty** |
| **VT** | **0** | 0 | 0 | 0 | **truly empty** |

So the Northeast splits three ways, and the right *action* differs per group:

1. **PA/NY/NJ/CT/RI/NH** — already published (TA/Petro). Thicken later via new
   sourcing; nothing to prepare now.
2. **MD/DE** — coverage **already exists but is unpublished**. The work is
   *publish + enrich the existing rows*, not source new ones. Needs a separate
   publish authorization (like the TA/Petro canary→full flow).
3. **MA/ME/VT** — genuinely empty. Net-new sourcing required.

## 2. Candidate sources evaluated

- **Operator master (`locmaster20260725.xlsx`)** — authoritative, in-repo. Its
  Northeast TA/Petro rows: MD 3, PA 15, NY 7, NJ 4, CT 3, RI 1, NH 1; **MA/ME/VT/
  DE = 0**. The 3 MD rows (TA Elkton 1400 Elkton Rd; TA Jessup 7401 Assateague
  Dr; TA Baltimore 5501 O'Donnell St) **dedupe exactly** to existing unpublished
  MD csv-import rows (TA Elkton #019, TA Baltimore South #151, TA Baltimore
  #216). PA 15 vs 14 published likewise resolves to already-present rows. **Net-new
  authoritative Northeast candidates from the master: 0.**
- **Official web (TA/Petro site, state DOT, Wikipedia)** — the sandbox egress
  policy blocks WebFetch to these hosts (HTTP 403); per the proxy README it must
  not be routed around. So net-new sourcing for MA/ME/VT (and any non-TA/Petro
  brand) **cannot meet the evidence standard from here** and is deferred, not
  guessed.

## 3. Candidate inventory (MD/DE) — already in the DB, unpublished

These are existing unpublished rows, deduped by definition (they ARE the live
rows). Excludes Pilot/Flying J (held networks) and non-directory service rows
(tow, tire, CDL schools, weigh stations, hotels). `interstate`/`exit` are the
operator/DOT designations where the row or master supplies them; coordinates are
absent on these csv-import rows and would need geocoding before publish.

| Name | Category | City, ST | Interstate/Exit | Dedup | Confidence | Recommended action |
|---|---|---|---|---|---|---|
| TA Baltimore South #151 | truck stop | Jessup, MD | I-95 / Exit 41A | exists (unpublished) | high | publish + geocode + enrich |
| TA Baltimore #216 | truck stop | Baltimore, MD | I-95 / Exit 57 | exists (unpublished) | high | publish + geocode + enrich |
| TA Elkton #019 | truck stop | Elkton, MD | I-95 / Exit 109B | exists (unpublished) | high | publish + geocode + enrich |
| Maryland House Travel Plaza | travel plaza | Aberdeen, MD | I-95 / MM 82 | exists (unpublished) | high | publish + geocode |
| Chesapeake House Travel Plaza | travel plaza | North East, MD | I-95 / MM 97 | exists (unpublished) | high | publish + geocode |
| Biden Welcome Center (I-95 Service Plaza) | rest/parking | Newark, DE | I-95 | exists (unpublished) | high | publish + geocode |

MD/DE also hold Pilot #290, Flying J #784/#875 (held networks — **excluded**),
and ~40 service/school/weigh/tow/hotel rows (not truck-stop directory
candidates; some may fit the directory's service categories in a later pass).

## 4. Net-new sourcing needed (deferred — egress-blocked)

| Gap | What's needed | Blocker |
|---|---|---|
| MA (I-90/I-95/I-495) | Independent + travel-plaza truck stops (MassPike service plazas) | official web sources 403 |
| ME (I-95) | Truck stops along I-95 (Kennebunk plazas, etc.) | official web sources 403 |
| VT (I-89/I-91) | Limited truck-stop inventory | official web sources 403 |

**Method for when egress is available** (or a supplied data file): pull the
official operator/DOT listing per state → normalize to the import schema
(name, category, address, city/state/zip, coords, interstate `I-<n>`, exit
`<n>[A-Z]`) → dedupe against the entire live table by the two directory keys
(`detail_slug`; `type|state|city|slug`) and by name+city+state and coordinate
proximity → hold anything matching a held network → import via the existing
guarded pipeline (canary → passes), unpublished, then a separate publish step.

## 5. Ranked next Northeast work

1. **Publish + enrich the existing MD/DE rows** (highest value/effort: data
   already present). Geocode the 6 truck-stop/plaza candidates above, set
   interstate/exit from the operator/DOT designations, then publish under a
   guarded flow. Separate authorization required.
2. **Thicken NH/RI/CT/NJ** (each thin, already published) with net-new sourcing
   once egress or a supplied source file is available.
3. **Seed MA/ME/VT** from official sources (net-new; currently blocked).
4. Defer non-truck-stop MD/DE service rows (tire/tow/CDL/weigh) to a services
   pass if the directory surfaces those categories.

Nothing here is executed. Publishing, geocoding, and any import remain separate,
explicitly-authorized steps.

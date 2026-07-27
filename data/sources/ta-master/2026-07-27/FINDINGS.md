# TA / Petro / TA Express reconciliation — findings

Read-only, 2026-07-27. **No production write was performed.** Package (also
unexecuted) in `data/imports/ta-2026-07-27/`.

## 1. Provenance: content verified, byte artifact pending

Shawn's official 2026-07-27 download (sha256 `a0c612f0…63f7`) did not reach
this build environment. The committed working copy (`5ebe0e9f…3303`) matched
**all ten** independently stated facts of that download exactly. Reconciliation
proceeded on the verified content; **committing the official artifact and
content-diffing it is a precondition of executing any SQL.** Recorded in
`CHECKSUM.txt`.

## 2. The ~30 questionable rows are now zero unexplained

The earlier gap analysis (387 directory rows vs 354 reference, "+33 excess")
was computed against a scope that missed 8 rows and, more importantly, had no
row-level linkage. With Site ID / Location ID linkage, all **395** TA-network
rows decompose exactly:

| | Rows |
|---|--:|
| Imported 2026-07-25, digest-proven unchanged | 304 |
| Colocated service records (CAT scale / truck service / roadside) | 46 |
| The sites' own pre-existing rows (37 merge + 7 existing + 1 fallback pair) | 43 |
| **Genuine duplicates** | **2** |
| Probable closures | **0** |

The "excess" was never closures — it was service records plus each site's own
legacy row sitting beside the reconciliation scope. **Exactly two rows are
duplicates**, and only **one is published**: `33e41d22…` "TA Atlanta South
#268", a second live pin ~30 m from its imported twin. The other
(`74398e08…` "TA Jacksonville South #248") is already unpublished.

## 3. The Petro Florence mislabel — two operator exports triangulate

`beb05d53…` "Love's Travel Stop #420" (Florence SC, unpublished, quarantined
by the Love's intake) sits at **3001 TV Rd, Florence SC 29501** — which TA's
master says is **site 0393, Petro Florence** (34.2665 / −79.7321, 210 spaces).
Love's own export already proved #420 is Flowood, Mississippi.

Two independent authoritative sources agree: the row is a **Petro mislabeled
as a Love's**. `CORRECTIONS-PROPOSALS.sql` §B proposes the relabel (staying
unpublished); executing it also unblocks the Love's package's held Flowood
MS #420 insert. This closes the loop the Love's intake opened.

## 4. Ashland, Virginia has two official sites — and the prior review merged them

Site **0001 TA Ashland** (100 N Carter Rd, 183 spaces) and site **0142
TA Richmond** (10134 Lewistown Rd, 317 spaces) are both in Ashland VA, zip
23005. The prior review pointed **both** at the same production row, which
would have written one site's coordinate onto the other site's page. The
directory in fact holds a row for each ("TA Ashland (TravelCenters of
America)" and "TA Richmond (TravelCenters of America)", both unpublished,
both blank). The pairing by name is recorded in `HOLD-NAME-ANCHORED.sql` and
is **not** part of the enrichment authorization — verify first.

## 5. Matcher lessons carried into the code

- **A row name citing the site number is the strongest key.** "Petro Stopping
  Center #311" *is* site 0311; token matching alone missed it because
  "Petro W. Memphis" abbreviates what the row spells out.
- **Ordered phases, or weak evidence steals rows.** A name fallback for
  site 0393 grabbed site 0527's row until strong (address-anchored) review
  claims were given priority.
- **Token subset beats prefix.** "TA Monroe" ⊂ "TA Travel Center - Monroe
  #069"; a startsWith test broke 13 legitimate matches.

## 6. What the enrichment does and does not do

38 address-anchored blank-only fills across 13 states — 25 first coordinates,
11 official space counts, 2 both — every target already published. It inserts
nothing, publishes nothing, unpublishes nothing, deletes nothing, and never
writes `overnight_parking` (the master has no overnight field; TA rows keep
`false` = *not confirmed*, the same rule as Pilot).

## 7. Gates after this package

| Gate | Universe | Today | After enrich | Passes when |
|---|--:|--:|--:|---|
| 4a directory | 348 | 347 | 347 | correction B lands → 348 |
| 4b route-usable | 347 | 306 | 344 | + HOLD verified & published, + 0393 corrected & published |

Goasis (4) and Thorntons (2) are held; site 0347 (zero stated spaces) is
directory-only, never parking coverage.

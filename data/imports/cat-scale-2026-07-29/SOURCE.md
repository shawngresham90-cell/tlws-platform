# CAT Scale extraction.csv — source record (2026-07-29)

## Receipt

- Official file supplied by the owner: `extraction.csv`
- **SHA-256:** `82d72c33bea798e3d4fdac9af4ac17c8f05f55c8ae3814253008026035b8f959`
- 2,340 lines (header + 2,339 records); columns: `CATScaleNumber, State, InterstateCity, TruckstopName, InterstateAddress, InterstatePostalCode, PhoneNumber, FaxNumber, ManagerName, Latitude, Longitude, URL`

## Privacy and redistribution handling

- **The raw CSV is never committed.** It stays outside the repository (`.gitignore` carries `*extraction*.csv` and the `local/` detail directory as defense in depth). Redistribution rights for the complete row-level dataset are **not proven**, so the repository carries only: checksums, the intake/reconciliation scripts, aggregate accounting, and documentation — nothing tabulated from the export. Per the owner's use policy (`USE-POLICY.md`, 2026-07-29), the scale-number→classification map and the Canada-held identity manifest live ONLY in the gitignored `local/` directory: CAT Scale's Terms of Use prohibit republishing database information including condensed, selective, or tabulated versions, so no committed file may key or list export rows.
- **`ManagerName` and `FaxNumber` are private fields.** The intake tool drops both columns at the moment of parsing; they appear in no output, no log, no committed file, and no local file. A CI test greps every committed artifact for these column values' presence.
- `CATScaleNumber` is the stable official source identifier and keys all manifests.
- Field semantics honored: `InterstateCity` = city · `TruckstopName` = host facility · `InterstateAddress` = unstructured route/address text (parsed conservatively, never treated as a verified street address) · scale number, state, postal code, public phone, coordinates and the public CAT Scale URL are preserved in the local (uncommitted) working set for the future authorized import. No street addresses or route facts are invented.

## Source accounting (independently verified by `scripts/cat-scale-intake.mjs`)

| Measure | Value |
|---|---:|
| Total records | **2,339** |
| U.S. records | **2,289** |
| Canadian records (held) | **50** — includes 4 legacy `MAN` rows normalized to `MB` (Manitoba, verified by Winnipeg-area coordinates) |
| Unknown-state rows | 0 |
| Unique non-blank `CATScaleNumber` | **2,339** (0 blank, 0 duplicates) |
| Valid coordinates | 2,289 / 2,289 US · 50 / 50 Canada |

### U.S. route-text classification (conservative parser)

| Class | Rows |
|---|---:|
| Single interstate | 1,688 |
| US route | 125 |
| State route | 12 |
| Toll/turnpike | 3 |
| Multiple interstates (ambiguous — position never guessed) | 60 |
| Multiple mixed routes (ambiguous) | 9 |
| Unknown/unparsed | 392 |
| **Explicit mile-marker tokens found** | **0** — no `MM` value exists in this source; nothing may ever display `MM` from this data |

## Canada decision (owner-directed)

All 50 Canadian rows are excluded from U.S. import candidates, U.S. coverage totals, launch-gate denominators and public runtime results. They are **not discarded**: `local/CANADA-HELD-MANIFEST.json` (gitignored, private) reconciles all 50 by scale number/province/city/host for possible future expansion. **No Canadian database import is authorized.**

## Read-only reconciliation of all 2,289 U.S. rows vs the 207 existing cat-scales locations

Production was queried read-only (snapshot 2026-07-29: 207 rows, 164 published, 32 with coordinates, 0 storing a CAT Scale number — host store numbers like "Love's #368" are NOT scale numbers and were never matched as such). Matching keys: state+interstate+exit, host brand/store+city, coordinate proximity ≤ 0.5 mi. Every U.S. record classified exactly once (`local/RECONCILIATION.json` — gitignored, private/internal per the use policy):

| Class | Rows |
|---|---:|
| Exact match (one production row, host agrees, coords already present) | 22 |
| Safe enrichment candidate (one production row, host agrees, production row lacks coordinates) | 90 |
| Net-new candidate | 2,074 |
| Possible duplicate (>1 candidate production row — human review) | 65 |
| Multiple legitimate scales at one complex (share one production row) | 32 |
| Identity conflict (position matches, host brand disagrees — human review) | 6 |
| Quarantined/unsupported | 0 |
| **Total (accounting equation)** | **2,289** ✓ |

Source-side multi-scale complexes: 47 complexes covering 96 scale numbers — deduplication is never done by address alone.

## What this milestone did NOT do

No SQL executed beyond read-only SELECTs; no insert/enrich/publish/unpublish; no NTAD/Love's/Pilot/TA/TPC/rest-area/parking/weigh-station data touched; no migration applied. The import itself is a future, separately authorized milestone — see `PROPOSED-IMPORT-PLAN.md` (inert).

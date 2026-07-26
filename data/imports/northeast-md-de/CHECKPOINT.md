# Northeast MD/DE geocode-and-publication — checkpoint

Geocode + publish the existing, unpublished MD/DE truck-stop rows that already
sit in the directory. Writes only `lat`, `lng`, `geocode_source`,
`geocode_confidence`, `coord_verification_status`, `last_geocoded_at`, and
`is_published`, and only on the six documented MD/DE candidate ids. Never
touches names, addresses, slugs, `type`, `interstate`, `exit_number`,
`is_indexable`, `is_featured`, `completeness_score`, `geo`, or any other row.

- **Project:** `tlws-platform` (`cgvxwvymkembftznhcdl`), Postgres 17.
- **Coordinate sources (authoritative):**
  - Operator master `data/imports/locmaster20260725.xlsx`, sha256
    `5ebe0e9f034153536fe3946a3e5cc3d5a45c9a59b010131d5ccee20e21553303`
    (Latitude/Longitude columns) — the same master that sourced the 304 TA/Petro
    rows and the interstate/exit enrichment.
  - US Census batch geocoder pipeline `data/geocoding/census/` — independent
    cross-check.
- **Confidence bar:** a coordinate is written only when the two sources agree
  within 500 m (`high`). Rows that cannot clear this bar offline are deferred,
  not guessed. Web egress to official/DOT/map hosts is blocked (HTTP 403).

## Candidate disposition (6 truck-stop/plaza rows)

| Name | City, ST | UUID | Disposition |
|---|---|---|---|
| TA Baltimore South #151 | Jessup, MD | `ff19357b…` | geocoded + published |
| TA Baltimore #216 | Baltimore, MD | `e102d6bd…` | geocoded + published |
| TA Elkton #019 | Elkton, MD | `f35c37d4…` | geocoded + published |
| Maryland House Travel Plaza | Aberdeen, MD | `0c8f2702…` | deferred (Census no-match, MM82) |
| Chesapeake House Travel Plaza | North East, MD | `80786332…` | deferred (Census highway-insufficient, MM97) |
| Biden Welcome Center (I-95 Service Plaza) | Newark, DE | `7d3ead5b…` | deferred (single fuzzy Census match, zip mismatch) |

Held networks in MD/DE — **excluded, untouched**: Pilot #290 `f65fd2ef…`,
Flying J #784 `d56cff01…`, Flying J #875 `39a7ad06…`.

## Coordinates written (operator master; Census cross-check)

| Row | lat | lng | Census cross-check | Δ |
|---|--:|--:|---|--:|
| TA Baltimore South #151 | 39.1667 | -76.7828 | 39.167518, -76.784088 | 144 m |
| TA Baltimore #216 | 39.2775 | -76.5488 | 39.281166, -76.549108 | 409 m |
| TA Elkton #019 | 39.6436 | -75.7974 | 39.645113, -75.797782 | 171 m |

Metadata for all three: `geocode_source='batch-csv'`,
`geocode_confidence='high'`, `coord_verification_status='machine-checked'`,
`last_geocoded_at=now()`. `interstate`/`exit_number` were already populated
(`I-95` + `41A/57/109B`) and were **not** overwritten.

## Execution log (live, 2026-07-26)

Executed via the project's authenticated Supabase SQL connection. Each step a
single guarded `DO` block (`GET DIAGNOSTICS ROW_COUNT`, auto-rollback on
mismatch).

| Step | Guard | Result |
|---|---|---|
| GEOCODE (MD, 3 rows) | ROW_COUNT = 3, blank-only (`lat/lng IS NULL`), id+state+type+source scoped | passed first try |
| GEOCODE (DE) | — | 0 rows (Biden deferred) |
| CANARY publish (3 rows) | ROW_COUNT = 3, `is_published=false AND lat/lng IS NOT NULL`, id scoped | passed first try |
| Publish remaining eligible | — | 0 rows (plazas deferred) |

**Zero exceptions, zero rollbacks.**

## Fingerprints — only the intended rows moved

- Digest of all **1,550 non-candidate rows** (`md5(string_agg(md5(row_jsonb)))`):
  `cd6cd9de80bc2f3ebbc679f0ce83f6f6` — **identical** before geocode, after
  geocode, and after publish. Nothing outside the six candidates changed.

## Final audit (live, read-only)

| Check | Before | After |
|---|--:|--:|
| Live rows | 1,556 | 1,556 |
| Published | 1,020 | 1,023 (+3) |
| Rows with lat/lng | 389 | 392 (+3) |
| Rows with `geo` populated | 0 | 0 |
| `is_indexable` | 0 | 0 |
| `geocode_source='batch-csv'` | 0 | 3 |
| MD/DE published | 0 | 3 |
| Non-candidate digest | `cd6cd9de…` | `cd6cd9de…` |

The 3 published rows sit inside the MD bounding box near I-95. Held networks and
the 3 deferred plazas remain unpublished with no coordinates. `geo` was never
written; `is_indexable` was never written; no insert/delete/schema/migration/
trigger/policy/app-code change.

## Artifacts

| File | Purpose |
|---|---|
| `manifest.json` | Per-row disposition, coordinates, cross-check distances, evidence |
| `SOURCE-EVIDENCE.csv` | Per-coordinate source (operator master + sha256) and Census cross-check |
| `GEOCODE.sql` | Guarded coordinate write (MD; DE noted 0) |
| `CANARY-publish.sql` | Guarded 3-record publish (= full eligible set) |
| `ROLLBACK-geocode.sql` / `ROLLBACK-publish.sql` | Revert exactly what was written (id+value match) |
| `AUDIT.sql` | Read-only audit |
| `expectations.json` | Id sets + counts |
| `DEFERRED.md` | The 3 plazas with reasons + resolution method |
| `../../geocoding/northeast-md-de-batch-2026-07-26.csv` | Geocoding batch in the pipeline's CSV format |
| `scripts/test-northeast-geocode.ts` | Offline manifest-integrity + guard test (67 assertions) |

## Phase 10 — Northeast state of play (read-only) and ranked next work

Live counts, post-milestone (`2026-07-26`):

| State | Total | Published | Unpublished | Truck-stop published | Truck-stop unpublished |
|---|--:|--:|--:|--:|--:|
| PA | 14 | 14 | 0 | 14 | 0 |
| NY | 7 | 7 | 0 | 7 | 0 |
| NJ | 4 | 4 | 0 | 4 | 0 |
| CT | 3 | 3 | 0 | 3 | 0 |
| **MD** | 38 | **3** | 35 | **3** | 5 |
| NH | 1 | 1 | 0 | 1 | 0 |
| RI | 1 | 1 | 0 | 1 | 0 |
| **DE** | 10 | 0 | 10 | 0 | 1 |
| MA / ME / VT | 0 | 0 | 0 | 0 | 0 |

MD truck-stop unpublished (5) = 2 deferred plazas + 3 held networks. DE
truck-stop unpublished (1) = Biden Welcome Center (deferred).

**Ranked next work:**

1. **Resolve the 3 deferred MD/DE plazas** (Maryland House, Chesapeake House,
   Biden Welcome Center). Needs a rooftop/entrance coordinate from an
   authoritative source (state DOT service-plaza listing or supplied file),
   cross-checked to < 500 m, then the same geocode → publish flow. Highest
   value once a source is available; blocked only by egress.
2. **MD/DE non-truck-stop services** (35 MD + 9 DE unpublished: CDL schools,
   repair/tire/tow, weigh stations, parking, hotels). Publish under a services
   pass **if/when** the directory surfaces those categories — many already carry
   `interstate`/`exit_number`; most still need geocoding.
3. **Thicken NH/RI/CT/NJ** (each thin, already published) via net-new sourcing
   once egress or a supplied source file is available.
4. **Seed MA/ME/VT** (genuinely empty) from official sources — net-new,
   currently egress-blocked.

A concrete, ranked **second candidate manifest** (read-only, unexecuted) for the
42 remaining non-held MD/DE rows is at
`data/imports/northeast-prep/SECOND-CANDIDATE-MANIFEST.md` (+ `.json`): 28 Tier-1
(street-address geocodable) and 14 Tier-2 (need a rooftop coordinate), grouped
by category with the same guardrails as this milestone.

Nothing in this section is executed.

## Production / preview URLs (manual review — sandbox egress blocked, HTTP 403)

The three published detail pages, corridor, and exit pages (gated on
`is_published=true`, which now holds):

- `/directory/location/ta-baltimore-south-151-jessup-md`
- `/directory/location/ta-baltimore-216-baltimore-md`
- `/directory/location/ta-elkton-019-elkton-md`
- Corridor: `/directory/i95` · Exits: `/directory/i95/exit-41a`,
  `/directory/i95/exit-57`, `/directory/i95/exit-109b`
- Category: `/directory/truck-stops`

Netlify deploy preview for PR #185 (built green):
`https://deploy-preview-185--lighthearted-clafoutis-144512.netlify.app`.
Both the production domain and `*.netlify.app` return 403 from the sandbox, so
these were verified through the database query paths (`is_published=true` filter,
`interstate='I-95'` corridor filter, unique `detail_slug`, `category_slug=
'truck-stops'`) and the app's `interstateSlug()`/`exitSlug()` contracts rather
than fetched.


# Schema audit — verified mile markers + three-way overnight status

**Milestone:** read-only schema audit and unexecuted migration plan (2026-07-29).
**Branch:** `feature/schema-plan-mm-overnight`, cut from `main@3aa9871`.
**Database:** Supabase project `cgvxwvymkembftznhcdl`, table `public.locations`.
**No SQL other than read-only SELECTs was executed for this audit.**

## Zero-write proof

| Probe | Live rows | Published | With coords | Featured/indexable | Full digest |
|---|---|---|---|---|---|
| Pre-audit | 2,830 | 2,454 | 1,973 | 0 | `640482ae283d3445b88f8d32688cfce7` |
| Post-audit | see final report (re-captured after all audit queries) | | | | must be byte-identical |

Digest formula (canonical, unchanged from prior milestones): `md5(string_agg(concat_ws('|', id, name, lat, lng, is_published, parking_spaces, overnight_parking, category_slug, detail_slug, source, is_featured, is_indexable), E'\n' order by id))` over `deleted_at is null`.

## 1. Live `locations` schema (information_schema + pg_catalog, 2026-07-29)

### Columns (44)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| type | text | NO | — (CHECK: truck_stop, rest_area, weigh_station, parking, repair, cdl_school, other) |
| name | text | NO | — |
| state | character | NO | — |
| city | text | NO | — |
| slug | text | NO | — |
| address, zip, phone, website | text | YES | — |
| geo | geography | YES | — (never written by tooling — standing rule) |
| hours | jsonb | YES | '{}' |
| amenities | jsonb | YES | '[]' |
| fuel_brands | text[] | YES | — |
| **parking_spaces** | **integer** | **YES** | **—** |
| description | text | YES | — |
| completeness_score | integer | NO | 0 (CHECK 0–100) |
| is_indexable | boolean | NO | false |
| source | text | YES | 'manual' |
| deleted_at | timestamptz | YES | — |
| created_at / updated_at | timestamptz | NO | now() |
| category_slug | text | YES | CHECK (9 slugs) |
| lat / lng | double precision | YES | CHECK ranges |
| free_parking / paid_parking / reserved_parking | boolean | NO | false |
| **overnight_parking** | **boolean** | **NO** | **false** |
| tpc_url, affiliate_code, image_url | text | YES | — |
| is_published | boolean | NO | false |
| is_featured | boolean | NO | false |
| verified_at | timestamptz | YES | — |
| **interstate** | **text** | YES | — (CHECK length ≤ 20) |
| **exit_number** | **text** | YES | — (CHECK length ≤ 20) |
| detail_slug | text | NO | UNIQUE |
| geocode_source | text | YES | CHECK (import, batch-csv, interpolation, external-api, manual) |
| geocode_confidence | text | YES | CHECK (high, medium, low) |
| coord_verification_status | text | YES | CHECK (unverified, machine-checked, manually-verified, disputed) |
| last_geocoded_at, manually_verified_at | timestamptz | YES | — |
| manually_verified_by | text | YES | — |

**Finding MM-1: there is no mile-marker column of any kind.** `interstate` and `exit_number` are the only route-position fields (re-confirmed from the PR #206 audit).

**Finding OV-1: `overnight_parking` is `boolean NOT NULL DEFAULT false`.** Every row that was inserted without explicit overnight evidence carries `false` *because it is the column default* — `false` does NOT mean "prohibited". It means "not confirmed". This is the core reason a three-way status is needed.

**Finding PREC-1 (house precedent):** the schema already models provenance as **text + CHECK constraint** triples: `geocode_source` / `geocode_confidence` / `coord_verification_status` plus `last_geocoded_at` / `manually_verified_at/by`. The mile-marker and overnight designs below follow this exact precedent rather than introducing a PostgreSQL enum.

### Constraints
13 total: PK (id), UNIQUE (type, state, city, slug), UNIQUE (detail_slug), CHECKs on type, category_slug, completeness_score, lat, lng, geocode_source, geocode_confidence, coord_verification_status, exit_number length, interstate length.

### Indexes (17)
`locations_pkey`, `locations_composite_slug`, `locations_detail_slug_key`, `locations_geo_gist`, `locations_geog_gist_idx`, `locations_type_state_city`, `locations_indexable`, `locations_name_trgm`, `locations_amenities_gin`, `locations_published`, `locations_category_slug`, `locations_zip`, **`locations_interstate`** (btree, partial `deleted_at is null`), `locations_created_at`, `locations_pub_cat_featured`, `locations_coords_published_idx`, `locations_coord_verification_idx`.

**Finding IDX-1:** corridor queries (`state = ? and interstate = ?` filtered by category and publication) are served today by `locations_interstate` + filters. There is no composite index covering route-position ordering; the plan adds one.

### RLS, grants, triggers
- RLS **enabled**. One policy: `anon_read_locations` — SELECT for `anon` where `is_published = true AND deleted_at IS NULL`. New columns are automatically covered by this row-level policy (RLS is row-scoped, not column-scoped); no policy change is required.
- Grants: `anon`/`authenticated`: SELECT (+ inert REFERENCES/TRIGGER); `service_role`: full. Column additions inherit table-level grants; no grant change required.
- Triggers: `set_detail_slug` (BEFORE INSERT), `set_updated_at` (BEFORE UPDATE). Neither reads the audited fields; `set_updated_at` will correctly stamp any future backfill.

## 2. Call-site inventory (repository, `main@3aa9871`)

### `overnight_parking` / `overnightParking` / `overnightAllowed` — 41 files
**Write paths (5):**
- `src/lib/directory/import.ts` — CSV import: header alias `overnightparking`, allow-listed column, `overnight_parking: asBool(raw.overnight_parking)` (line 220).
- `src/app/admin/(dashboard)/directory/actions.ts` — admin create/edit: boolean checkbox fields loop (line 335).
- `src/app/admin/(dashboard)/submissions/actions.ts` + `src/app/api/directory/submission/route.ts` + `src/lib/community/schemas.ts` — community submission (`z.boolean().nullable().default(null)`) → admin approval writes it.
- `src/app/admin/(dashboard)/directory/corrections/actions.ts` / `src/lib/directory/corrections.ts` — corrections flow.
- (Guarded SQL milestones write it only under owner authorization — process, not code.)

**Read paths (key):**
- `src/lib/directory/data.ts` `toEntry()` — `overnight_parking` → `'Overnight OK'` amenity chip (the only place the boolean becomes UI text for the directory).
- `src/components/directory/CorridorFlow.tsx` + `src/lib/directory/corridor.ts` `overnightLabel()` — 'Overnight confirmed' only from the 'Overnight OK' chip, else 'Overnight unknown' (PR #206).
- `src/lib/trip-planner/directory-loader.ts` (selects the column, maps `overnightParking`) → `src/lib/trip-planner/directory-layer.ts` line 165: `components.overnightAllowed = c.overnightParking ? 10 : 0` — **scoring bonus only**, never a hard filter.
- Directory pages (`truck-parking` category page, detail page via chips), `TruckParking.tsx` section, `llms.txt` route, admin quality/export/CSV, completeness scoring (`src/lib/directory/completeness.ts`), FAQ/disclosure copy (`parking-disclosure.ts`, `faq.ts`), store product copy.

### `exit_number` / `exitNumber` — 38 files
Text, strictly parsed only in `src/lib/directory/corridor.ts` (`parseExitPosition`, `resolveRoutePosition`). Written by admin form/actions, import, expansion/backfill tooling. Read by detail pages, nearby/colocation/interpolation/calibration modules, map explorer, trip-planner types. **No call site converts an exit number into a mile marker; `resolveRoutePosition()` (PR #206) is the single place position semantics live.**

### `parking_spaces` / `parkingSpaces` — 30+ files
The safety gate is `src/lib/trip-planner/directory-layer.ts:108` `hasConfirmedTruckParking(spaces): spaces is number` — finite number > 0. Hard filter at lines 210/241 and `last-stop.ts:164`. **This plan does not touch it.**

### PR #206 forward contract
`DirectoryEntry.mileMarker?: number` (documented unwired) + `resolveRoutePosition()`: verified MM → `MM x` label + ordering; else strict exit → `EXIT x`; else `Route position not verified`. **Wiring a future `mile_marker` column requires exactly one mapper line in `toEntry()` (`mileMarker: row.mile_marker ?? undefined`) plus adding the column to the two corridor SELECTs in `src/lib/directory/data.ts`.** All labeling/ordering behavior is already tested (53-check corridor harness, 184-check e2e).

## 3. Do `supabase/migrations` files auto-apply?

**No.** Verified 2026-07-29:
- `netlify.toml` build command is `npm run build` only; the Next.js plugin does not run migrations.
- `.github/workflows/` (ci.yml, preview-crawl.yml, preview-smoke.yml, prod-health-check.yml) contain **no** `supabase db push`, `supabase migration`, or any migration-applying step (only env vars for runtime reads).
- Historical migrations 001–046 were applied manually via the authorized Supabase MCP `apply_migration` flow; the numbered files in `supabase/migrations/` are the repository record, not an execution trigger.

**Despite this, per the milestone instruction, all proposed SQL in this package lives here in `data/plans/schema-mm-overnight-2026-07-29/` — an explicitly inert location — and every SQL file carries a top-of-file INERT banner. Nothing is placed in `supabase/migrations/`.** When execution is authorized, the migration will be copied to `supabase/migrations/047_mile_marker_overnight_status.sql` in the execution PR and applied via the guarded MCP flow.

# Design — verified `mile_marker` + three-way `overnight_status`

Status: **PLAN ONLY — nothing here is executed.** Companion SQL: `PROPOSED-MIGRATION.sql`, `PROPOSED-ROLLBACK.sql`, `PROPOSED-BACKFILL.sql` (all inert).

## 1. Mile-marker design (recommended: smallest defensible)

### Recommended columns

| Column | Definition | Why |
|---|---|---|
| `mile_marker` | `numeric(6,2)` NULL, CHECK `mile_marker is null or (mile_marker >= 0 and mile_marker <= 1500)` | `numeric` is exact decimal arithmetic — **no floating-point guessing** (`71.5` is stored as exactly 71.5, unlike float8). Two decimal places covers every state DOT log (tenth-of-a-mile precision plus margin). NULL = unknown. Upper bound 1500 comfortably exceeds the longest US route mileposting (I-90 ≈ 3,020 miles total but per-state mileposts reset at state lines; the longest in-state milepost is Texas I-10 ≈ 880) while rejecting garbage. Negative and malformed values are rejected by type + CHECK. |
| `mile_marker_source` | `text` NULL, CHECK in (`'state-dot'`, `'official-operator'`, `'manual'`) | Provenance, following the exact house precedent of `geocode_source`. A mile marker without a source is not verified, so a pairing constraint (below) makes provenance mandatory. |
| `mile_marker_verified_at` | `timestamptz` NULL | When the value was verified, mirroring `manually_verified_at` precedent. |

Pairing constraint: `CHECK ((mile_marker IS NULL) = (mile_marker_source IS NULL))` — a value can never exist without provenance, and provenance can never exist without a value. **This is the schema-level enforcement of "never copy an exit number into mile_marker":** an exit number carries no mile-marker provenance, so an unevidenced copy is structurally rejected as well as procedurally banned.

`mile_marker_confidence` is **not recommended**: unlike geocoding (where interpolation created genuine confidence tiers), a mile marker is either verified from an authoritative source or it is NULL. A confidence tier would invite storing guesses. Smallest defensible design: value + source + timestamp.

### Separation of concepts
`exit_number` (text, as-signed label like "41A") and `mile_marker` (numeric route position) remain independent columns. The UI contract shipped in PR #206 already keeps them separate: `resolveRoutePosition()` labels `MM` **only** from `mileMarker`, falls back to `EXIT` from a strictly-parseable exit number, and files everything else under "Route position not verified". Wiring = one mapper line in `toEntry()` + adding `mile_marker` to the two corridor SELECT column lists. No UI change needed; 53 engine checks + 6 e2e MM-honesty checks already pin the behavior.

### Query/index plan
New partial index (in the proposed migration):
```sql
create index locations_corridor_position_idx
  on public.locations (state, interstate, mile_marker, exit_number)
  where deleted_at is null and is_published = true;
```
Serves `state = ? AND interstate = ?` corridor fetches with position available from the index; direction is an application-side sort order (ascending/descending over the same rows), so one index serves both directions. Existing `locations_interstate` stays for facet counting.

### Population
**No mile markers are populated in this milestone or by this migration.** Population is a separate, later, per-state evidence milestone (state DOT mile logs / SRRA-class datasets), row-scoped and guarded like every prior enrichment.

## 2. Overnight-status design

### Enum vs text + CHECK

| Criterion | PostgreSQL `enum` | `text` + CHECK (recommended) |
|---|---|---|
| House precedent | None — zero enums in `locations` | `coord_verification_status`, `geocode_confidence`, `geocode_source` all use text + CHECK |
| Adding a future value | `ALTER TYPE ... ADD VALUE` — cannot run inside the same transaction as dependent DML on PG < 12 patterns, cannot be removed once added, complicates rollback | `ALTER TABLE ... DROP CONSTRAINT; ADD CONSTRAINT` — fully transactional, reversible |
| Rollback | Dropping an enum type requires dropping every dependent column first; ordering traps | Drop constraint + column, done |
| Supabase/PostgREST behavior | Serialized as text anyway | Identical wire format |
| Typo safety | Equal (both reject invalid values) | Equal |

**Decision: `text` + CHECK.** Same integrity, strictly simpler rollback, matches every existing status column in this schema.

### Recommended columns

| Column | Definition |
|---|---|
| `overnight_status` | `text NOT NULL DEFAULT 'unknown'`, CHECK in (`'confirmed'`, `'prohibited'`, `'unknown'`) — **initial/default status is `unknown` for every row**, per instruction |
| `overnight_status_source` | `text` NULL, CHECK in (`'official-operator-export'`, `'state-dot'`, `'operator-direct'`, `'manual'`) |
| `overnight_status_verified_at` | `timestamptz` NULL |

Pairing constraint: `CHECK (overnight_status = 'unknown' OR overnight_status_source IS NOT NULL)` — a row can only be `confirmed` or `prohibited` **with** provenance. `unknown` needs none (it is the honest default).

### Anti-drift guard (boolean ↔ status)
While both columns exist, one contradiction is structurally impossible to justify: the legacy boolean claiming OK while status says prohibited (or vice-versa after verification). Guard constraint in the migration:
```sql
CHECK (NOT (overnight_parking = true AND overnight_status = 'prohibited'))
```
The expected interim states (`true`/`unknown` for the 330 legacy rows, `false`/`confirmed` never occurs because backfill sets confirmed only where boolean is already true) remain legal. Plus a documented read-only drift-audit query in `TEST-PLAN` for the operational states the CHECK can't express. Once write paths set both fields together (transition step 3), drift cannot be introduced by application code.

### Backfill (separate authorization; inert SQL in `PROPOSED-BACKFILL.sql`)
- `confirmed` ← exactly the 541 `loves-master-2026-07-27` rows with `overnight_parking = true` (explicit official-export evidence; guarded `get diagnostics` count must equal 541 or the transaction aborts).
- `prohibited` ← **nothing** (zero rows hold explicit authoritative prohibition evidence today).
- Everything else stays at the column default `unknown` — no write occurs at all, so unknown values structurally cannot become prohibited.
- The 330 legacy-true rows are a manual review queue (manifest in `OVERNIGHT-ACCOUNTING.md`), never auto-confirmed.

## 3. Runtime compatibility sequence (phased, non-breaking)

| Step | Contents | Risk | Verification |
|---|---|---|---|
| **M1 — additive migration** (needs authorization) | Apply `PROPOSED-MIGRATION.sql` via guarded MCP flow; copy into `supabase/migrations/047_…` in the execution PR. Purely additive: no existing column, policy, grant, or trigger changes; no code reads the new columns yet, so **zero runtime behavior change**. | Brief ACCESS EXCLUSIVE lock for ADD COLUMN (metadata-only with constant default on PG ≥ 11 — no table rewrite); constraint validation scans 2,830 rows (milliseconds). | Post-apply: column/constraint/index existence probes; full digest unchanged (digest reads no new columns); app smoke (reads unaffected). |
| **M2 — evidence backfill** (needs authorization) | Apply `PROPOSED-BACKFILL.sql` (541 confirmed, count-guarded, value-matched rollback committed first). Manual review of the 330 legacy-true rows proceeds independently. | Data-only; single UPDATE of 541 rows. | 541/0/2,289 accounting probe; digest recomputed (changes only via new columns if formula extended — the canonical digest formula excludes them, so it must remain `640482ae…` until the formula is versioned in the execution record). |
| **M3 — code switchover** (normal PR + review) | `toEntry()` maps `overnight_status`; chips become three-way (`Overnight OK` / `Overnight prohibited` / nothing for unknown); `corridor.ts overnightLabel()` gains 'Overnight prohibited' (red/diesel accent); admin `ListingForm` + submissions + corrections + CSV import write **both** boolean and status consistently; trip planner `directory-loader` selects `overnight_status` and `directory-layer` scoring becomes `overnightAllowed = status === 'confirmed' ? 10 : 0` — **`hasConfirmedTruckParking` is not touched**. Owner picks Option A or B from `OVERNIGHT-ACCOUNTING.md` for switchover timing. | UI copy changes; test updates enumerated in TEST-PLAN. | Full 73-harness suite + corridor/e2e extensions; verify-overnight contract harness re-run. |
| **M4 — boolean deprecation** (separate future authorization) | Remove `overnight_parking` reads, then column. **Not part of this plan.** | — | — |

## 4. Risk and rollback assessment

- **Lock/performance:** ADD COLUMN with constant default is metadata-only on PostgreSQL ≥ 11 (Supabase runs 15+); the two CHECK-constraint additions and the partial index build scan 2,830 rows — sub-second. Run in one transaction; the table is small enough that ACCESS EXCLUSIVE for that window is negligible. No rewrite, no long-running validation, no downtime expected.
- **Reversibility:** `PROPOSED-ROLLBACK.sql` drops, in dependency order, exactly the 2 constraints + 1 index + 6 columns the migration adds, each guarded by existence checks. Rollback after M2 loses backfilled statuses (recoverable — the backfill is deterministic from the committed manifest); rollback must therefore not run after manual corrections begin without re-exporting them first (stated in the rollback header).
- **Cannot overwrite later corrections:** the backfill UPDATE carries `and overnight_status = 'unknown'` so re-running it never clobbers a status set after it (idempotent and correction-safe).
- **No inference anywhere:** the migration writes no data values; the backfill writes only the Love's evidence set; mile markers are never populated.
- **RLS/grants:** unchanged and automatically cover new columns (row-scoped policy; table-level grants). Verified in `SCHEMA-AUDIT.md`.
- **Parking-count gate:** no file in this plan touches `hasConfirmedTruckParking` or `parking_spaces`; a static test enforces it.
- **NTAD canaries:** no SQL in this package references `ntad-2019-v04` in a write; the five rows keep `overnight_status = 'unknown'` by default and remain unpublished/ineligible.

## 5. Test plan

**Static (shipping in this PR — `scripts/test-schema-plan.ts`):** inertness of all plan SQL, no plan file under `supabase/migrations/`, exit-number→mile-marker copying forbidden, no `prohibited` writes, Pilot/TA never auto-confirmed, backfill scoped to Love's + count-guarded + correction-safe, rollback covers every added object, default `unknown`, drift guards present, parking-gate behavior unchanged.

**Execution-time (M1/M2, defined now, run then):** existence probes for the 6 columns / 2 pairing constraints / drift CHECK / index; digest byte-identity after M1; 541/0/2,289 accounting after M2; NTAD five-row probe; RLS policy count unchanged.

**M3 code tests (enumerated for that PR):** corridor harness gains prohibited-label cases; `toEntry` chip mapping tests; trip-planner scoring test flips to status; admin/import round-trip writes both fields; verify-overnight contract harness green.

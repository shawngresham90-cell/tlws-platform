# Intake process — what runs the moment a file is uploaded

Ten steps, in order. Steps 1–6 touch no database. Step 7 produces an
**unpublished** guarded import. Steps 8–10 need authorization that is granted
separately at each stage.

**No parser exists yet, deliberately.** Step 3 is written against the real file
when it arrives. Guessing a vendor's column names before seeing the file
produces a parser that silently mismaps a column, and a silently mismapped
coordinate is worse than no coordinate.

Drop uploads in `data/sources/<source_id>/<YYYY-MM-DD>/`.

---

## 1. Preserve the raw file and checksum it

Store the file **exactly as received** — same bytes, same name, no reformatting,
no "cleanup", no Excel round-trip. Record alongside it:

```
sha256sum <file>            → CHECKSUM.txt
```

plus `source_id`, retrieval URL, retrieval timestamp, and who obtained it, in
`PROVENANCE.md`.

The raw file is the evidence. Every later claim traces back to this checksum,
and if a coordinate is ever disputed the answer is "this file, this hash".
Never edit it in place; corrections happen downstream.

## 2. Parse without modifying the original

Read-only parse into a working copy. The parser reports what it *found* before
it maps anything: column headers, row count, null rates per column, coordinate
range, distinct values in status and type columns.

Stop and read that report before continuing. This is where you learn the file
has 640 rows when you expected 650, or that `LAT`/`LONG` are strings with a
degree symbol, or that "status" has five values rather than two.

## 3. Normalize fields

Map source columns onto the directory's schema. Written now, against the real
headers, not before.

- Coordinates to decimal degrees; reject anything outside the continental
  envelope or equal to zero.
- State to a two-letter code.
- Route to `I-<number>` — the format the corridor pages use.
- Direction to `NB` / `SB` / `EB` / `WB`, or null.
- Facility type to exactly one of: `parking`, `truck_stop`, `rest_area`,
  `welcome_center`, `service_plaza`, `weigh_station`.
- **A field the source does not state becomes `null`.** Not zero, not "unknown",
  not a default, not a value copied from a neighbouring facility.

Keep the source's own id in `source_ref`. It is the only durable join key.

## 4. Reconcile against existing rows

Match by `source_ref` first. Only where that is absent, fall back to coordinate
proximity (< 150 m) combined with canonical name/city/state. **Never match on a
loose business name alone** — that is how "Carson Safety Rest Area" ended up
filed in Georgia.

Run every existing duplicate gate: `detail_slug`, canonical name/city/state,
type/state/city/slug, coordinate proximity, directional-pair reconciliation,
existing-location aliases.

## 5. Classify into updates, net-new, closures, duplicates

Produce four explicit lists, each with row counts, and eyeball them before
proceeding:

- **Updates** — existing row, new or corrected field values.
- **Net-new** — absent from the database and supported by this source.
- **Closures** — present in the database, absent or flagged closed in a current
  full export. A closure is a **removal from publication**, never a silent
  delete.
- **Duplicates** — same facility reached by two paths. Resolve to one canonical
  row. Directional pairs are **not** duplicates and must survive as two rows;
  the two MDTA plazas split across categories **are** one facility each.

## 6. Validate coordinates and route proximity

- Non-zero, inside the continental envelope, inside the row's own state
  bounding box, with an unknown state failing **closed** rather than skipping
  the check.
- Within a sane distance of the route the row claims — a facility on I-95
  should not plot 40 miles from I-95.
- No two distinct facilities sharing one coordinate.
- Flag anything within 150 m of an existing published location for human review
  before it goes further.

Rejects go to a quarantine list with an exact reason. They are never quietly
dropped and never rounded into acceptance.

## 7. Generate an unpublished, guarded import

Fill the existing templates — do not write new SQL:

- `ENRICH-TEMPLATE.sql` for coordinates onto existing rows (blank-only, exact
  id, `ROW_COUNT`-guarded, bounds-checked).
- `PUBLISH-TEMPLATE.sql` for publication, one state per transaction,
  coordinates required at both guard and write.
- `ROLLBACK-TEMPLATE.sql` value-matched for both directions.

Net-new rows are prepared with `is_published = false`, `is_featured = false`,
and `is_indexable` **unchanged**.

Capture `FINGERPRINT.sql` before anything runs, including the out-of-scope
control digest.

## 8. Run a small, diverse canary

10–20 records spanning several states, corridors and facility types — not the
twenty easiest rows from one state. Include at least one directional pair and
one previously ambiguous case, so the awkward paths are exercised on the first
run rather than discovered at scale.

Verify each through the directory's own query contract: the detail page, the
corridor page, the category page, and the map.

## 9. Measure coverage improvement

Re-run `FINGERPRINT.sql` and update the **Current** column of `LAUNCH-GATE.md`
in the same commit.

Report as **percentage of the source of record captured**, per gate line. Do
not report row growth. "We added 400 rows" is not a coverage statement; "Love's
is now 100 % of 652 sites" is.

Confirm the out-of-scope control digest has not moved.

## 10. Publish only after separate authorization

Insertion, enrichment and publication are **three separate authorizations**.
Approval of one is not approval of the next, and approval for one state's batch
is not approval for the rest.

---

## Standing constraints

- Never write to production without explicit authorization for that step.
- Never publish a row with no coordinate.
- Never treat a weigh station as parking without an explicit authoritative
  statement that parking is permitted.
- Never resurface a held/excluded network as a promoted or featured placement.
- Never invent a coordinate, space count, hours value, restriction or amenity.
- Never scrape in place of an authorized export.

# Directory geocoding batches

Verified coordinate batches for `public.locations`, applied through the admin
geocoding tool at `/admin/directory/geocoding`. Nothing in this folder touches
the database by existing — coordinates only change when an admin uploads a
batch, reviews the preview, and explicitly applies selected rows.

## File format

One CSV per batch (`i75-ga-tn-geocoding-batch-001.csv`, …) with exactly these
columns:

| column | meaning |
|---|---|
| `listing_id` | UUID of the live `locations` row — matching is by ID **plus** an address/city/state cross-check, never by name |
| `business_name`, `category`, `address`, `city`, `state`, `zip` | identity snapshot used for the cross-check and human review |
| `current_latitude`, `current_longitude` | coordinates at research time (informational; the tool re-reads live values) |
| `proposed_latitude`, `proposed_longitude` | verified WGS84 decimal coordinates, 6 dp; blank when unresolved |
| `confidence` | `high` \| `medium` \| `low` \| `unresolved` |
| `source_url` | primary source the coordinates came from |
| `verification_notes` | method + cross-check details |
| `action` | `ready` \| `manual-review` \| `skip` |

## Rules the tool enforces (server-side, on every upload)

- Only `action=ready` **and** `confidence=high` rows can be applied
- `medium`/`low` → manual-review; `unresolved` → skip; all are preserved and
  downloadable from the preview screen
- Latitude −90…90, longitude −180…180, `0,0` rejected, points outside the
  continental US rejected
- Duplicate or unknown `listing_id`s rejected; identity mismatches
  (file address/city/state disagreeing with the live row) rejected
- Existing coordinates are never overwritten without a per-row confirmation
- Every applied row writes a `location_history` record
  (`source='geocoding'`, old → new values, source URL, confidence) **before**
  the listing is updated — a failed history write aborts that row

## Companion reports per batch

- `*-sources.md` — per-row source URL, verification method, confidence
- `*-review.md` — audit summary, counts, known limitations, and the exact
  apply instructions for that batch

# TA/Petro publication canary — 10 locations

**COMPLETE.** Exactly 10 rows of the verified 304-row TA/Petro batch had
`is_published` flipped `false → true`. No other column, row, or table changed.
Every number below is a live query result taken before and after execution, not
a projection.

| Metric | Value |
|---|--:|
| Source label | `official-ta-petro-20260725-5ebe0e9f` |
| Published in this canary | **10** |
| Batch remaining unpublished | **294** |
| Batch total | 304 (unchanged) |
| Live row total | 1,556 (unchanged) |
| Pre-existing rows | 1,252 (unchanged) |
| Site-wide published rows | 716 → 726 (+10) |
| Rows inserted / deleted | 0 / 0 |
| Columns written | `is_published` only |
| Executed | 2026-07-25, single guarded transaction |

The source label was read from `../sql/CHECKPOINT.md`. No fuzzy name matching
was used anywhere in selection or execution.

## The 10 canary locations

4 Petro + 6 TA, one per state across 10 states and distinct freight corridors.

| # | ID | Name | Brand | City | ST | Corridor | Lat | Lng | Detail slug |
|--:|---|---|---|---|---|---|--:|--:|---|
| 1 | `3e9bf81d-9821-459a-83c6-2f4a11b1cdd8` | Petro Santa Nella | Petro | Santa Nella | CA | I-5 | 37.0547 | -121.0155 | `petro-santa-nella-santa-nella-ca` |
| 2 | `084a6d0f-99c9-445c-a4d6-eebf25906a95` | Petro North Hillsboro | Petro | Hillsboro | TX | I-35 | 32.0794 | -97.0552 | `petro-north-hillsboro-hillsboro-tx` |
| 3 | `04ebc594-6cbb-4dfb-8412-18fbfdcdda8e` | Petro Perrysburg | Petro | Perrysburg | OH | I-75 / I-80 | 41.5355 | -83.4664 | `petro-perrysburg-perrysburg-oh` |
| 4 | `524f9828-f30b-4fd0-8c19-517ca2a94810` | Petro Carnesville | Petro | Carnesville | GA | I-85 | 34.3481 | -83.3199 | `petro-carnesville-carnesville-ga` |
| 5 | `0481b552-960a-4de2-8de1-194eeb097d46` | TA Barkeyville | TA | Harrisville | PA | I-80 | 41.1992 | -79.9758 | `ta-barkeyville-harrisville-pa` |
| 6 | `171981b9-7bdd-4511-ad0f-1aa1601e647a` | TA Springer | TA | Springer | NM | I-25 | 36.44997 | -104.59286 | `ta-springer-springer-nm` |
| 7 | `0b73fd3d-ca53-46a7-a467-e8441d4437a4` | TA Express Palmyra | TA | Palmyra | MO | US-61 | 39.78762 | -91.51637 | `ta-express-palmyra-palmyra-mo` |
| 8 | `04fe8734-4e5c-446e-9bc3-a9f0ca276035` | TA Rawlins | TA | Rawlins | WY | I-80 | 41.7762 | -107.2243 | `ta-rawlins-rawlins-wy` |
| 9 | `354bc376-dbe6-4584-b8a5-1b4ec6e55c70` | TA Express Tampa | TA | Seffner | FL | I-4 / I-75 | 28.0099 | -82.301 | `ta-express-tampa-seffner-fl` |
| 10 | `02564379-d8e9-432b-813a-607b86ce9dc6` | TA Lake Station | TA | Lake Station | IN | I-80 / I-94 | 41.5906 | -87.2393 | `ta-lake-station-lake-station-in` |

All 10 are `type = truck_stop`, `category_slug = truck-stops`. All 10 were
`is_published = false` immediately before execution.

## Pre-execution gate — all checks passed

Run read-only against the live database on exactly these 10 IDs:

| Check | Expected | Actual |
|---|--:|--:|
| IDs supplied / distinct / matched | 10 / 10 / 10 | 10 / 10 / 10 |
| Carry the batch source label | 10 | 10 |
| Currently unpublished | 10 | 10 |
| Featured or indexable | 0 | 0 |
| Soft-deleted | 0 | 0 |
| Missing coordinates | 0 | 0 |
| `geo` populated | 0 | 0 |
| Distinct states | 10 | 10 |
| Love's / Sapp Bros / Pilot / Flying J / Goasis / Thorntons | 0 | 0 |
| Held or manually-verified rows | 0 | 0 |
| `detail_slug` collisions | 0 | 0 |
| `type\|state\|city\|slug` collisions | 0 | 0 |

## Execution

One transaction. The update is scoped by ID **and** source label **and**
`is_published = false` **and** `deleted_at is null`, with a
`GET DIAGNOSTICS ... ROW_COUNT` guard that raises on any count other than 10 —
which aborts the block and rolls back automatically. Committed SQL:
`PUBLISH-canary-10.sql`.

The block completed without raising, so `ROW_COUNT` was exactly 10.

## Post-execution verification — all checks passed

| # | Check | Expected | Actual |
|---|---|--:|--:|
| 1 | Live row total | 1,556 | 1,556 |
| 2 | Batch total | 304 | 304 |
| 3 | Batch published | 10 | 10 |
| 4 | Batch unpublished | 294 | 294 |
| 5 | Pre-existing rows | 1,252 | 1,252 |
| 6 | Site-wide published | 726 | 726 |
| 7 | Published set == intended set | 0 unexpected, 0 missing | 0 / 0 |
| 8 | Batch featured or indexable | 0 | 0 |
| 9 | Batch `geo` writes | 0 | 0 |
| 10 | Batch missing coordinates | 0 | 0 |
| 11 | Pre-existing rows touched | 0 | 0 |
| 12 | Other 294 batch rows touched | 0 | 0 |
| 13 | Duplicate `detail_slug` (live table) | 0 | 0 |
| 14 | Duplicate `type\|state\|city\|slug` | 0 | 0 |
| 15 | Excluded-network rows published | 0 | 0 |

### Cryptographic proof that only `is_published` changed

Row fingerprints were captured before and after execution as
`md5(string_agg(md5((to_jsonb(row) - 'is_published' - 'updated_at')::text) order by id))`.
Because the digest excludes only `is_published` and `updated_at`, an identical
value proves that **no other column changed on any row** — including `name`,
`slug`, `detail_slug`, `lat`, `lng`, `geo`, `address` and `category_slug`.

| Fingerprint | Before | After | Result |
|---|---|---|---|
| All 1,556 rows, excl. `is_published` | `d34d5187b67d05574a1ae77d06342f57` | `d34d5187b67d05574a1ae77d06342f57` | identical |
| 1,252 pre-existing rows, **incl.** `is_published` | `214b7e0586bd5f641e8f5874f2de6b57` | `214b7e0586bd5f641e8f5874f2de6b57` | identical |
| 304 batch rows, excl. `is_published` | `c4931a4abcbf131ceeda27c203d0a121` | `c4931a4abcbf131ceeda27c203d0a121` | identical |

The pre-existing digest includes `is_published`, so its stability additionally
proves no pre-existing listing's publication state moved.

`updated_at` advanced to `2026-07-25 22:45:06.822942+00` on the 10 canary rows
only — the automatic effect of the pre-existing `set_updated_at` BEFORE
trigger. Pre-existing rows still show `max(updated_at) = 2026-07-21
22:52:34.149367+00`, and 0 rows outside the canary have an `updated_at` newer
than the pre-canary high-water mark. The `set_detail_slug` BEFORE trigger also
fired; the unchanged digest confirms it recomputed every `detail_slug`
identically.

## Live URLs

Detail pages resolve at `/directory/location/<detail_slug>`, gated on
`is_published = true`. Directory routes run ISR at `revalidate = 300` with
`dynamicParams` left true, so the new pages render on demand and listings
refresh within five minutes — no redeploy is required.

- https://truckinglifewithshawn.com/directory/location/petro-santa-nella-santa-nella-ca
- https://truckinglifewithshawn.com/directory/location/petro-north-hillsboro-hillsboro-tx
- https://truckinglifewithshawn.com/directory/location/petro-perrysburg-perrysburg-oh
- https://truckinglifewithshawn.com/directory/location/petro-carnesville-carnesville-ga
- https://truckinglifewithshawn.com/directory/location/ta-barkeyville-harrisville-pa
- https://truckinglifewithshawn.com/directory/location/ta-springer-springer-nm
- https://truckinglifewithshawn.com/directory/location/ta-express-palmyra-palmyra-mo
- https://truckinglifewithshawn.com/directory/location/ta-rawlins-rawlins-wy
- https://truckinglifewithshawn.com/directory/location/ta-express-tampa-seffner-fl
- https://truckinglifewithshawn.com/directory/location/ta-lake-station-lake-station-in

Directory pages that should now include them:

- https://truckinglifewithshawn.com/directory
- https://truckinglifewithshawn.com/directory/truck-stops
- https://truckinglifewithshawn.com/directory/new-locations
- https://truckinglifewithshawn.com/directory/recently-updated
- https://truckinglifewithshawn.com/directory/map

### Note on indexing

All 10 remain `is_indexable = false`, because only `is_published` was
authorized. They are publicly reachable but carry no indexing signal, and they
do not enter the sitemap. Flipping `is_indexable` is a separate, deliberate
step and is **not** part of this canary.

## Rollback

`ROLLBACK-canary-10.sql` reverts exactly these 10 IDs, scoped by the same
source label, with the same exact-count guard. It changes no other column and
no other row, and aborts rather than acting if the matched count is not 10.

```sql
-- verify first (expect 10)
select count(*) from public.locations
where source = 'official-ta-petro-20260725-5ebe0e9f' and is_published;
```

## Not done

The remaining **294** rows stay unpublished. Publishing them, setting
`is_indexable`, and applying Census coordinates each remain separate steps
requiring explicit authorization.

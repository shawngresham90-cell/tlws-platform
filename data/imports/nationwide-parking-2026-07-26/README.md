# Nationwide truck-parking expansion — 2026-07-26

Read-only preparation package. **No database write, publication, insertion or
migration occurred.** Every SQL file that can write is a template with an empty
`VALUES` list and is not executable as committed.

## The short version

The directory has **published truck parking in 10 states**. Forty have none,
including every state on I-80, I-90/I-94, I-10 and I-15, and the whole
Northeast I-95. Of the 76 published parking rows, **45 cannot be placed on a
map** because they have no coordinate.

All 216 previously-unreconciled rows are now classified individually. Thirty-five
of them meet every quality bar for publication **except one field: a rooftop
coordinate**. That field cannot be obtained — every state DOT GIS service,
ArcGIS host, FHWA and USDOT endpoint is blocked at this environment's egress
proxy, verified through both `curl` and `WebFetch`. Policy was not bypassed and
no coordinate was invented.

So: **Tier A = 0, Tier B = 0, Tier C = 181, and no canary is proposed.** What
this package delivers instead is a complete baseline, a per-row reconciliation,
a precise sourcing worklist, and a fully guarded package that runs the moment
one authoritative layer becomes reachable.

## Files

| File | |
|---|---|
| `BASELINE.md` | 50-state coverage matrix, corridor analysis, duplicate and proximity risk |
| `RECONCILIATION.md` | all 216 rows by outcome, facility typing, pairs, the one data defect |
| `RECONCILIATION-216.csv` | per-row detail — id, type, direction, source class, evidence, disposition |
| `RECONCILE.sql` | read-only query that reproduces the CSV from live data |
| `SOURCING-QUEUE.md` | what to fetch per state, ranked by rows unlocked |
| `BLOCKED-SOURCES.md` | every source attempted, the denial evidence, and how to unblock |
| `manifest.json` | the 35 `A-PENDING-COORDINATE` candidates, evidence schema, `eligible_for_canary: false` |
| `CANARY-AND-IMPACT.md` | the canary to run when unblocked, and the arithmetic of what it is worth |
| `ENRICH-TEMPLATE.sql` | guarded, blank-only coordinate enrichment by exact id |
| `PUBLISH-TEMPLATE.sql` | guarded publication, one state per transaction, coordinates required |
| `ROLLBACK-TEMPLATE.sql` | value-matched reversal of both |
| `FINGERPRINT.sql` | before/after digests, including an out-of-scope control digest |

Tests: `scripts/test-parking-expansion.ts` — 87 assertions, in `npm test`.

## Fidelity

`RECONCILIATION-216.csv` is not a hand transcription. Its id set digests to
`1d707c73ad5f2aad741a20b7d88c7d92`, byte-identical to the same digest computed
in the database, and its facility-type and disposition distributions were
re-derived from live data after every correction.

## Order of operations, when unblocked

1. Fetch the agency layer for one state from `SOURCING-QUEUE.md`.
2. Fill `ENRICH-TEMPLATE.sql`'s `VALUES` list with `(id, lat, lng, source_url,
   source_agency, retrieved_on)`. Run it. It is blank-only, so it cannot
   overwrite, and re-running is a no-op.
3. Run `FINGERPRINT.sql` and confirm the out-of-scope control digest
   (`44ad7def9761fa4421060ef8afefaa06` at 2026-07-26) has not moved.
4. Canary 12 rows per `CANARY-AND-IMPACT.md` using `PUBLISH-TEMPLATE.sql`.
   Verify through the directory's own query contract.
5. Publish the remainder, one state per transaction.

Enrichment, publication and insertion are three separate authorizations.

## What is deliberately not here

- No net-new candidate. Discovering one needs the same blocked sources, and a
  candidate with no evidence is not a candidate.
- No canary. An empty canary is the correct output when Tier A is empty.
- No invented coordinate, space count, hours, restriction or amenity. Those
  fields are `null` in the manifest and stay null until an agency states them.
- No traffic, revenue, occupancy or conversion figure.
- No contact with any agency or operator.

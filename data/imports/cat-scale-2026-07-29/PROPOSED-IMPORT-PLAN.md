# PROPOSED CAT Scale import/enrichment plan — INERT, NOT AUTHORIZED, NOT EXECUTED

**HARD GATE (owner-directed, 2026-07-29): every step below additionally
requires WRITTEN data-use permission from CAT Scale covering display and
recurring refreshes — see `USE-POLICY.md`. Without it, the 2,074 net-new
records and the 90 enrichment candidates must not be used publicly at all.**

Nothing in this document has been run. It defines how a future, separately
authorized milestone would act on the reconciliation in
`local/RECONCILIATION.json` (gitignored, private/internal).
All writes would follow the established guarded pattern: per-state
transactions, fail-closed count guards, value-matched rollback committed
before any write, quarantine-not-weaken on any mismatch.

## Sequencing (each step needs its own authorization)

1. **Enrichment canary (recommended first)** — the 90 *safe enrichment
   candidates*: one production row each, host brand agrees, production row
   lacks coordinates. Write ONLY `lat`/`lng` (+ `geocode_source='import'`,
   `geocode_confidence`, `coord_verification_status='machine-checked'`) and
   `zip`/`phone` where empty, from the source row keyed by CATScaleNumber.
   Start with a ≤10-row canary across ≥3 states. Never overwrite an existing
   non-null value (`where lat is null` predicates). This step alone lifts
   Near Me coverage from 32 to ~122 scales.
2. **Exact matches (22)** — no data change needed; record the
   scale-number↔location mapping in the execution record only.
3. **Net-new import (2,074)** — staged, per-state, inserted UNPUBLISHED with
   the full guard set (`is_published=false`, `is_indexable=false`,
   `is_featured=false`), `source='cat-scale-extraction-2026-07-29'`,
   `type='truck_stop'` host-context naming ("CAT Scale at {host}, {city}"),
   strict-parsed `interstate`/`exit_number` only for the 1,688
   single-interstate rows (all others carry NULL route position — never
   guessed). Publication is a separate later gate.
4. **Holds (71)** — 65 possible-duplicates + 6 identity conflicts remain
   quarantined until each is resolved by human review with evidence.
5. **Canada (50)** — held indefinitely; no import authorized.

## Hard rules carried forward

- `ManagerName`/`FaxNumber` never enter the database.
- An exit number is never copied into any mile-marker field (the source
  contains zero explicit mile markers; nothing from this source may ever
  display `MM`).
- No `geo`, `is_featured`, `is_indexable` writes; no schema changes.
- The parking-count recommendation gate is untouched (CAT Scale rows carry
  no parking counts unless separately evidenced).
- Runtime remains published-only throughout; unreviewed rows can never
  become visible by construction.

## Recorded launch display spec (owner decision, 2026-07-29)

Once written permission exists, listings show: CAT Scale number, host
business, street address, public phone, coordinates, and the official CAT
Scale link. Regular data refreshes come from officially provided exports
through the checksum-verified intake — never from scraping catscale.com.
Manager names, fax numbers, and the raw CSV remain unpublishable regardless.

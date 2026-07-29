# CAT Scale data-use policy (owner-directed, 2026-07-29)

Authoritative boundary for everything derived from the official
`extraction.csv` (SHA-256 `82d72c33…f959`), in force until CAT Scale grants
written data-use permission. Basis: CAT Scale's Terms of Use expressly limit
database information to private/internal use and prohibit republishing it,
**including condensed, selective, or tabulated versions**; the U.S. Copyright
Office notes facts themselves aren't protected while compilations can be
protected in their selection and arrangement.

## Permitted now

- The Browse Route and Near Me software (ours; data-source agnostic).
- The **164 published scale listings** — their details are independently
  sourced. Provenance proven read-only: all 207 cat-scales rows were created
  2026-07-10 → 2026-07-15 and last updated 2026-07-26, all **before** the
  export was received (2026-07-29); 0 rows created since; the full database
  digest has been byte-identical across the entire CAT milestone.
- Independently verified facts from truck-stop operators, public records,
  our own research, or business submissions.
- A plain-text link sending drivers to CAT Scale's official locator.
- The words "CAT Scale" solely to identify the service — no partnership
  claim, no logo.
- The CSV **internally** for reconciliation and planning — kept private and
  uncommitted (gitignored `local/`, never in the repository or any public
  artifact).

## Prohibited publicly (until written permission)

- The 2,074 net-new records from the export.
- The 90 enrichment candidates derived from the export.
- Bulk scale numbers, coordinates, addresses, phones, hosts, or CAT URLs
  copied from the export — **including committing them to this (public)
  repository**.
- Any public map or downloadable list generated from their dataset.
- Their logo, graphics, descriptions, manager names, or fax numbers
  (manager names / fax numbers / the raw CSV remain unpublishable even
  after permission).
- Any scraper or automated refresh against catscale.com. Future "regular
  refreshes" mean officially provided exports run through the checksum-
  verified intake — never scraping.

## Remediation applied by this change

`RECONCILIATION.json` (scale-number → classification for 2,289 US rows) and
`CANADA-HELD-MANIFEST.json` (50 rows: number/province/city/host) were
committed by the intake milestone as minimal-risk manifests. Under this
policy they are tabulated derivatives and do not belong in a public
repository: both are **removed from the repo and relocated to the gitignored
`local/` directory**, the intake tool now writes them only there, and the CI
harness enforces that the committed directory contains aggregates and
documentation only. Note honestly: the removed files remain reachable in git
history (PR #208's merged commits) unless the owner separately authorizes a
history rewrite; the working tree, all future commits, and the deployed site
carry none of it.

## Recorded launch spec (activates ONLY on written permission)

When CAT Scale grants written permission covering display and recurring
refreshes, listings may show: scale number, host business, address, public
phone, coordinates, and the official CAT Scale link — with refreshes sourced
from official exports through the guarded intake. Until then the interface
runs on independently sourced listings only.

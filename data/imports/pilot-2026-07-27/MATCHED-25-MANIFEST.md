# The 25 eligible matched rows — publication manifest (NOT EXECUTED)

**Authorization stop, 2026-07-27.** The closeout authorization named **29**
rows and required a stop if the measured set differed. Measured live, the
eligible set is **25** — and "29" turned out to be **two different sets that
coincidentally share the number**, so they are reconciled here explicitly:

- **Set A — the gap report's 29** (matched positive-parking sites not yet
  route-usable): the **25 publication candidates below**, whose rows are
  unpublished, **plus 4 sites whose rows are already PUBLISHED but coordless**
  — the enrichment-quarantined records (#1330 AR `69f1f244`, #1550 AL
  `d7247403`, #353 KY `a8a32662`, #95 FL `76f653aa`). The published-pin
  collision guard blocked their coordinate enrichment, so those four need
  collision-exempted *enrichment*, not publication — there is nothing on
  them to publish. They also fail the authorization's "successfully
  enriched" and "not quarantined" clauses.
- **Set B — the live count of unpublished Pilot-network truck-stops rows**
  (also exactly 29): the same **25 candidates plus 4 unrelated, deliberately
  untouched rows** — held conflicts #24 OH `a458560a` (store-number-state
  mismatch) and #749 VA `9b0bb934` (address contradiction), and
  probable-closure candidates #290 MD `f65fd2ef` and #187 TN `e1c84a38`
  (absent from the export; absence is never closure).

Both sets were enumerated by exact UUID and close at 25 + 4 with zero
unexplained rows; the 25-row intersection is identical. Publication
**stopped before any write**. The prepared package below awaits a corrected
authorization for exactly these 25.

Verification completed before the stop:

- source sha256 re-verified `d39ab57d51999f2468ff2f32790f8ab43a20b859559b0052e353272c9d1e330a`
- all 25 DB rows value-match the official coordinate (≤1e-9°) and parking count
- all 25 are live, `truck-stops`, unpublished, positive-parking, with unique
  existing `detail_slug`s
- read-only collision sweep: **no published pin within ~150 m of any of the 25**
- fingerprints at stop time: control digest `4b5aed26cb6cc4ce1597b53d021a4ef4`
  (1,334 rows), totals 2,265 live / 1,862 published / 1,351 with coords / 555
  published-unmappable
- rollback prepared per row (`PUBLISH-MATCHED-25-ROLLBACK.sql`)

Expected if the 25 publish: published 1,862 → **1,887** · Gate 3a stays
**809/820** · Gate 3b 763 → **788/803**. The originally stated 1,891 and
792/803 assumed 29 rows and cannot be reached without first resolving the four
quarantined records (see QUARANTINE-REVIEW.md).

| # | Official ID | Brand (verbatim) | State | Spaces | DB row | Canary |
|--:|---|---|---|--:|---|:--:|
| 1 | #88 | ONE9 Travel Center | FL | 8 | `ca4da6a3-c18d-4f65-88ec-1076319eb6c5` |  |
| 2 | #90 | Pilot Travel Center | FL | 100 | `e5c73805-b895-443e-ad46-5b33992106d6` | ✓ |
| 3 | #91 | Pilot Travel Center | FL | 17 | `1f226de3-a16d-434e-9db3-2cb86dbf9e31` |  |
| 4 | #622 | Flying J Travel Center | FL | 156 | `9d5b4987-bd0e-4332-ae57-b774ca5ee801` |  |
| 5 | #626 | Flying J Travel Center | FL | 99 | `c372a30e-8b6d-44db-b71f-1a3621ef7a7e` |  |
| 6 | #1047 | Pilot Travel Center | FL | 65 | `b8bff6ef-fb37-4415-9966-9e0ef40bbb4d` |  |
| 7 | #71 | Pilot Travel Center | GA | 112 | `da315672-4e7f-4389-a555-4e4b7aa1d94a` |  |
| 8 | #575 | Pilot Travel Center | GA | 235 | `50cf9353-443d-406e-b1d2-9889112e116c` |  |
| 9 | #627 | Flying J Travel Center | GA | 150 | `f0129700-18d1-49cf-b92f-0be14a549686` |  |
| 10 | #4562 | Pilot Travel Center | GA | 111 | `0fda85a9-364c-4541-99d7-fac38c8f755e` | ✓ |
| 11 | #784 | Flying J Travel Center | MD | 185 | `d56cff01-0dcb-4610-82aa-920d1214a828` |  |
| 12 | #875 | Flying J Travel Center | MD | 230 | `39a7ad06-c801-4b4f-8ea1-3d847839a62c` | ✓ |
| 13 | #58 | ONE9 Travel Center | NC | 42 | `b89a9bb7-6833-4f23-8466-1d6660615cd3` |  |
| 14 | #683 | Flying J Travel Center | NC | 145 | `f97ef111-f094-422a-bc61-7362a0a27d26` |  |
| 15 | #900 | Pilot Dealer | NC | 265 | `438d7ce9-59d8-4fec-b8d5-24f36c3a5481` |  |
| 16 | #6990 | Pilot Travel Center | NC | 125 | `062c24f7-7145-41f3-97f7-431b2d8965b3` | ✓ |
| 17 | #62 | Pilot Travel Center | SC | 75 | `a77f9fde-3b52-4f86-961d-91e168d388d5` | ✓ |
| 18 | #337 | Pilot Travel Center | SC | 90 | `4f23643b-4ec9-471a-beac-7a7538e73adf` |  |
| 19 | #493 | Flying J Travel Center | SC | 118 | `455f776b-7681-45be-8604-fdb9593beb44` |  |
| 20 | #713 | ONE9 Travel Center | SC | 200 | `a109cc92-378c-4d57-ac39-da50a5c2a2c6` |  |
| 21 | #4569 | Pilot Travel Center | SC | 90 | `9ac45310-ac8c-4885-a5aa-ebf787c2f13a` |  |
| 22 | #4584 | Pilot Travel Center | SC | 112 | `989e6437-46b1-45ce-a5b2-7f7d4d0cb18a` |  |
| 23 | #384 | Pilot Travel Center | VA | 110 | `ac64dd0e-2288-4bb0-85b8-2f1913dfd9f6` |  |
| 24 | #898 | Pilot Dealer | VA | 300 | `3f7408df-a39e-46cd-843a-61694fabbe9c` |  |
| 25 | #4651 | Pilot Travel Center | VA | 85 | `8cb6aa2b-13c3-4f79-8b1b-ee434bb8cee8` |  |

By state: FL 6 · GA 4 · MD 2 · NC 4 · SC 6 · VA 3 = **25**.
By brand: Pilot Travel Center 13 · Flying J Travel Center 7 · ONE9 Travel
Center 3 · Pilot Dealer 2.

All 25 sit on the Southeast / Mid-Atlantic corridor block (I-95, I-10, I-75,
I-26, I-40, I-64/I-85 feeders) — exactly the region the enrichment pass was
built to unlock.

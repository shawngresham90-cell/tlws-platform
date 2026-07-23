# DOT Tools — Verification Package (PR 2)

Everything a human needs to verify the 89-row ledger
(`../dot-tools-rule-ledger.md`). Docs only — nothing here implements,
launches, or changes anything.

## How to use this package

1. Owner (or reviewer) works through
   `source-click-through-worksheet.md` — **14 unique source checks**, each
   covering a batch of ledger rows. Stamp date/version + initials per check.
2. The per-domain worksheets (HOS/PC/adverse, violations/SMS, pre-trip,
   roadside/cheat-sheet) carry the row-level questions each source check
   must answer. A source check is complete only when its worksheet
   questions are all answered.
3. `cvsa-licensing-memo.md` records the CVSA ruling (reference-only) and
   what that does to every CVSA-gated row.
4. `attorney-packet.md` goes to counsel as-is; outcomes land in
   `../../dot-tools/decision-log.md` gate records.
5. `reviewer-brief.md` is the one-page onboarding for the independent
   compliance reviewer (OWNER TO ASSIGN).
6. `release-gate-matrix.md` is the live GO/NO-GO board per future tool —
   update it as gates pass.

## Contents

| File | Deliverable |
|---|---|
| `source-click-through-worksheet.md` | Consolidated click-through worksheet, grouped by unique official source (S-1…S-14) |
| `hos-pc-adverse-worksheet.md` | HOS, personal-conveyance, yard-move, adverse-conditions verification |
| `violations-sms-verification-table.md` | All 23 violations + all SMS severity/time-weighting claims |
| `cvsa-licensing-memo.md` | CVSA reference-and-licensing decision memo |
| `roadside-cheatsheet-claims-worksheet.md` | Roadside + cheat-sheet claim review |
| `pretrip-claims-worksheet.md` | Pre-trip claim verification |
| `attorney-packet.md` | Attorney packet (letters, DataQ language, scripts, coaching, signing/arrest claims, disclaimers, wallet disclosure) |
| `reviewer-brief.md` | One-page independent compliance reviewer brief |
| `release-gate-matrix.md` | Release-gate matrix for every future DOT Tool |
| `corrected-legacy-claims.md` | Record of every legacy claim the official source corrects/removes |
| `violations-sms-verification-table.md` | 23-row Appendix A v3.21 comparison (filled) |
| `../../dot-tools/decision-log.md` | Updated owner-decision register (updated in this PR) |

## Ledger status (after S-7 Appendix A v3.21 reconciliation)

**89 rows — VERIFIED 0 · UNVERIFIED 64 · CROSS-REF 10 · BLOCKED 7 ·
SUPERSEDED 8.** Of the UNVERIFIED, **21 rows are SOURCE MATCHED — INDEP.
REVIEW PENDING** (17 violations + 4 SMS-mechanics rows). VERIFIED stays 0:
a source match does not promote a row — only the independent reviewer's
countersignature does. The 8 SUPERSEDED rows are where Appendix A v3.21
directly contradicts the legacy app (6 violations + universal OOS +2 +
invented bands); see `corrected-legacy-claims.md`. Full detail and the
tally correction note are in `../dot-tools-rule-ledger.md`.

## Standing rules (owner decisions, restated)

US-only MVP; Canada blocked except clearly labeled official link-outs.
Core tools eventually free; no gate removal yet. Wallet device-local.
CVSA material is **reference-only** unless proper access or permission is
obtained. **Official FMCSA DataQs (dataqs.fmcsa.dot.gov) is the primary
DataQ link** wherever DataQs are mentioned. Fix-It Letters blocked until
attorney review. Old-app migration banner + vault export approved **in
principle** for a later implementation PR. Existing Pro customers counted
and reviewed before paid access is removed.

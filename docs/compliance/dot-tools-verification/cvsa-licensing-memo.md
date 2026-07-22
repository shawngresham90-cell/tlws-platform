# CVSA Reference-and-Licensing Decision Memo

**Owner ruling (July 22, 2026):** CVSA material is **reference-only unless
proper access or permission is obtained.**

## Background

The CVSA North American Standard Out-of-Service Criteria is a controlled
publication of the Commercial Vehicle Safety Alliance, updated annually
(effective each April 1), sold/licensed by CVSA. It is not free public
regulation text like the eCFR. The legacy app hardcodes several numeric
claims that trace to it: ~3 psi/min air-loss (R-PT-09), 85 psi governor
cut-in framing (R-PT-10), 20 % defective-brakes vehicle-OOS (R-PT-11),
"automatic OOS" characterizations (R-VIO-14, R-PT-14), and inspection-
procedure framing (R-CS-04).

## What "reference-only" means in practice

1. **No reproduction of CVSA numeric criteria** in shipped TLWS content
   unless the owner obtains the current edition plus any permission its
   license requires for public-facing paraphrase. Reading a lawfully
   obtained copy to check our own text is fine; publishing its thresholds
   as our content is not, absent that review.
2. **Softened language ships instead.** Every CVSA-gated claim is rewritten
   to the pattern: *"Officers apply the CVSA Out-of-Service Criteria to
   this — measured thresholds apply. If [defect] is present, expect an
   out-of-service determination risk."* — accurate, non-numeric, and
   points at the officer's real standard.
3. **CFR-sourced numbers stay.** Where a number lives in the eCFR itself
   (tread depths 393.75, windshield-crack zone 393.60), it verifies through
   S-3 and ships normally — those are not CVSA property.
4. **The Roadside/Pre-Trip verdicts remain valid** under softened language:
   DO NOT MOVE / HIGH RISK framing does not depend on quoting a threshold.

## Row-by-row effect

| Row | Legacy claim | Ships as |
|---|---|---|
| R-PT-09 | ">~3 psi/min = OOS" | Softened pattern (no number) |
| R-PT-10 | "governor cut-in below 85 psi = park it" | Softened; the underlying performance requirement may verify via 393.50-series (S-3) — if the number is CFR-anchored, it may ship with that cite |
| R-PT-11 | "20 % of brakes = vehicle OOS" | Softened pattern |
| R-PT-14 | "fuel leak of ANY kind = automatic OOS" | Softened ("expect OOS") unless CFR-anchored via 393.83/396.7 |
| R-VIO-14/16/17 "automatic OOS" phrasings | | "OOS-listed — expect an out-of-service determination" |
| R-CS-04 | "5 common OOS triggers" | Keep list; statistics claims verify via S-13; no CVSA numerics |

## Upgrade path (if the owner later obtains access/permission)

Obtain the current-year edition → record edition/effective date in the
ledger rows → counsel confirms the license permits the intended use →
numeric claims may then ship with an edition stamp and a re-verification
tick each April. Until then, the softened pattern is the shipped standard.

## Decision record

- Ruling: reference-only. Recorded in `../../dot-tools/decision-log.md`
  (resolves O-3, subject to the upgrade path).
- Effect on gates: RC-3 (Pre-Trip) and the CVSA aspects of RC-2/RC-4 can
  now proceed on softened language + CFR-anchored numbers only — the CVSA
  publication is no longer a launch blocker.

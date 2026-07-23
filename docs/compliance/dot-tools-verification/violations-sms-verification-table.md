# Verification Table — 23 Violations + SMS Mechanics

Working table for the S-7 click-through (plus S-1…S-5, S-11, S-12 for the
regulatory cites). For each violation: confirm the cite anchors the named
conduct, the severity weight matches the current SMS Appendix A, the BASIC
is right, and the OOS flag reflects the current OOS-relevant listing.
Fill "Found" columns from the official table; mismatches go to the
reviewer with notes — the ported DB uses the **found** values, never the
legacy ones.

**FILLED from Appendix A v3.21** (snapshot 05/15/2026,
`sms_appendixa_violationslist_3.xlsx`). "Sev found" and codes are the
official values; the ported DB uses these, never the legacy ones. Match =
source-matched (still needs reviewer countersignature); ✗ = SUPERSEDED.

Legend: Sev(app) = legacy app's value. DSMS = whether the code is in the
**Driver** SMS.

| Row | Violation | Cite (app)→Sev | Appendix A v3.21 code · group · sev · DSMS | Match? | Notes |
|---|---|---|---|---|---|
| R-VIO-01 | Driving beyond 11-hr limit | 395.3(a)(3)(i)→7 | `395.3A3I-HOSPDIT` · Hours · 7 · Y | ✓ sev | refine to SMS code |
| R-VIO-02 | Driving beyond 14-hr window | 395.3(a)(2)→7 | `395.3A2-HOSPD`/`-PROP`/`A2R` · Hours · 7 · Y | ✓ sev | nominal-at-inspection variants weigh 1 |
| R-VIO-03 | 30-min break violation | 395.3(a)(3)(ii)→7 | `395.3(a)(3)(ii)` EXACT · Hours · 7 · Y | ✓ | — |
| R-VIO-04 | No RODS / ELD not functioning | 395.8(a)→5 | bare `395.8(a)` Form&Manner · **1**; no-RODS `395.8A-NON-ELD`/`-ELD` · 5 · Y | ✗ | **SUPERSEDED** — sev 5 invalid for bare cite; narrow to form&manner vs no-RODS |
| R-VIO-05 | False report of duty status | 395.8(e)→7 | `395.8(e)` EXACT · False Log · 7 · Y | ✓ | — |
| R-VIO-06 | Log not current | 395.8(f)(1)→5 | `395.8(f)(1)` EXACT · Incomplete/Wrong Log · 5 · Y | ✓ | — |
| R-VIO-07 | Hand-held phone | 392.82→10 | `392.82(a)(1)` · Phone Call · 10 · Y · no OOS wt | ✓ sev | code→392.82(a)(1); $2,750 → S-11 |
| R-VIO-08 | Texting | 392.80→10 | `392.80(a)` · Texting · 10 · Y · no OOS wt | ✓ sev | code→392.80(a) |
| R-VIO-09 | No seat belt | 392.16→7 | `392.16` EXACT · Seat Belt · 7 · Y · no OOS wt | ✓ | — |
| R-VIO-10 | Speeding 6–10 over | 392.2-SLLS2→4 | `392.2-SLLS2` EXACT · Speeding 2 · 4 · Y · no OOS wt | ✓ | — |
| R-VIO-11 | Speeding 11–14 over | 392.2-SLLS3→7 | `392.2-SLLS3` EXACT · Speeding 3 · 7 · Y · no OOS wt | ✓ | — |
| R-VIO-12 | Speeding 15+ over | 392.2-SLLS4→10 | `392.2-SLLS4` EXACT · Speeding 4 · 10 · Y · no OOS wt | ✓ | — |
| R-VIO-13 | Inoperative lamp | 393.9→**6** | `393.9` EXACT · Clearance ID Lamps/Other · **2** · Y | ✗ | **SUPERSEDED — sev 6→2** |
| R-VIO-14 | Flat tire / fabric / leak | 393.75(a)→8 | `393.75(a)` EXACT · Tires · 8 · Y | ✓ sev | OOS wording still CVSA-gated |
| R-VIO-15 | Tread below minimum | 393.75(b)/(c)→8 | `393.75(b)` (front <4/32) + `393.75(c)` (other <2/32) · Tires · 8 · Y | ✓ | compound cite legitimate |
| R-VIO-16 | Brake out of adjustment | 393.47(e)→4 | `393.47(e)` EXACT · Brakes Out of Adj. · 4 · **N** | ✓ sev | **DSMS=N — not a Driver SMS point** |
| R-VIO-17 | Brake hose chafed/leaking | 393.45→4 | bare `393.45` **DSMS N**; chafe/leak `393.45(b)(2)` · 4 · Y | ✗ | **SUPERSEDED** — narrow to 393.45(b)(2) |
| R-VIO-18 | Mud flap missing | 393.87→1 | `393.87`=**Warning Flags (WRONG)**; mud flap `392.2-SLLMF` · Windshield/Glass/Markings · 1 · Y | ✗ | **SUPERSEDED — cite→392.2-SLLMF** |
| R-VIO-19 | Emergency equipment missing | 393.95→2 | `393.95(a)` family · Emergency Equipment · 2 · Y | ✓ sev | code→specific sub |
| R-VIO-20 | Cargo securement insufficient | 393.100→**7** | bare `393.100`=**1** (General); `393.100(b)` leaking/falling=7 · Y | ✗ | **SUPERSEDED** — split general(1) vs 393.100(b)(7) |
| R-VIO-21 | Med cert not in possession | 391.41(a)→1 | `391.41(a)` EXACT · Medical Certificate · 1 · Y | ✓ | — |
| R-VIO-22 | Med cert expired | 391.41(a)→**7** | `391.41(a)`=**1**; 391.41 family all low | ✗ | **SUPERSEDED — sev 7 unsupported**; distinguish expiration from operating-while-unqualified |
| R-VIO-23 | No valid CDL for class | 383.23(a)(2)→8 | `383.23(a)(2)` EXACT · License-related: High · 8 · Y | ✓ | — |

**Result: 17 source-matched (✓, review pending) · 6 SUPERSEDED (✗:
R-VIO-04, 13, 17, 18, 20, 22).** Every ✓ still needs the independent
reviewer's countersignature before final VERIFIED; the ATTORNEY gate on the
"what to say" scripts and the CVSA gate on OOS-wording claims are unchanged.

## SMS mechanics claims (rows R-SMS-01…08)

| Row | Claim (app) | Found in v3.21 | Outcome |
|---|---|---|---|
| R-SMS-01 | +2 severity when placed OOS (universal) | OOS weight only where the BASIC authorizes; **Unsafe Driving never**; not universal | **SUPERSEDED** — rebuild BASIC-aware |
| R-SMS-02 | Time weight ×3/×2/×1 | 0–6 mo=3 · over 6–12=2 · over 12–24=1 · **>24=excluded** | Source matched · review pending · relabel + add exclusion |
| R-SMS-03 | 24-month window | 24-month SMS event window | Source matched · review pending |
| R-SMS-04 | PSP 3 yr / 5 yr | not in S-7 (→ S-8) | UNVERIFIED |
| R-SMS-05 | Warning vs citation both count | not addressed in S-7 | UNVERIFIED |
| R-SMS-06 | BASIC mapping of all 23 rows | BASIC/group confirmed per §C table above | Source matched (all 23) · review pending |
| R-SMS-07 | ≥21 "Heavy" / ≥10 "Moderate" bands | no methodology basis | **SUPERSEDED — REMOVE** (owner order) |
| R-SMS-08 | "Approximate" framing | approved string below | Source matched · review pending |

**R-SMS-08 approved output string:** "Estimated SMS weighted value based on
public methodology." **Banned labels:** CSA score · PSP score · official
FMCSA score · carrier percentile · points against your CDL · guaranteed
company impact.

**Version stamp for this table:** SMS Methodology **v3.21** (methodology
revised May 2026; doc revised June 2026) + Appendix A **v3.21** (snapshot
implemented **05/15/2026**) · read from `sms_appendixa_violationslist_3.xlsx`
· source captured by owner · **independent reviewer countersignature: PENDING.**

Note: severity weights attach to specific SMS violation codes, not bare CFR
cites — during verification, record the exact SMS code used for each row
(e.g. the speeding rows' 392.2-SLLS* pattern) so the ported DB carries both
the CFR cite and the SMS code.

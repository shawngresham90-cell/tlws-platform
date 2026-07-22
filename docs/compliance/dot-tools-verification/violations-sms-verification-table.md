# Verification Table — 23 Violations + SMS Mechanics

Working table for the S-7 click-through (plus S-1…S-5, S-11, S-12 for the
regulatory cites). For each violation: confirm the cite anchors the named
conduct, the severity weight matches the current SMS Appendix A, the BASIC
is right, and the OOS flag reflects the current OOS-relevant listing.
Fill "Found" columns from the official table; mismatches go to the
reviewer with notes — the ported DB uses the **found** values, never the
legacy ones.

Legend: Sev(app) = legacy app's value. Blank cells are filled during
verification.

| Row | Violation | Cite (app) | Cite OK? | BASIC (app) | Sev(app) | Sev found | OOS (app) | OOS found | Notes to check |
|---|---|---|---|---|---|---|---|---|---|
| R-VIO-01 | Driving beyond 11-hr limit | 395.3(a)(3)(i) | | HOS Compliance | 7 | | yes | | |
| R-VIO-02 | Driving beyond 14-hr window | 395.3(a)(2) | | HOS Compliance | 7 | | yes | | |
| R-VIO-03 | 30-min break violation | 395.3(a)(3)(ii) | | HOS Compliance | 7 | | no | | |
| R-VIO-04 | No RODS / ELD not functioning | 395.8(a) | | HOS Compliance | 5 | | yes | | 395.34 8-day + 24-hr notice claims |
| R-VIO-05 | False report of duty status | 395.8(e) | | HOS Compliance | 7 | | yes | | |
| R-VIO-06 | Log not current | 395.8(f)(1) | | HOS Compliance | 5 | | no | | right-to-update-at-stop claim |
| R-VIO-07 | Hand-held phone | 392.82 | | Unsafe Driving | 10 | | no | | $2,750 figure → S-11; disqualification claim |
| R-VIO-08 | Texting | 392.80 | | Unsafe Driving | 10 | | no | | 2-in-3-years/60-day claim → 383.51 |
| R-VIO-09 | No seat belt | 392.16 | | Unsafe Driving | 7 | | no | | |
| R-VIO-10 | Speeding 6–10 over | 392.2-SLLS2 | | Unsafe Driving | 4 | | no | | group code exists as cited? |
| R-VIO-11 | Speeding 11–14 over | 392.2-SLLS3 | | Unsafe Driving | 7 | | no | | "serious violation" claim → 383.51 Table 2 |
| R-VIO-12 | Speeding 15+ over | 392.2-SLLS4 | | Unsafe Driving | 10 | | no | | |
| R-VIO-13 | Inoperative lamp | 393.9 | | Vehicle Maint. | 6 | | no | | |
| R-VIO-14 | Flat tire / fabric / leak | 393.75(a) | | Vehicle Maint. | 8 | | yes | | "automatic OOS" → CVSA memo path |
| R-VIO-15 | Tread below minimum | 393.75(b)/(c) | | Vehicle Maint. | 8 | | yes | | 4/32–2/32 + groove-measurement claim |
| R-VIO-16 | Brake out of adjustment | 393.47(e) | | Vehicle Maint. | 4 | | yes | | 20% claim → CVSA memo path |
| R-VIO-17 | Brake hose chafed/leaking | 393.45 | | Vehicle Maint. | 4 | | yes | | |
| R-VIO-18 | Mud flap missing | 393.87 | | Vehicle Maint. | 1 | | no | | **cite suspect** — 393.87 appears to be projecting-load flags; find correct authority |
| R-VIO-19 | Emergency equipment missing | 393.95 | | Vehicle Maint. | 2 | | no | | triangles/extinguisher/fuses list |
| R-VIO-20 | Cargo securement insufficient | 393.100 | | Vehicle Maint. | 7 | | yes | | WLL ≥ ½ cargo weight → 393.106 |
| R-VIO-21 | Med cert not in possession | 391.41(a) | | Driver Fitness | 1 | | no | | correct paragraph? CDLIS-era possession rules for CDL drivers |
| R-VIO-22 | Med cert expired | 391.41(a) | | Driver Fitness | 7 | | yes | | distinct SMS code from R-VIO-21? |
| R-VIO-23 | No valid CDL for class | 383.23(a)(2) | | Driver Fitness | 8 | | yes | | |

## SMS mechanics claims (rows R-SMS-01…08)

| Row | Claim (app) | Confirm in current methodology | Found | Outcome |
|---|---|---|---|---|
| R-SMS-01 | +2 severity when placed OOS | OOS adjustment rule + cap behavior (does sev+2 cap at 10?) | | |
| R-SMS-02 | Time weight ×3 (<6 mo) / ×2 (6–12 mo) / ×1 (1–2 yr) | Exact band boundaries + carrier-size variants if any | | |
| R-SMS-03 | 24-month carrier window | Observation period | | |
| R-SMS-04 | PSP 3 yr violations / 5 yr crashes | PSP site (S-8) | | |
| R-SMS-05 | Warning vs citation both count | Inspection-based scoring statement | | |
| R-SMS-06 | BASIC mapping of all 23 rows | Appendix A group assignments | | |
| R-SMS-07 | ≥21 "Heavy" / ≥10 "Moderate" bands | **No official basis expected — TLWS invention.** Outcome is REMOVE or relabel as TLWS editorial framing (BLOCKED until respec) | n/a | |
| R-SMS-08 | "Approximate" framing | Spec rule: display as "estimate based on public SMS methodology — not your official score" + link to official site | n/a | |

**Version stamp for this whole table:** SMS methodology document title +
version/date: ____________ · viewed ____________ · initials ______

Note: severity weights attach to specific SMS violation codes, not bare CFR
cites — during verification, record the exact SMS code used for each row
(e.g. the speeding rows' 392.2-SLLS* pattern) so the ported DB carries both
the CFR cite and the SMS code.

# DOT Tools — Consolidated Source Click-Through Worksheet

**14 unique source checks** cover all 89 ledger rows. Each check: open the
URL, confirm the listed items against the current official text, stamp the
source date/version shown on the page, initial, and mark the covered ledger
rows' status in `../dot-tools-rule-ledger.md`.

Stamp format per check: `[ ] DONE · date viewed · source version/date ·
initials · notes`. A check with any failed item goes to the reviewer with
notes — do not part-verify a row.

The development sandbox cannot reach ecfr.gov — every check below is a
human action (same process as the Split Sleeper package).

---

### S-1 · eCFR — 49 CFR Part 395 (Hours of Service)
**URL:** https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395
**Covers rows:** R-HOS-01…12, R-PC-01…09 (definitions), R-YM-01…03, R-VIO-01…06 (cites only)
Confirm: 395.3(a)(1)/(a)(2)/(a)(3)(i)/(a)(3)(ii)/(b)(1)/(b)(2)/(c) wording;
395.1(b)(1) adverse text (exact qualifying-conditions definition **and**
whether it extends the 14-hr window for property drivers); 395.1(o) 16-hr
exception conditions; 395.2 definitions (on-duty, PC, yard-move handling);
395.8(a)/(e)/(f)(1); 395.28 — verify it is the correct anchor for
yard-move/special driving categories (it may not be; record the right one);
395.34 ELD malfunction (8-day + written-notice claims in R-VIO-04).
`[ ] DONE · ____ · ____ · ____ · ____`

### S-2 · eCFR — Part 392 sections (Driving rules)
**URL:** https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-392
**Covers rows:** R-VIO-07 (392.82), R-VIO-08 (392.80), R-VIO-09 (392.16), R-VIO-10…12 (392.2 basis), R-RS-01 (392.2 card)
Confirm section wording; the phone/texting penalty and disqualification
claims ($2,750 figure — check current civil-penalty schedule in 386 App. B;
60-day disqualification via 383.51 Table 2).
`[ ] DONE · ____ · ____ · ____ · ____`

### S-3 · eCFR — Part 393 sections (Equipment)
**URL:** https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-393
**Covers rows:** R-VIO-13…20, R-PT-01/02/04/07 (cites), R-PT-12/13
Confirm: 393.9 lamps; 393.45 hoses; 393.47(e) adjustment cite; 393.55 ABS;
393.60(c) windshield zone rules (1/4", intersecting cracks, wiper-swept
area); 393.75(a)/(b)/(c) incl. 4/32–2/32 tread; 393.83; **393.87 — the app
cites it for mud flaps; confirm whether 393.87 actually covers flaps (it
appears to be warning flags on projecting loads) and record the correct
authority (state law + splash-guard provisions)**; 393.95 emergency
equipment list; 393.100 securement + the aggregate-WLL ≥ ½-cargo-weight
claim (verify against 393.106).
`[ ] DONE · ____ · ____ · ____ · ____`

### S-4 · eCFR — Part 396 (Inspection/maintenance) + 2014 DVIR relief
**URLs:** https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-396 · Federal Register 79 FR 75437 (Dec 18, 2014, "Driver-Vehicle Inspection Reports — No-Defect DVIR" final rule; confirm exact citation)
**Covers rows:** R-RS-02 (**correction row**), R-PT-03/05/08 (396.7 cites)
Confirm current 396.11(a) text: whether property-carrier drivers must file
a DVIR when **no** defect is found. The legacy claim ("written DVIR every
day for every vehicle") is expected to be wrong post-2014 — write the
corrected statement into the row.
`[ ] DONE · ____ · ____ · ____ · ____`

### S-5 · eCFR — Parts 391 + 383 (Driver fitness / CDL)
**URLs:** …/part-391 · …/part-383
**Covers rows:** R-VIO-21/22 (391.41(a) — confirm the correct paragraph for
possession vs certification; current rule ties med-cert to CDLIS for CDL
drivers), R-VIO-23 (383.23(a)(2)), R-VIO-11's 383.51 disqualification table,
R-CS-02 (carry list)
`[ ] DONE · ____ · ____ · ____ · ____`

### S-6 · eCFR — Subchapter B table of contents + versioner API
**URLs:** https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B · https://www.ecfr.gov/developers/documentation/api/v1
**Covers rows:** R-IDX-01…05
Confirm: all 39 part numbers/titles (spot-check the 147 section titles —
minimum 20-section sample across 10 parts, full pass before browser
launch); 355/388/394 reserved status; versioner API date semantics
(`up_to_date_as_of`) so the honest-status respec displays the true data
date.
`[ ] DONE · ____ · ____ · ____ · ____`

### S-7 · FMCSA SMS Methodology + Appendix A (severity tables)
**URL:** https://csa.fmcsa.dot.gov/ (Methodology section — record the exact document title + version)
**Covers rows:** all 23 severity weights (R-VIO-01…23), R-SMS-01/02/03/05/06, R-VIO-10…12 group codes (392.2-SLLS2/3/4)
Confirm each violation's severity weight and BASIC in the current Appendix
A table; the OOS +2 adjustment; time weights (3/2/1 bands and their exact
month boundaries); the 24-month observation window; warning-vs-citation
treatment. Record the methodology version — it revises.
`[x] DONE · viewed via sms_appendixa_violationslist_3.xlsx · v3.21 (Appendix A snapshot 05/15/2026; methodology revised May 2026, doc June 2026) · owner-supplied · all 23 codes matched — see violations-sms-verification-table.md`
Result: 17 source-matched (review pending) · 6 SUPERSEDED (R-VIO-04/13/17/18/20/22).
Time weights confirmed 3/2/1/excluded; OOS +2 is BASIC-conditional, never
Unsafe Driving; ≥10/≥21 bands have no basis (removed). **Warning-vs-citation
(R-SMS-05) not addressed in this file — remains UNVERIFIED.** DSMS(Y/N) column
captured; brakeadj 393.47(e) and bare brakehose 393.45 are DSMS=N.

### S-8 · FMCSA PSP program
**URL:** https://psp.fmcsa.dot.gov/
**Covers rows:** R-SMS-04
Confirm 3-year violation / 5-year crash retention as currently published.
`[ ] DONE · ____ · ____ · ____ · ____`

### S-9 · FMCSA DataQs
**URL:** https://dataqs.fmcsa.dot.gov/
**Covers rows:** R-LT-01
Confirm the RDR process description. **Owner decision applied: this
official URL is the primary DataQ link in every future tool; the DataQ
Tracker app (godatq.netlify.app) may appear only as a clearly secondary,
clearly TLWS-branded helper link.**
`[ ] DONE · ____ · ____ · ____ · ____`

### S-10 · FMCSA Personal Conveyance + Yard Move guidance
**URL:** locate current regulatory guidance on fmcsa.dot.gov (PC guidance published 2018-05-31; record docket/FR citation) + any yard-move guidance/ELD FAQ
**Covers rows:** R-PC-01…08, R-YM-01/02
Confirm each PC example the tool relies on (nearest-safe-parking, personal
errand, home↔terminal commute **and its conditions**, officer-ordered
moves, laden-vehicle position, business-positioning disqualifier). Confirm
the yard-move status authority and property-scope conditions. Note: the
30-minute "long move" threshold is TLWS editorial — confirm no numeric
threshold exists in guidance so it must stay labeled as ours (R-PC-06).
`[ ] DONE · ____ · ____ · ____ · ____`

### S-11 · Civil penalty schedule (49 CFR Part 386 App. B)
**URL:** https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-386
**Covers rows:** the "$2,750" phone-fine figure in R-VIO-07 (penalty amounts index annually — record the current figure and replace the hardcoded number with a maintained value or drop the number)
`[ ] DONE · ____ · ____ · ____ · ____`

### S-12 · CVSA North American Standard Out-of-Service Criteria
**Access:** per `cvsa-licensing-memo.md` — **reference-only ruling**; do not reproduce numeric criteria without obtaining the current edition or permission
**Covers rows:** R-PT-09/10/11/14, CVSA aspects of R-VIO-14…17, R-PT-01…03/05/08, R-CS-04
Until access/permission exists, these rows verify only to the softened,
non-numeric language defined in the memo.
`[ ] DONE (memo path) · ____ · ____ · ____ · ____`

### S-13 · FMCSA inspection/violation statistics
**URL:** FMCSA Analysis & Information (A&I) public data — record the dataset + year used
**Covers rows:** R-RS-01 ("top 5 regs cited"), R-CS-06 ("most common violation"), R-CS-04 ranking claims
Statistical claims must cite the dataset year or be softened to
non-superlative language ("among the most common").
`[ ] DONE · ____ · ____ · ____ · ____`

### S-14 · Justice Canada — SOR/2005-313 (link-out verification only)
**URL:** https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-313/
**Covers rows:** R-CA-01 (BLOCKED content; this check only verifies the
official link-out target resolves and is correctly labeled)
`[ ] DONE · ____ · ____ · ____ · ____`

---

## Coverage map

All 89 rows map to at least one check: A→S-1 · B→S-1,S-10 · C→S-1…S-5,S-7,S-11,S-12 ·
D→S-7,S-8 · E→S-3,S-4,S-12 · F→S-6 · G→S-3,S-5,S-12,S-13 (+attorney) ·
H→S-2,S-4,S-13 (+attorney) · I→S-9 (+attorney) · J→S-14.
Attorney-gated language (scripts, coaching, signing/arrest claims,
letters) is out of scope for these checks — it goes through
`attorney-packet.md` regardless of source verification.

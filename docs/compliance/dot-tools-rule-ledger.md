# TLWS DOT Tools — Regulatory Rule Ledger

**Status:** SEEDED — every row starts UNVERIFIED or BLOCKED. Nothing in this
ledger is VERIFIED because it "already works" in the standalone app; existing
application behavior is evidence of nothing.
**Source app:** standalone Reg Deck (legacy Netlify deploy), full source
audited July 22, 2026 — see `docs/dot-tools/inventory.md`.
**Process:** identical to `split-sleeper-rule-ledger.md` — a row reaches
VERIFIED only after (a) a human click-through of the primary source with the
source date/version stamped into the row, and (b) sign-off by the assigned
reviewer. WebSearch corroboration alone is not sufficient.

## Row defaults (apply to every row unless the row states otherwise)

- **Source date/version:** UNSTAMPED — recorded at human click-through.
- **Reviewer:** OWNER (click-through) + independent regulatory reviewer
  (OWNER TO ASSIGN — same reviewer pipeline as the Split Sleeper ledger).
- **Failure behavior:** if a rule a verdict depends on is UNVERIFIED or
  BLOCKED at runtime scope, the tool must not compute that path — it returns
  **CAN'T CALL IT** with a link to the official source. No silent fallback.
- **Re-verification schedule:** quarterly, plus immediately on any Federal
  Register final rule touching Part 380–399, any SMS methodology revision,
  or any CVSA OOS criteria annual update.
- **Jurisdiction:** US property-carrying interstate unless stated.

## Status vocabulary

| Status | Meaning |
|---|---|
| UNVERIFIED | Row seeded from app behavior/public knowledge; awaiting click-through + reviewer |
| BLOCKED | May not ship in any form until the listed condition clears |
| CROSS-REF | Governed by an existing platform ledger row; inherits that row's status |
| REMOVE | Current app behavior will not be ported; row exists to record the decision |

Gate column values: `REG` (regulatory verification), `ATTORNEY` (counsel
review required before the language ships), `CVSA` (needs the current CVSA
Out-of-Service Criteria publication — see Unresolved Sources).

---

## A. Hours of Service — "Before You Move" (12 rows)

| ID | Tool / path | Current app behavior | Primary source | Minimum operative language needed | TLWS interpretation to verify | Status | Gate |
|---|---|---|---|---|---|---|---|
| R-HOS-01 | BYM · driving limit | 11 hr max driving after 10 hr off | 49 CFR 395.3(a)(3)(i) | Max driving time following 10 consecutive hours off duty | 11-hour limit as engine-encoded | CROSS-REF → `hos-verification.md` | REG |
| R-HOS-02 | BYM · window | 14 hr window from on-duty start; "breaks don't stop it" | 49 CFR 395.3(a)(2) | Driving not permitted beyond 14th hour after coming on duty; off-duty time does not extend | 14-hour window as engine-encoded | CROSS-REF → `hos-verification.md` | REG |
| R-HOS-03 | BYM · break | 30-min break required when ≥8 hr driven since last 30-min interruption; off-duty, sleeper, or on-duty-not-driving all qualify | 49 CFR 395.3(a)(3)(ii) | Break of ≥30 consecutive min after 8 cumulative hrs driving without ≥30-min interruption | Post-2020 rule: non-driving status qualifies | CROSS-REF → `hos-verification.md` | REG |
| R-HOS-04 | BYM · reset | 10 consecutive hours off restores daily clocks | 49 CFR 395.3(a)(1) | 10 consecutive hours off duty requirement | As engine-encoded | CROSS-REF → `hos-verification.md` | REG |
| R-HOS-05 | BYM · cycle | 60 hr / 7 days option | 49 CFR 395.3(b)(1) | 60-hr/7-day on-duty limit (non-daily carriers) | As engine-encoded | CROSS-REF → `hos-verification.md` | REG |
| R-HOS-06 | BYM · cycle | 70 hr / 8 days option | 49 CFR 395.3(b)(2) | 70-hr/8-day on-duty limit (daily carriers) | As engine-encoded | CROSS-REF → `hos-verification.md` | REG |
| R-HOS-07 | BYM · restart | "34-hour restart" referenced in park-it verdict text | 49 CFR 395.3(c) | 34 consecutive hours off restarts the cycle | As engine-encoded | CROSS-REF → `hos-verification.md` | REG |
| R-HOS-08 | BYM · usable-time display | **DEFECT:** app displays min(drive, window, cycle) and ignores the impending 30-min break, overstating uninterrupted driving time | 395.3(a)(3)(ii) + shared-engine spec | Usable time must be capped by (8 hr − driving since last qualifying break) when smaller | New display rule: usable-now vs after-break split, limiting clock named | UNVERIFIED (new spec, not app port) | REG |
| R-HOS-09 | BYM · adverse | **Toggle auto-adds +2 to the 11-hr driving limit** | 49 CFR 395.1(b)(1) | Exact qualifying-conditions definition ("could not reasonably have been known at dispatch") | Owner Decision 10: no auto-toggle; decision questions + reviewer approval required first | **BLOCKED** (D-10) | REG |
| R-HOS-10 | BYM · adverse | **Toggle auto-adds +2 to the 14-hr window** | 49 CFR 395.1(b)(1) (post-2020 wording) | Whether/how the exception extends the 14-hr window for property drivers | Must be independently verified; engine stub currently supports neither extension | **BLOCKED** (D-10) | REG |
| R-HOS-11 | BYM · split sleeper | Not modeled; verdict text says "or a legal split" without computing it | 49 CFR 395.1(g) | Split pairing rules | Split inputs must trigger CAN'T CALL IT until the Split Calculator ledger (R1–R15) clears and the shared engine path is approved | **BLOCKED** → `split-sleeper-rule-ledger.md` | REG |
| R-HOS-12 | BYM · short-haul | "16-hour short-haul exception" name-dropped in a fix[] string | 49 CFR 395.1(o) | 16-hr exception conditions (property, once per cycle, return-to-location) | Either verify fully or strip the mention; no half-references | UNVERIFIED | REG |

## B. Personal Conveyance & Yard Move (12 rows)

| ID | Tool / path | Current app behavior | Primary source | Minimum operative language needed | TLWS interpretation to verify | Status | Gate |
|---|---|---|---|---|---|---|---|
| R-PC-01 | BYM·PC | PC framed as off-duty driving | 49 CFR 395.2 (definitions) + FMCSA PC guidance (2018-05-31, as cited by app) | Definition of personal conveyance as off-duty status | Framing accurate | UNVERIFIED | REG |
| R-PC-02 | BYM·PC | Not relieved of duty ⇒ "DO NOT USE PC" | Same | Relief-from-duty precondition | Hard-kill condition | UNVERIFIED | REG |
| R-PC-03 | BYM·PC | Move advances the load ⇒ kill | Same | Commerce-advancement disqualifier | Hard-kill condition | UNVERIFIED | REG |
| R-PC-04 | BYM·PC | Dispatch-directed move ⇒ kill ("that's work") | Same | Carrier-directed movement is on-duty | Hard-kill condition | UNVERIFIED | REG |
| R-PC-05 | BYM·PC | Home↔terminal commute treated as valid PC purpose | FMCSA PC guidance examples | Commuting example scope + limits | Whether commute qualifies unconditionally (it does not — needs conditions) | UNVERIFIED | REG |
| R-PC-06 | BYM·PC | Long move (≥30 min) ⇒ "HIGH RISK"; "nearest reasonably safe location" standard | FMCSA PC guidance | Nearest-safe-location language; whether a numeric time threshold exists at all | The 30-min threshold is a **TLWS invention** — must be labeled as editorial risk heuristic, never as regulation | UNVERIFIED | REG |
| R-PC-07 | BYM·PC | Officer/facility-ordered move while out of hours allowed as PC to nearest safe spot | FMCSA PC guidance | Ordered-movement example scope | Conditions + annotation duty | UNVERIFIED | REG |
| R-PC-08 | BYM·PC | "Laden or empty doesn't matter — purpose does" | FMCSA PC guidance | Laden-vehicle position | Accurate per guidance; verify wording | UNVERIFIED | REG |
| R-PC-09 | BYM·PC | PC misuse = false log, §395.8(e), "severity 7" | 49 CFR 395.8(e) + SMS App. A | False-log provision + its SMS weight | Severity number belongs to R-SMS rows | UNVERIFIED | REG |
| R-YM-01 | BYM·yard | Yard move = on-duty driving under ELD special category, §395.28 | 49 CFR 395.28 + ELD rule | Yard-move special driving category authority | Cite may actually be 395.8(f)/ELD functional specs — verify the correct anchor | UNVERIFIED | REG |
| R-YM-02 | BYM·yard | Valid only on private property/controlled yard; public road = Driving | FMCSA yard-move guidance | Property-scope conditions | Boundary conditions | UNVERIFIED | REG |
| R-YM-03 | BYM·yard | "Still burns your 14-hour window" | 395.3(a)(2) + on-duty definition | Yard-move time is on-duty time | Accurate framing | UNVERIFIED | REG |

## C. Violation Database (23 rows)

Claims per row: the CFR cite, the severity weight, the OOS-listed flag, and
the BASIC assignment — all against the current FMCSA SMS methodology
(severity tables) and the CVSA OOS criteria where flagged. The "what to say"
script on every row additionally carries the ATTORNEY gate (they script
driver statements to law enforcement). Coaching claims embedded in fix[]
strings that assert regulation (noted below) verify with the row.

**S-7 source stamp (this section):** SMS Methodology **v3.21** + Appendix A
**v3.21** (snapshot implemented **05/15/2026**), read from
`sms_appendixa_violationslist_3.xlsx`. See the filled comparison in
`dot-tools-verification/violations-sms-verification-table.md` and the
corrections record in `dot-tools-verification/corrected-legacy-claims.md`.

**Status discipline (owner rule, this reconciliation):** a source match does
**not** promote a row to VERIFIED. The ledger has no separate source-verified
field, so source-matched rows keep **UNVERIFIED** with the note
"SOURCE MATCHED — INDEP. REVIEW PENDING"; only the independent reviewer's
countersignature promotes them. The six rows the official source directly
contradicts are marked **SUPERSEDED** now.

Legend for the Appendix A column: `code · group · sev · DSMS`. "no OOS wt" =
Unsafe Driving receives no SMS OOS +2 adjustment.

| ID | Key | Legacy cite→sev | Appendix A v3.21 match | Status |
|---|---|---|---|---|
| R-VIO-01 | hos11 | 395.3(a)(3)(i)→7 | `395.3A3I-HOSPDIT` · Hours · 7 · Y (>11 hr) | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (sev 7 confirmed; refine to SMS code) |
| R-VIO-02 | hos14 | 395.3(a)(2)→7 | `395.3A2-HOSPD`/`-PROP`/`A2R` · Hours · 7 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (nominal-at-inspection variants weigh 1) |
| R-VIO-03 | hos30 | 395.3(a)(3)(ii)→7 | `395.3(a)(3)(ii)` EXACT · Hours · 7 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-04 | nolog | 395.8(a)→5 | bare `395.8(a)` = Form&Manner · **sev 1**; no-RODS = `395.8A-NON-ELD`/`-ELD` · sev 5 · Y | **SUPERSEDED/BLOCKED** — sev 5 not valid for the bare cite; needs narrowed product choices (form&manner vs no-RODS ELD/non-ELD) |
| R-VIO-05 | falselog | 395.8(e)→7 | `395.8(e)` EXACT · False Log · 7 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-06 | lognotcurrent | 395.8(f)(1)→5 | `395.8(f)(1)` EXACT · Incomplete/Wrong Log · 5 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-07 | phone | 392.82→10 | `392.82(a)(1)` · Phone Call · 10 · Y · no OOS wt | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (code→392.82(a)(1)) |
| R-VIO-08 | texting | 392.80→10 | `392.80(a)` · Texting · 10 · Y · no OOS wt | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (code→392.80(a)) |
| R-VIO-09 | belt | 392.16→7 | `392.16` EXACT · Seat Belt · 7 · Y · no OOS wt | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-10 | speed1 | 392.2-SLLS2→4 | `392.2-SLLS2` EXACT · Speeding 2 · 4 · Y · no OOS wt | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-11 | speed2 | 392.2-SLLS3→7 | `392.2-SLLS3` EXACT · Speeding 3 · 7 · Y · no OOS wt | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-12 | speed3 | 392.2-SLLS4→10 | `392.2-SLLS4` EXACT · Speeding 4 · 10 · Y · no OOS wt | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-13 | lamp | 393.9→**6** | `393.9` EXACT "Inoperable Required Lamp" · 2 · Y | **SUPERSEDED — severity 6→2** |
| R-VIO-14 | tireflat | 393.75(a)→8 | `393.75(a)` EXACT · Tires · 8 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (OOS/"automatic OOS" wording still CVSA-gated) |
| R-VIO-15 | tiretread | 393.75(b)/(c)→8 | `393.75(b)` (front <4/32) + `393.75(c)` (other <2/32) · Tires · 8 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-16 | brakeadj | 393.47(e)→4 | `393.47(e)` EXACT · Brakes Out of Adjustment · 4 · **DSMS N** | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING · **DSMS=N — not a Driver SMS point contributor** |
| R-VIO-17 | brakehose | 393.45→4 | bare `393.45` DSMS **N**; chafe/leak `393.45(b)(2)` · 4 · Y | **SUPERSEDED/BLOCKED** — bare cite is DSMS N; needs narrowed choice (scoring code 393.45(b)(2)) |
| R-VIO-18 | mudflap | 393.87→1 | `393.87` = **Warning Flags (projecting load)** — WRONG; mud flap = `392.2-SLLMF` · Windshield/Glass/Markings · 1 · Y | **SUPERSEDED — cite corrected to 392.2-SLLMF** (sev 1) |
| R-VIO-19 | emerequip | 393.95→2 | `393.95(a)` family · Emergency Equipment · 2 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (code→specific sub) |
| R-VIO-20 | securement | 393.100→**7** | bare `393.100` = **sev 1** (General Securement); `393.100(b)` (leaking/blowing/falling) = 7 · Y | **SUPERSEDED/BLOCKED** — split into separate choices; general=1, 393.100(b)=7 |
| R-VIO-21 | nomedcard | 391.41(a)→1 | `391.41(a)` EXACT · Medical Certificate · 1 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |
| R-VIO-22 | expmedcard | 391.41(a)→**7** | `391.41(a)` = **sev 1**; 391.41 family all low severity | **SUPERSEDED — sev 7 unsupported**; distinguish possession/expiration (Medical Certificate, low) from operating-while-medically-**unqualified** (different section, not in the 391.41 family) |
| R-VIO-23 | nocdl | 383.23(a)(2)→8 | `383.23(a)(2)` EXACT · License-related: High · 8 · Y | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING |

**§C reconciliation tally:** 17 source-matched (UNVERIFIED · review pending) ·
6 SUPERSEDED (R-VIO-04, 13, 17, 18, 20, 22). ATTORNEY gate on the "what to
say" scripts and CVSA gate on OOS-wording claims are unchanged and still
apply to these rows regardless of the S-7 match.

## D. CSA / SMS Estimate Mechanics (8 rows)

| ID | Tool / path | Current app behavior | Primary source | Minimum operative language needed | TLWS interpretation to verify | Status | Gate |
|---|---|---|---|---|---|---|---|
| R-SMS-01 | Checker · math | +2 severity when placed OOS (applied universally) | SMS Methodology v3.21 | OOS weight only where the BASIC authorizes; **Unsafe Driving never**; not universal | **SUPERSEDED** — universal +2 removed; future logic must be BASIC-aware | REG |
| R-SMS-02 | Checker · math | Time weights ×3 (<6 mo), ×2 (6–12 mo), ×1 (1–2 yr) | SMS Methodology v3.21 | 0–6 mo = 3 · over 6–12 = 2 · over 12–24 = 1 · **older than 24 = excluded** | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (relabel boundaries + add >24 exclusion) | REG |
| R-SMS-03 | Checker · text | Violations affect carrier scores 24 months | SMS Methodology v3.21 | 24-month SMS event window | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING | REG |
| R-SMS-04 | Checker · text | PSP shows 3 yrs violations / 5 yrs crashes | PSP program (psp.fmcsa.dot.gov) | PSP retention windows | UNVERIFIED (S-8, not covered by S-7) | REG |
| R-SMS-05 | Checker · text | "Citation vs warning doesn't change CSA — any noted violation counts" | SMS Methodology | Inspection-based scoring independent of citation outcome | UNVERIFIED (not addressed in S-7 evidence) | REG |
| R-SMS-06 | Checker · mapping | 4 BASIC assignments (HOS Compliance, Unsafe Driving, Vehicle Maint., Driver Fitness) | SMS Methodology App. A v3.21 | Violation→BASIC mapping for all 23 rows | UNVERIFIED · SOURCE MATCHED for all 23 — INDEP. REVIEW PENDING (BASIC/group confirmed per §C) | REG |
| R-SMS-07 | Checker · banding | Points ≥21 "Heavy" / ≥10 "Moderate" impact bands | none — **TLWS invention** | n/a | **SUPERSEDED — REMOVE** (owner order; no methodology basis) | REG |
| R-SMS-08 | Checker · framing | Output presented as "CSA math (approx.)" | SMS Methodology v3.21 + verdict rules | Approved output string (below) | UNVERIFIED · SOURCE MATCHED — INDEP. REVIEW PENDING (spec fixed) | REG |

**R-SMS-08 approved output string:** "Estimated SMS weighted value based on
public methodology." **Banned output labels (never render):** CSA score ·
PSP score · official FMCSA score · carrier percentile · points against your
CDL · guaranteed company impact.

**DSMS vs carrier-SMS (record):** the Appendix A "DSMS (Y/N)" flag marks
whether a violation is used in the **Driver** SMS. It is not the same as
carrier SMS treatment, and it is not the SMS OOS +2 adjustment. Rows flagged
DSMS = N (`brakeadj` 393.47(e); bare `brakehose` 393.45) must **not** be
described as automatically creating driver points. "OOS likely" (a
placed-out-of-service outcome) is **not** evidence that the SMS OOS +2
severity adjustment applies.

## E. Pre-Trip Failure Check (14 rows)

Defect rows verify the cite + the move/OOS framing; threshold rows isolate
every numeric claim. CVSA OOS criteria are a controlled publication — see
Unresolved Sources.

| ID | Item | Current claim | Primary source | Status | Gate |
|---|---|---|---|---|---|
| R-PT-01 | ABS lamp | Lamp alone = violation not OOS; cite 393.55 | 49 CFR 393.55 + CVSA | UNVERIFIED | REG+CVSA |
| R-PT-02 | Tire | OOS conditions list; cite 393.75 | 393.75 + CVSA | UNVERIFIED | REG+CVSA |
| R-PT-03 | Air leak | Audible leak/spec loss = OOS territory; cite 393.45/396.7 | 393.45, 396.7 + CVSA | UNVERIFIED | REG+CVSA |
| R-PT-04 | Light out | Every required lamp must work; cite 393.9 | 393.9 | UNVERIFIED | REG |
| R-PT-05 | Brake issue | Park-it framing; cite 393.40–48/396.7 | 393.40–48, 396.7 + CVSA | UNVERIFIED | REG+CVSA |
| R-PT-06 | Mud flap | Severity ~1, state laws vary; cite 393.87 (+ see R-VIO-18 cite doubt) | state codes + SMS | UNVERIFIED | REG |
| R-PT-07 | Windshield | Wiper-swept-zone crack rules; cite 393.60 | 393.60 | UNVERIFIED | REG |
| R-PT-08 | Oil/coolant leak | Drip-rate framing; "fuel leak of ANY kind = automatic OOS"; cite 396.7/393.83 | 396.7, 393.83 + CVSA | UNVERIFIED | REG+CVSA |
| R-PT-09 | Threshold | Air loss > ~3 psi/min (single, applied) = OOS | CVSA OOS criteria | UNVERIFIED | CVSA |
| R-PT-10 | Threshold | Governor cut-in below 85 psi = park it | CVSA OOS criteria / 393.50-series | UNVERIFIED | REG+CVSA |
| R-PT-11 | Threshold | 20% of brakes defective = vehicle OOS | CVSA OOS criteria | UNVERIFIED | CVSA |
| R-PT-12 | Threshold | Tread 4/32 steer, 2/32 drive/trailer | 49 CFR 393.75(b)/(c) | UNVERIFIED | REG |
| R-PT-13 | Threshold | No crack >1/4", no intersecting cracks, in wiper-swept driver's view | 49 CFR 393.60(c) | UNVERIFIED | REG |
| R-PT-14 | Threshold | Any fuel leak = automatic OOS + fire risk | CVSA OOS criteria / 393.83 | UNVERIFIED | REG+CVSA |

## F. Regulation Index (5 rows)

| ID | Item | Current claim | Primary source | Status | Gate |
|---|---|---|---|---|---|
| R-IDX-01 | Part list | 39 parts = complete 49 CFR Subchapter B (350–399) | eCFR Subchapter B TOC | UNVERIFIED | REG |
| R-IDX-02 | Section titles | 147 curated section shortcuts titled accurately | eCFR per-section | UNVERIFIED (row per section at verification time) | REG |
| R-IDX-03 | Reserved parts | 355, 388, 394 shown as reserved | eCFR | UNVERIFIED | REG |
| R-IDX-04 | Synonym maps | 187 phrase→part routings send drivers to the right part | editorial (not regulatory) — spot-check against eCFR | UNVERIFIED | REG (spot-check) |
| R-IDX-05 | Live fetch | eCFR versioner API date resolution + full-text render; **current app shows "LIVE" LED before any fetch succeeds and silently falls back to today's date** | ecfr.gov API docs | UNVERIFIED — honest-status respec required (no silent stale data) | REG |

## G. Cheat Sheet Claims (6 rows)

| ID | Current claim | Primary source | Status | Gate |
|---|---|---|---|---|
| R-CS-01 | "The 12 things DOT checks" checklist framing | editorial + inspection levels (CVSA) | UNVERIFIED | REG |
| R-CS-02 | Document carry list (CDL, med card, registration, insurance, permits, hazmat papers) | 383/391/387/396-series | UNVERIFIED | REG |
| R-CS-03 | Tread depths repeated | → R-PT-12 | CROSS-REF | REG |
| R-CS-04 | "5 common OOS triggers" list | CVSA + SMS data | UNVERIFIED | REG+CVSA |
| R-CS-05 | "Refusing to sign = arrest in some states; signing ≠ admitting guilt" | state law — legal claim | UNVERIFIED | **ATTORNEY** |
| R-CS-06 | "Expired medical card = most common violation" | FMCSA violation statistics | UNVERIFIED | REG |

## H. Roadside Mode Claims (4 rows)

| ID | Current claim | Primary source | Status | Gate |
|---|---|---|---|---|
| R-RS-01 | "Top 5 regs DOT will cite": 395.8, 396.11, 392.2, 391.41, 393-series | inspection statistics | UNVERIFIED | REG |
| R-RS-02 | "Driver must prepare a written DVIR at the end of each driving day for every vehicle operated" | 49 CFR 396.11 as amended (2014 no-defect DVIR relief for property carriers) | **BLOCKED — likely inaccurate as stated**; post-2014, property carriers need not file no-defect DVIRs. Must be corrected, not ported | REG |
| R-RS-03 | Documents-ready list | mirrors R-CS-02 | CROSS-REF | REG |
| R-RS-04 | "What to say / what NOT to say" scripts | n/a — legal-adjacent coaching | UNVERIFIED | **ATTORNEY** |

## I. Fix-It Letters (4 rows)

| ID | Current claim | Primary source | Status | Gate |
|---|---|---|---|---|
| R-LT-01 | DataQ RDR process + filing at dataqs.fmcsa.dot.gov | FMCSA DataQs program | UNVERIFIED | REG+ATTORNEY |
| R-LT-02 | Template regulatory assertions ("24 months of CSA exposure", PSP accuracy claims) | SMS/PSP (→R-SMS-03/04) | CROSS-REF | ATTORNEY |
| R-LT-03 | Shop-letter framing (pre-trip visibility question, root-cause note) | editorial | UNVERIFIED | ATTORNEY |
| R-LT-04 | All 5 templates as user-signed documents | n/a | **BLOCKED from launch** until attorney review (Decision 6) | **ATTORNEY** |

## J. Canada (1 row)

| ID | Current behavior | Decision | Status |
|---|---|---|---|
| R-CA-01 | Hardcoded paraphrase of SOR/2005-313 (13/14/16/10/8-consec, cycles 70/7 + 120/14, deferral, north-of-60) + 26 section refs + 51 synonyms | **Decision 1: US-only MVP.** No TLWS Canadian interpretation, search result, calculator output, or conclusion ships. Canada appears only as a clearly labeled link to official Government of Canada sources. A future Canadian launch requires its own ledger + qualified Canadian review | **BLOCKED** (out of MVP scope) |

---

## Ledger totals

| Section | Rows |
|---|---|
| A. HOS | 12 |
| B. PC / Yard Move | 12 |
| C. Violation DB | 23 |
| D. CSA/SMS mechanics | 8 |
| E. Pre-trip | 14 |
| F. Regulation index | 5 |
| G. Cheat sheet | 6 |
| H. Roadside | 4 |
| I. Letters | 4 |
| J. Canada | 1 |
| **Total** | **89** |

**Status counts (after S-7 Appendix A v3.21 reconciliation):**
VERIFIED **0** · UNVERIFIED **64** · CROSS-REF **10** · BLOCKED **7** ·
SUPERSEDED **8** = 89.

- **VERIFIED 0** — unchanged. A source match does not promote a row; only the
  independent reviewer's countersignature does (owner status rule).
- **SOURCE MATCHED — INDEP. REVIEW PENDING: 21 rows** (a subset of UNVERIFIED,
  not a separate status): §C R-VIO-01/02/03/05/06/07/08/09/10/11/12/14/15/16/19/21/23
  (17) + §D R-SMS-02/03/06/08 (4).
- **SUPERSEDED 8** — §C R-VIO-04, 13, 17, 18, 20, 22 (legacy value contradicted
  by Appendix A v3.21) + §D R-SMS-01 (universal OOS +2) and R-SMS-07 (invented
  bands, REMOVE). Of the §C six, R-VIO-04/17/20 are additionally
  **BLOCKED pending narrowed product choices** (counted here under SUPERSEDED).
- **BLOCKED 7** — R-HOS-09, R-HOS-10, R-HOS-11, R-IDX-05, R-RS-02, R-LT-04,
  R-CA-01 (R-SMS-07 moved BLOCKED→SUPERSEDED).
- **CROSS-REF 10** — R-HOS-01…07 (→ `hos-verification.md`) + R-CS-03 + R-RS-03
  + R-LT-02.

Correction note: the pre-reconciliation tally read "UNVERIFIED 72 · CROSS-REF 9
· BLOCKED 8." An accurate recount of that prior state is UNVERIFIED 71 ·
CROSS-REF 10 · BLOCKED 8 (CROSS-REF was undercounted by one — R-HOS-01…07 is
7 rows, plus 3 internal = 10). Corrected here.

## Unresolved source requirements

1. **CVSA Out-of-Service Criteria** — RESOLVED (owner Decision 11,
   July 22, 2026): **reference-only**. CVSA-gated rows verify to softened
   non-numeric language; CFR-anchored numbers unaffected. Memo:
   `dot-tools-verification/cvsa-licensing-memo.md` (includes the upgrade
   path if access/permission is later obtained).
2. **FMCSA SMS Methodology current appendix** — public but versioned; the
   click-through must stamp the version/date used.
3. **FMCSA PC guidance (2018-05-31)** and yard-move guidance — locate the
   current authoritative guidance documents on fmcsa.dot.gov.
4. **eCFR** is proxy-blocked from the development sandbox — all eCFR
   click-throughs are owner/human actions, same as the Split Calculator
   process.

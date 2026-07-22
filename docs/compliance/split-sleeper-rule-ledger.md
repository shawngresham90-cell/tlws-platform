# Split Sleeper Berth — Rule Ledger (PR 1)

The versioned regulatory foundation for the TLWS Split Sleeper Calculator
(`/split-sleeper-calculator`, owner-approved route). **The engine (PR 2)
implements THIS ledger, never the blueprint or any search snippet.** A rule
marked BLOCKED must not be implemented until its verification rows are
complete.

Gate status: **OPEN.** PR 2 cannot be authorized until (a) every human
click-through row below is filled, and (b) the independent expert reviewer
(**OWNER TO ASSIGN** — see `split-sleeper-review-checklists.md`) signs this
ledger.

Scope lock: property-carrying drivers only · planning and education only ·
not an ELD · not a legal determination · never a substitute for the
driver's official logs or judgment. The calculator is independent of the
Trip Planner, whose deliberately conservative split handling
(`src/lib/trip-planner/hos-exceptions.ts`, `supported: false`) is
unchanged by this work.

## 1. Source classes and status vocabulary

- **REGULATION** — operative text of 49 CFR Part 395 (eCFR).
- **FMCSA-GUIDANCE** — FMCSA summary pages, FAQ set, fact sheets.
- **PILOT-MATERIAL** — Federal Register pilot-program documents.
- **INTERPRETATION** — anything requiring expert confirmation to state
  operatively.

Verification statuses:

- **SEARCH-CONFIRMED** — the rule's substance was confirmed against
  official-source content returned by July 2026 searches of
  fmcsa.dot.gov / ecfr.gov / federalregister.gov. **This does not settle
  the rule.** The environment used to author this ledger cannot fetch
  eCFR/FMCSA pages directly (egress proxy 403), so search-level
  confirmation is the ceiling until the human rows are done.
- **BLOCKED** — substance not directly confirmable from official text in
  hand; requires the human click-through and/or expert confirmation
  before the engine may implement it.

## 2. Official-source reference table

| # | Source | URL | Used for | Human click-through |
|---|---|---|---|---|
| S1 | eCFR 49 CFR 395.1 (incl. (g) sleeper berth) | <https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.1> | R5, R6, R7, R11, R12, R14 | ☐ pending |
| S2 | eCFR 49 CFR 395.3 (property-carrying limits) | <https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.3> | R1–R4, R8, R10 | ☐ pending (row also required by `hos-verification.md`) |
| S3 | eCFR 49 CFR 395.2 (definitions: sleeper berth, on-duty) | <https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.2> | status classification in D7/D8 | ☐ pending |
| S4 | FMCSA — "What rest periods qualify for the split sleeper berth provision?" | <https://www.fmcsa.dot.gov/regulations/hours-service/what-rest-periods-qualify-split-sleeper-berth-provision> | R5, R7 | ☐ pending |
| S5 | FMCSA — "How are split sleeper berth rest periods used in determining compliance with the 14-hour driving window?" | <https://www.fmcsa.dot.gov/regulations/hours-service/how-are-split-sleeper-berth-rest-periods-used-determining-compliance-14> | R5, R6, R15 | ☐ pending |
| S6 | FMCSA HOS 2020 FAQ set (incl. Nov 2020 FAQ PDF, Dec 2020 Q&A webinar) | <https://www.fmcsa.dot.gov/tags/hos-2020-395-faqs> · <https://csa.fmcsa.dot.gov/Documents/HOS_Frequently_Asked_Questions_11-19-2020.pdf> | R6, R9, R15 | ☐ pending |
| S7 | FMCSA HOS summary page | <https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations> | R1–R4, R10 | ☐ pending |
| S8 | Federal Register 2025-17939 (Sept 17, 2025) — "Pilot Program To Allow Commercial Drivers To Split Sleeper Berth Time" | <https://www.federalregister.gov/documents/2025/09/17/2025-17939/hours-of-service-of-drivers-pilot-program-to-allow-commercial-drivers-to-split-sleeper-berth-time> | R13 | ☐ pending |
| S9 | FMCSA sleeper-berth topic index (post-2020 actions watch) | <https://www.fmcsa.dot.gov/taxonomy/term/8701> | re-verification watch | ☐ pending |

Each human row, when completed, records: date · verifier · the page's
"current as of"/publication date · the exact operative sentence(s) copied
into §3 · any surprises.

## 3. The rule ledger (R1–R15)

Quoting rule: minimum operative language only; anything not yet directly
quoted from the official page is paraphrase and is marked as such.

| # | Rule (operative form) | Citation | Class | Status |
|---|---|---|---|---|
| R1 | 11-hour driving limit after 10 consecutive hours off duty | 395.3(a)(3)(i) | REGULATION | SEARCH-CONFIRMED (figures match the already-implemented `HOS` constants; human row S2/S7 pending) |
| R2 | No driving beyond the 14th consecutive hour after coming on duty; wall-clock | 395.3(a)(2) | REGULATION | SEARCH-CONFIRMED (S2/S7 pending) |
| R3 | 30-minute driving interruption after 8 cumulative driving hours; any ≥30-min non-driving status qualifies (2020 rule) | 395.3(a)(3)(ii) | REGULATION | SEARCH-CONFIRMED (S2/S7 pending) |
| R4 | 60 hr/7 day or 70 hr/8 day on-duty cycles; 34-hour restart | 395.3(b), (c) | REGULATION | SEARCH-CONFIRMED (S2 pending) |
| R5 | Split: 10 required off-duty hours may be split into one period of **at least 7 consecutive hours in the sleeper berth** and a second of **at least 2 consecutive hours** off duty, sleeper, or combination, **totaling at least 10 hours**; **properly paired qualifying periods are excluded from the 14-hour window** | 395.1(g)(1) | REGULATION + FMCSA-GUIDANCE (S4, S5) | SEARCH-CONFIRMED — S4 content: split "into one consecutive period of at least 7 hours in the sleeper berth and a second period of at least 2 consecutive hours ... provided the two periods total at least 10 hours"; S5 content: compliant pairings "do not count against the driver's 14-hour driving window." Human quote extraction pending (S1, S4, S5) |
| R6 | On qualification, the 11-hour and 14-hour calculations restart from the **end of the first of the two qualifying periods** | 395.1(g)(1) + FMCSA guidance | INTERPRETATION (guidance-supported) | **BLOCKED** — consistent with FMCSA FAQ material surfaced in search, but the exact operative statement was not directly obtained. Requires S1/S5/S6 human rows AND expert confirmation before implementation |
| R7 | Order flexible: long-first (7/3, 8/2) or short-first (3/7, 2/8), and any compliant custom pair between 7/3 and 8/2 (e.g., 7.5/2.5), provided R5's three tests pass | 395.1(g)(1) | REGULATION + FMCSA-GUIDANCE | SEARCH-CONFIRMED — S4 content: "any split ... including and between a 7/3 split and an 8/2 split." Human rows pending |
| R8 | The split creates **no additional 60/70-cycle availability**; cycle math is untouched by pairing | 395.3(b) (absence of split provision) + FMCSA fact sheets | INTERPRETATION (conservative) | SEARCH-CONFIRMED at substance level; note: implementing "no cycle relief" is also the CONSERVATIVE direction — an error here cannot overstate a driver's hours. Expert confirms wording |
| R9 | Rolling splits: the second period of a completed pair may serve as the first period of the next pair | FMCSA FAQ/guidance | INTERPRETATION (guidance-supported) | **BLOCKED** — not directly quoted yet. Requires S6 human row + expert confirmation |
| R10 | A qualifying rest period ≥30 min also satisfies the 30-minute break requirement (any completed qualifying period, being ≥2 h, always resets the break counter) | 395.3(a)(3)(ii) | REGULATION | SEARCH-CONFIRMED (S2/S7 pending) |
| R11 | The long period must be **entirely sleeper berth**; 7+ hours off duty outside the sleeper does not satisfy it | 395.1(g)(1) | REGULATION | SEARCH-CONFIRMED via S4's "at least 7 hours **in the sleeper berth**" phrasing; exact sub-paragraph cite confirmed at S1 human row |
| R12 | Passenger-carrying sleeper rules differ and are OUT OF SCOPE; the tool refuses passenger calculations | 395.1(g) passenger paragraphs / 395.5 | REGULATION (scope refusal) | No verification burden — the tool never computes these; refusal copy only |
| R13 | 6/4 and 5/5 splits are **not generally authorized**; an FMCSA pilot (proposed Sept 17 2025, ~256 enrolled CDL drivers, protocol development from early 2026, ~3-year run; companion split-duty/14-hour-pause pilot alongside) exists but does not authorize ordinary drivers. The tool refuses 6/4 and 5/5 with an honest pilot-status explanation | Federal Register 2025-17939 (S8) | PILOT-MATERIAL | SEARCH-CONFIRMED — refusal stance is safe in both directions (refusing an authorized pattern inconveniences; allowing an unauthorized one harms). S8 human row records the pilot's then-current status at verification time |
| R14 | Adverse driving (395.1(b)), short-haul (395.1(e)), agricultural (395.1(k)), oilfield (395.1(d)), emergency (390.23) exceptions exist and are **never automated** by this tool — named in the disclaimer set | as cited | REGULATION (scope refusal) | No math to verify; disclaimers name them |
| R15 | **Fewest-violations pairing:** when more than one pairing of rest periods is possible, the pairing used is the one producing no violations or the fewest violations | FMCSA guidance (S5/S6) | FMCSA-GUIDANCE | SEARCH-CONFIRMED at substance level ("the pairing that should be used is the pairing that results in no violations or the fewest violations"); **tie-breaking and enumeration order are INTERPRETATION — expert must confirm** before PR 2 encodes them |

## 4. Verification log

| Date | Method | Result | Verifier |
|---|---|---|---|
| 2026-07-22 | Web search of fmcsa.dot.gov / ecfr.gov / federalregister.gov (direct page fetches blocked by build-environment egress proxy, HTTP 403) | R5/R7/R11 core split substance confirmed from FMCSA page content; R13 pilot status confirmed from FR 2025-17939; R15 substance surfaced from FMCSA guidance; R1–R4/R10 match the constants already recorded in `hos-verification.md`. R6 and R9 NOT directly confirmed → BLOCKED | Claude (build agent) |
| ☐ pending | **Human click-through of S1–S9** — copy the operative sentences into §3, record page dates | | Shawn or designated reviewer |
| ☐ pending | **Independent expert review** of this ledger + the PR 2 fixture inventory | | **OWNER TO ASSIGN** |

## 5. Re-verification triggers (standing)

Any Federal Register action touching 395.1(g)/395.3 (including every
status change of the S8 pilot — if it ever authorizes patterns broadly,
R13 re-enters at this ledger, never directly in code) · any FMCSA guidance
update · quarterly calendar check regardless. The newest completed
verification date displays in the tool's "Review official rule" panel.
Post-launch, ANY change touching calculator math re-enters at this ledger
— permanently.

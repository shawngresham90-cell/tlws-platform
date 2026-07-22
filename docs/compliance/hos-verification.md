# HOS Constants — eCFR Verification Record

Standing rule (Trip Planner Blueprint, regulatory hard gate): **no HOS
number ships on this platform unverified against the live eCFR, and every
constant is re-verified on a schedule after launch.** This file is the
verification record. An implementation PR that touches HOS behavior must
link the current version of this file and carry a fresh verification row.

## 1. The constants under verification

Single source of truth in code: `HOS` in `src/lib/trip-planner/types.ts`
(consumed only by `src/lib/trip-planner/hos-engine.ts`, a pure, stateless,
planning-only module — explicitly not an ELD).

| Constant | Value | Rule | Citation |
|---|---|---|---|
| `MAX_DRIVING_MIN` | 660 (11 h) | Max driving after 10 consecutive hours off duty | 49 CFR 395.3(a)(3)(i) |
| `MAX_WINDOW_MIN` | 840 (14 h) | No driving beyond the 14th consecutive hour after coming on duty; wall-clock, not paused by breaks | 49 CFR 395.3(a)(2) |
| `BREAK_AFTER_DRIVING_MIN` | 480 (8 h) | 30-minute interruption required after 8 *cumulative* hours of driving | 49 CFR 395.3(a)(3)(ii) |
| `MIN_BREAK_MIN` | 30 | The qualifying interruption: any ≥30-min non-driving period (off-duty, sleeper, or on-duty-not-driving — 2020 rule) | 49 CFR 395.3(a)(3)(ii) |
| `MIN_RESET_MIN` | 600 (10 h) | Off-duty period that resets the 11/14 clocks | 49 CFR 395.3(a)(1) |
| `RESTART_MIN` | 2,040 (34 h) | Restart of the 60/70-hour cycle | 49 CFR 395.3(c) |
| `CYCLE_60_MIN` / `CYCLE_70_MIN` | 3,600 / 4,200 | 60 h in 7 days / 70 h in 8 days on-duty limits | 49 CFR 395.3(b) |

Exceptions the engine deliberately does NOT apply (each surfaced as typed
data with a conservative assumption, `src/lib/trip-planner/hos-exceptions.ts`):
split sleeper berth (395.1(g)(1)) — treated as ordinary off-duty, stricter
than the rule; adverse driving +2 h (395.1(b)(1)) — never granted;
short-haul (395.1(e)(1)) — everyone planned under full rules. Conservative
non-support is the safe direction and requires no verification cadence.

## 2. Verification log

| Date | Method | Result | Verifier |
|---|---|---|---|
| 2026-07-22 | Web search against ecfr.gov / fmcsa.dot.gov (direct eCFR page unreachable from the build sandbox — HTTP 403 via egress proxy) | FMCSA summary and eCFR search results current as of July 2026 confirm 11-h driving / 14-h window / 30-min break after 8 cumulative driving hours (interruption satisfiable by any ≥30-min non-driving status) — **all match the constants above.** Search-level confirmation only; see the pending human step. | Claude (build agent) |
| ☐ pending | **Human click-through of the live eCFR page** — required before any HOS-touching implementation PR merges: <https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.3> — confirm the four figures in §1 and note the page's "current as of" date here | | Shawn or designated reviewer |

The search-level row does not satisfy the hard gate by itself. The gate
is satisfied only when the human row is filled in with a date.

## 3. Re-verification schedule (post-launch)

- **Quarterly** click-through of 49 CFR 395.3 + 395.1(b)(1)/(e)/(g),
  logged as a new row above.
- **Immediately** upon any FMCSA HOS rulemaking news. Blueprint kill rule:
  a rule change with the tool un-updated ⇒ pull the HOS layer within 24 h
  until re-verified.
- The verified-as-of date from the newest completed row is displayed
  in-product ("HOS rules verified against eCFR [date]") once the results
  UI ships — the compliance chore rendered as a trust signal.

## 4. Structural safeguards already in code (verified this audit)

- Engine is stateless and planning-only; callers supply all timestamps and
  driver-stated clocks; nothing resembling a record of duty status is
  stored (`saved_trips` snapshots hold plan inputs the user chose to save,
  not duty history).
- No legal verdicts: outputs are remaining-minute projections + violation
  *warnings* with citations, plus `HOS_DISCLAIMER` ("this tool is NOT an
  ELD...") delivered with every quote.
- Exceptions never auto-applied (typed `supported: false` assessments).

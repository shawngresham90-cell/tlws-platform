# Split Sleeper Calculator — Calculation Specification (PR 1)

Implementation spec for the PR 2 pure engine. Every rule reference below
is a ledger line in `split-sleeper-rule-ledger.md`; **BLOCKED ledger lines
(R6, R9, and R15's tie-breaking) must not be implemented until their
verification completes.** No code ships from this document.

Owner decisions of record (July 2026): route `/split-sleeper-calculator` ·
positioning "TLWS Split Sleeper Calculator — *See what time your split
gives back — and when.*" · **planning language, never legal verdicts** ·
independent from the Trip Planner.

## 1. Input contract (blueprint D7)

Required: current timestamp · driver type fixed = property-carrying ·
cycle rule (60/70) · cycle hours remaining · EITHER the four "remaining"
values + driving-since-break (Quick) OR a validated, gap-classified duty
event list (Timeline). Pairing evaluation needs both period candidates
(or one completed + one proposed-starting-now). Times to the minute;
durations ≥ 0; "combination" periods decompose per-minute into off/sleeper;
future time is never treated as completed. **Prime directive: any absent
or contradictory required field → the insufficient-data refusal. The
engine never defaults, never guesses, and fails CLOSED on non-finite
input (same guard pattern as `lib/trip-planner/last-stop.ts`).**

## 2. Qualification tests (D8; ledger R5, R7, R11, R13)

A proposed pair (P1 earlier, P2 later) qualifies iff ALL:

1. **Long test** — exactly one period is ≥ 7:00 consecutive hours with
   every minute sleeper-berth (R11: any off-duty minute inside disqualifies
   it as the long half).
2. **Short test** — the other is ≥ 2:00 consecutive hours, every minute
   off duty or sleeper (contiguous combination allowed).
3. **Total test** — durations sum ≥ 10:00.
4. **Consecutiveness** — each period is one unbroken block; any
   interrupting driving/on-duty minute fragments it.
5. **Order-agnostic** — 7/3, 8/2, 3/7, 2/8, and compliant custom pairs
   between 7/3 and 8/2 (e.g., 7.5/2.5) all qualify; sequence affects only
   the anchor (§3), never qualification.
6. **Rule-set test** — 6/4, 5/5, or any pattern failing tests 1–3 →
   refusal (R13 copy, §6). Passenger rules → refusal (R12).

Rolling splits (R9 — **BLOCKED**): designed as P2-carries-forward state in
Timeline mode; implementation waits on the ledger row.

Pairing selection (R15): when multiple pairings are possible, evaluate all
legal pairings and select the one yielding no/fewest violations; the trace
names the pairing chosen and why. **Tie-break order: expert to confirm
before PR 2 encodes it.**

## 3. Recalculation model (D9–D13; ledger R5, R6, R8, R10)

- **Anchor** (R6 — **BLOCKED** until verified): end of P1.
- **Driving clock**: 11:00 − driving minutes since anchor (driving always
  counts; never restored by partial/unqualified rest).
- **14-hour window**: 14:00 − (elapsed clock time since anchor − minutes
  inside qualifying periods). Non-qualifying breaks (the 1-hour lunch)
  consume the window — stated explicitly in output, since it is the #1
  driver misconception.
- **Cycle**: untouched by pairing (R8); its own on-duty+driving ledger.
  34-hour restart detection is Phase 2; MVP takes cycle-remaining as
  driver-entered truth.
- **Break clock**: cumulative driving since last ≥30-min non-driving
  interruption (any status, 2020 rule); any completed qualifying period
  (≥2:00) always resets it (R10) — stated plainly.
- **Pending pair** (first period done, second not): no recalculation;
  report current clocks, the completed period's candidate status, the
  completion requirement, and earliest completion time.

## 4. ACTUAL USABLE TIME (D14 + owner's flagship-surface decision)

`actual_usable = min(driving_remaining, window_remaining, cycle_remaining)`
evaluated after any recalculation, with the binding clock **always named**
(both named on ties). Existing engine precedent: this is the same shape as
`remainingClocks().legalDrivingMin` + `limitedBy` in the trip-planner HOS
engine — reused conceptually, implemented fresh in the calculator engine
against this ledger.

**Approved wording format (owner, July 2026 — planning language, never a
legal verdict):**

> "Your clocks show **1 hour 45 minutes** of usable driving time. Your
> **70-hour cycle** is the limiting clock."

Banned phrasing: "You may legally drive…", "you are legal/illegal",
"compliant", "guaranteed". The three non-binding clocks remain visible so
the driver sees the shape of the day. A usable figure is never displayed
without its limiter named.

## 5. Explanation trace (D16)

Nine steps, rendered as plain-language numbered items, generated from the
actual computation path: inputs restated → pair evaluated → qualification
tests pass/fail in order with ledger line cited → anchor → the math →
the four clocks + the ACTUAL USABLE TIME line → still owed → break status
→ citation footer (ledger sections + verification date + planning-only
disclaimer). Failures produce the same trace up to the failing test, then
the exact §6 message. The trace ships inside the share artifact. Template
wording below is DRAFT until the ledger's human rows + attorney pass:

> "You completed 3 hours off duty from 1:00 PM to 4:00 PM and 7 hours in
> the sleeper berth from 9:00 PM to 4:00 AM. Together they total 10 hours
> and meet the split requirements: the long period was at least 7
> consecutive sleeper-berth hours, the short period was at least 2 hours,
> and the pair totals at least 10. Your driving and 14-hour calculations
> restart from 4:00 PM — the end of your first qualifying period. The 2
> hours you drove between 4:00 PM and 9:00 PM count against the new
> calculations. Your 70-hour cycle is unchanged by the split."

## 6. Qualification / failure / refusal copy (D17 — draft until wording pass)

| State | Copy (draft) | Type |
|---|---|---|
| Total < 10:00 | "These two periods total **9:45**. A qualifying split needs at least **10:00** combined. You're **0:15 short** — extend either period." | Fail |
| Long < 7:00 | "Your longer period is **6:30**. The long half of a split must be at least **7 consecutive hours in the sleeper berth**." | Fail |
| Long not all sleeper | "Your 7-hour period includes off-duty time. The long period must be **entirely sleeper berth** — 7+ hours off duty outside the sleeper does not qualify as the long half." | Fail |
| Short < 2:00 | "Your shorter period is **1:45**. The short half must be at least **2 consecutive hours** (off duty, sleeper, or a combination)." | Fail |
| Overlapping events | "Two duty periods overlap: [A] and [B]. Fix the times — a timeline can't be in two statuses at once." | Block |
| Missing driving history | "We can't compute your break clock without your driving since the last 30-minute interruption. Check your ELD and enter it." | Block |
| Missing window anchor | "We can't anchor your 14-hour window. Enter your window time remaining, or add the rest period that started your day." | Block |
| Cycle limiting | "⚠️ Your split restores driving and window time, but your **60/70 cycle** is the limiting clock: **1:45** usable. A split never adds cycle hours." | Warn |
| Proposed rest unfinished | "This result assumes you complete the full **7:00 sleeper period ending 4:00 AM**. Nothing recalculates if the period is cut short. Verify on your ELD when you wake." | Warn |
| 6/4 or 5/5 requested | "**6/4 and 5/5 splits are not authorized** for property-carrying drivers under the current rule. FMCSA is piloting them with a small enrolled test group — that pilot does not apply to ordinary drivers. This tool only calculates splits the regulation allows." | Refuse |
| Passenger rules implied | "This calculator covers **property-carrying** drivers only. Passenger-carrier sleeper rules are different and not supported here." | Refuse |
| Insufficient data | "**Not enough information to calculate this safely. Check your ELD and enter the missing duty periods.**" | Refuse |

Rules: every Fail names the exact shortfall and fix · Blocks stop
calculation · Warns accompany results · Refuses never partially answer ·
nothing ever guesses · driver voice, citations one tap deeper.

## 7. Standing safety frame (D23, restated as spec)

Persistent sub-banner + results footer: *"This calculator is for
trip-planning and education only. Your ELD and the applicable federal
regulations are the official sources. Verify the result before driving."*
No countdowns, no notifications, no "you can still make it" framing;
minimal-runway results get the neutral "That's not much runway." First-run:
"Don't use this while driving — park first."

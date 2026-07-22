# Verification Worksheet — HOS, Personal Conveyance, Yard Move, Adverse Conditions

Row-level questions the S-1 and S-10 click-throughs must answer. Answer in
writing under each question; the reviewer signs the section, then the
ledger row flips. Property-carrying US interstate scope throughout.

## A. Core HOS (rows R-HOS-01…08, R-HOS-12)

1. **11-hour** (R-HOS-01): does 395.3(a)(3)(i) state a maximum of 11 hours
   driving following 10 consecutive hours off duty? Exact wording noted.
2. **14-hour** (R-HOS-02): does 395.3(a)(2) prohibit driving beyond the
   14th hour after coming on duty, and confirm off-duty time does not
   extend it? Exact wording.
3. **30-minute break** (R-HOS-03): does 395.3(a)(3)(ii) require a break of
   at least 30 consecutive minutes after 8 **cumulative hours of driving**
   without at least a 30-minute interruption — and does any non-driving
   status (off, sleeper, on-duty-not-driving) satisfy it?
4. **10-hour reset** (R-HOS-04): confirm the 10-consecutive-hour basis.
5. **Cycles** (R-HOS-05/06): 60 hr/7 days vs 70 hr/8 days conditions
   (carrier operating-days basis).
6. **34-hour restart** (R-HOS-07): confirm 395.3(c) restart conditions as
   currently in force (no rider constraints beyond 34 consecutive hours?).
7. **Usable-time display** (R-HOS-08): given 1–6, confirm the correct
   formulation: available uninterrupted driving = min(11-remaining,
   14-remaining, cycle-remaining, [8 − driving-since-qualifying-break]).
   Reviewer signs the formula, which the shared engine already implements —
   the sign-off is on the DISPLAY spec, not new math.
8. **16-hour exception** (R-HOS-12): list 395.1(o)'s conditions. Decide:
   verify fully for a future path, or strip the mention from ported
   coaching text. (Default: strip at MVP; CAN'T CALL IT covers it.)

## B. Adverse conditions (rows R-HOS-09/10 — BLOCKED; Decision 10)

Answer all five before any unblock proposal goes to the reviewer:
1. Exact qualifying definition in 395.1(b)(1) — what must have been
   unknown, to whom (driver vs dispatcher), at what moment (dispatch time)?
2. Does the current rule extend **driving time** by up to 2 hours? Quote.
3. Does the current rule extend the **14-hour window**, and for which
   operations? Quote — this is the claim the legacy app auto-applied.
4. What may NOT trigger it (routine congestion, known weather)? Quote or
   guidance cite.
5. Draft the decision questions a driver must answer (who knew what, when)
   such that an unclear answer yields the conservative default (no
   extension, CAN'T CALL IT). Attach as the proposed spec.
Even after 1–5, the path ships only with reviewer approval and the engine's
conservative behavior preserved (extension modeled as an explicit,
justified exception — never a toggle).

## C. Personal conveyance (rows R-PC-01…09)

For each, quote the guidance language that supports or kills it:
1. PC is off-duty driving; carrier authorization context (R-PC-01).
2. Relief-from-duty precondition (R-PC-02).
3. Advancing-the-load / positioning-for-business disqualifier (R-PC-03/04).
4. Home↔terminal commuting: quote the example **and its limits** — the
   tool must not bless unlimited commuting (R-PC-05).
5. "Nearest reasonably safe location" after out-of-hours at a facility /
   ordered by an officer: quote both examples (R-PC-06/07).
6. Confirm no numeric distance/time threshold exists in guidance — the
   30-minute heuristic stays labeled TLWS editorial (R-PC-06).
7. Laden/unladen irrelevance (R-PC-08).
8. Misuse = false log under 395.8(e) (R-PC-09).

## D. Yard move (rows R-YM-01…03)

1. Identify the correct current authority for the ELD "yard move" special
   driving category (395.28? ELD technical spec? guidance?) — record it;
   the legacy cite is unconfirmed.
2. Property scope: what qualifies as a yard/private property; the
   public-road boundary.
3. Confirm yard-move time is on-duty (not driving) and therefore counts
   against the 14-hour window and cycle.

## Sign-off

| Section | Reviewer | Date | Outcome |
|---|---|---|---|
| A. Core HOS | | | |
| B. Adverse (unblock proposal only) | | | |
| C. Personal conveyance | | | |
| D. Yard move | | | |

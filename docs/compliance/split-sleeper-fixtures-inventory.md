# Split Sleeper Calculator — PR 2 Fixture Inventory (PR 1 deliverable)

The complete test inventory the PR 2 pure engine must pass before any UI
work is authorized. Every fixture asserts BOTH the numeric outputs AND the
trace steps. Harness: the repo's established offline pattern
(`scripts/test-*.ts`, esbuild-bundled, zero network — the Last Stop suite
is the model, including its fail-closed NaN tests). A mutation spot-check
is required: perturb one ledger constant → fixtures must fail (proving the
tests bind).

**Expert gate: the independent reviewer (OWNER TO ASSIGN) reviews these
fixtures against the ledger before PR 2 merges, and later authors 25+
independent scenarios for PR 6 that are NOT drawn from this list.**

## A. Qualification fixtures (spec §2)

1. 7/3 long-first — qualifies.
2. 8/2 long-first — qualifies.
3. 3/7 short-first — qualifies (anchor = end of the 3).
4. 2/8 short-first — qualifies.
5. Custom 7.5/2.5 — qualifies.
6. 9:45 total (7:00 + 2:45) — fails total test; message names 0:15 short.
7. Long 6:30 — fails long test.
8. Long period 7:10 containing one off-duty (non-sleeper) minute — fails
   R11; trace shows the disqualifying composition.
9. Short 1:45 — fails short test.
10. Short 2:00 exactly, as off/sleeper combination (contiguous) — qualifies.
11. Short period fragmented by 5 driving minutes — fails consecutiveness.
12. 6/4 requested — REFUSED with the pilot-status copy (R13).
13. 5/5 requested — REFUSED.
14. 10:00 exactly (7:00 + 3:00) boundary — qualifies.
15. 6:59 + 3:01 — fails long test despite 10:00 total.

## B. Recalculation fixtures (spec §3 — implement only after R6 unblocks)

16. The D16 worked example: 3 off (13:00–16:00), drive 2 (16:00–21:00 window),
    7 sleeper (21:00–04:00) — anchor 16:00; driving counted 2:00; window
    excludes both qualifying periods; cycle untouched.
17. Long-first variant of #16 — anchor at end of the sleeper period.
18. Midnight-straddling long period (22:30–05:30) — arithmetic correct
    across the date line.
19. DST spring-forward straddle — durations computed on real elapsed time,
    not wall-clock labels.
20. DST fall-back straddle.
21. Non-qualifying 1-hour lunch inside the span — consumes the window;
    trace's "what still counts" lists it.
22. Pending pair: 7:00 sleeper completed, second period not taken — no
    recalculation; reports candidate status + completion requirement +
    earliest completion time.
23. Pending pair where the PROPOSED second period is under-length —
    conditional result refuses to project qualification.
24. Rolling split (R9 — only after unblock): pair completes; P2 serves as
    P1 of the next pair; clocks correct across two consecutive pairs.

## C. Four-clock and ACTUAL USABLE TIME fixtures (spec §§3–4)

25. Cycle-limited: split restores 11/14 but cycle-remaining 1:45 →
    ACTUAL USABLE TIME = 1:45, limiter = cycle, warn state fires, approved
    wording exact-match asserted.
26. Window-limited post-split.
27. Driving-limited post-split.
28. Two clocks tied — both named in the limiting line.
29. Break-clock interaction: 7:55 driven since last interruption →
    "break needed after 0:05 more driving."
30. Completed qualifying period resets the break counter (R10) — output
    says "satisfied by the rest you just entered."
31. Zero remaining on any clock → usable 0:00, no negative display.
32. Cycle 60/7 vs 70/8 selection changes only the cycle ledger.

## D. Refusal / robustness fixtures (spec §§1, 6)

33. Missing driving-since-break → Block copy, no calculation.
34. Missing window anchor → Block copy.
35. Overlapping timeline events → Block copy naming both periods.
36. Insufficient-data catch-all — engine returns refusal, never a default.
37. Negative duration input → refusal.
38. Non-finite (NaN/Infinity) input anywhere → fail CLOSED (refusal),
    mirroring the Last Stop guard.
39. Future-dated "completed" period → treated as proposed, conditional
    result only.
40. Passenger-carrying flag (any pathway) → refusal.

## E. Pairing-selection fixtures (R15 — encode only after expert confirms tie-breaking)

41. Three candidate rest periods where two pairings are legal — engine
    picks the no-violation pairing; trace names the choice and the reason.
42. Two pairings both violation-free — tie-break per expert-confirmed
    order; trace states the rule applied.
43. Only pairing available produces a violation elsewhere in the timeline —
    reported honestly (fewest-violations ≠ zero-violations), with the
    violation surfaced.

## F. The ten driver questions (blueprint D4/J-series, as named fixtures)

44–53. Each of the blueprint's ten example driver questions becomes a
named fixture asserting the full trace text shape, including: "what does
the 7 tonight buy me" (J2), the comparison-shopper baseline (J4 —
full-10 vs 7/3 vs 8/2 minimal comparison), and the skeptic's citation
check (J6 — trace cites ledger lines + verification date).

## Coverage floor

100% branch coverage on the qualification and recalculation modules
specifically; every D17 state reachable by at least one fixture; every
fixture asserts trace steps; mutation spot-check passes.

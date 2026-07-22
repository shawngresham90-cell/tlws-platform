# Split Sleeper Calculator — Review Checklists (PR 1)

Two gates stand between this documentation and a public calculator. This
file is the working checklist for both. Neither reviewer identity is
invented here: **reviewer = OWNER TO ASSIGN** in both sections.

## 1. Independent expert review (gates PR 2 authorization)

Reviewer: **OWNER TO ASSIGN** — an independent, qualified HOS professional
(safety director, DOT compliance consultant, or FMCSA-experienced auditor)
with no editorial or financial stake in the tool.

The reviewer confirms, item by item, initialed and dated:

- [ ] Ledger R1–R4, R10 (base clocks) match current 49 CFR 395.3 —
      including the 2020 30-minute-break rule (any ≥30-min non-driving
      status qualifies).
- [ ] Ledger R5 operative reading is correct: ≥7 consecutive sleeper +
      ≥2 consecutive off/sleeper/combination, ≥10 total, both properly
      paired periods excluded from the 14-hour window.
- [ ] Ledger R7: long-first and short-first sequences both qualify;
      custom pairs between 7/3 and 8/2 inclusive qualify.
- [ ] Ledger R11: the long period must be entirely sleeper berth.
- [ ] **Ledger R6 (BLOCKED): confirm the recalculation anchor is the end
      of the FIRST qualifying period, with the operative FMCSA source
      quoted into the ledger.**
- [ ] **Ledger R9 (BLOCKED): confirm rolling-split continuation (P2 of a
      completed pair may serve as P1 of the next), with source.**
- [ ] Ledger R8: the split never adds 60/70-cycle availability.
- [ ] **Ledger R15: confirm the fewest-violations pairing-selection rule
      and DEFINE the tie-breaking order the engine should encode.**
- [ ] Ledger R13: confirm 6/4 and 5/5 remain unauthorized for ordinary
      drivers as of the review date; record the FR 2025-17939 pilot's
      then-current status.
- [ ] R12/R14 scope refusals (passenger; exceptions never automated) are
      correctly framed.
- [ ] The calculation spec (`split-sleeper-calculation-spec.md`) §§2–4
      implements the ledger and nothing beyond it.
- [ ] The D17 copy set is regulatorily accurate in substance (wording
      style is the attorney's lane).
- [ ] The PR 2 fixture inventory covers every rule and failure mode the
      reviewer can think of; reviewer adds any missing cases.
- [ ] (Later, PR 6 gate) Reviewer independently authors 25+ real-world
      scenarios NOT drawn from the fixture inventory and validates the
      built engine against them.

Sign-off: name · credentials · date · ledger version reviewed.

## 2. Attorney / disclaimer review (gates PUBLIC LAUNCH, not this PR)

Reviewer: **OWNER TO ASSIGN** (the retained attorney).

- [ ] Persistent disclaimer wording (planning/education only; ELD and the
      regulation are the official sources; verify before driving).
- [ ] The ACTUAL USABLE TIME approved phrasing ("Your clocks show … usable
      driving time. Your … is the limiting clock.") — confirm the
      planning framing carries no implied legal determination; the banned
      list ("you may legally drive", "legal/illegal", "compliant",
      "guaranteed") is contractually enforced in copy review.
- [ ] The D17 refusal/warn/fail set — especially the 6/4-5/5 pilot
      explanation and the "verify on your ELD" warns.
- [ ] The explanation-trace template wording (spec §5).
- [ ] About/first-run panel: the does-not list (no log editing, no ELD
      connection, no legal status, no exception automation, no
      pilot-program math).
- [ ] Share/print artifact carries the disclaimer + verification date.
- [ ] The same-day-pause procedure for any confirmed calculation error
      (blueprint D28 row 1) is acceptable as the public commitment.
- [ ] Liability posture of the "Review official rule" panel (linking
      official sources with verification dates).

Sign-off: name · date · document versions reviewed.

## 3. Sequencing reminder

Expert sign-off (§1, minus the PR 6 item) → owner authorizes **PR 2**
(pure engine + fixtures). Attorney sign-off (§2) is required before the
tool is made public (PR 6), not before engine or UI PRs merge, since
everything stays flag-hidden until launch.

# DOT Tools — Attorney & Compliance Review Gates

Every gate below must show PASSED (with reviewer + date recorded in
`decision-log.md`) before the listed surface ships publicly. PR 1 opens the
gates; it satisfies none of them.

## Attorney-review gate (counsel, not a template service)

| Item | Scope | Blocks |
|---|---|---|
| AT-1 | Fix-It Letters: all 5 templates (driver statement, shop request, company memo, **DataQ RDR draft**, preventive action plan) + the surrounding disclaimers | Letters launch (Owner Decision 6 — held from public launch until passed) |
| AT-2 | The 23 "what to say" scripts in the Violation Checker | Checker's script section (checker may launch with scripts hidden if AT-2 lags) |
| AT-3 | Roadside "what to say / what NOT to say" coaching (ledger R-RS-04) | Roadside launch, or launch with the say/don't-say section held back |
| AT-4 | Cheat-sheet legal claims: "refusing to sign = arrest in some states", "signing ≠ admitting guilt" (R-CS-05) | Those lines only |
| AT-5 | DOT Tools disclaimer set (reference-aid, not-legal-advice, estimate-not-official framing) | All tools |

Note: the platform's standing posture applies — counsel review of /privacy
and /sms-terms is already an owner to-do; AT-5 can ride the same engagement.

## Compliance (regulatory) review gate

| Item | Scope | Blocks |
|---|---|---|
| RC-1 | Ledger sections A, B (HOS + PC/yard) rows verified + reviewer-signed | Before You Move launch |
| RC-2 | Ledger section C+D (23 violations + SMS mechanics) | Violation Checker / CSA Estimator launch |
| RC-3 | Ledger section E (pre-trip + CVSA thresholds) — contingent on the CVSA source decision (D-9) | Pre-Trip Check launch |
| RC-4 | Ledger sections G, H (cheat sheet, roadside claims — incl. the R-RS-02 DVIR correction) | Cheat sheet / Roadside launch |
| RC-5 | Ledger section F (regulation index titles + honest-status fetch respec) | Regulation browser launch |
| RC-6 | Adverse-conditions unblock (R-HOS-09/10 + Decision-10 conditions) | The adverse path — indefinitely CAN'T CALL IT until passed |
| RC-7 | Split-sleeper cross-gate — `split-sleeper-rule-ledger.md` R1–R15 + expert sign-off | Any split computation inside DOT Tools |

Reviewer: independent regulatory reviewer, OWNER TO ASSIGN (the Split
Calculator reviewer pipeline; one reviewer may cover both ledgers).

## Security-review gate (light)

| Item | Scope | Blocks |
|---|---|---|
| SEC-1 | Wallet Model A pass per `wallet-model-a-spec.md` §5 (export/import format, no-egress rule, persistence UX) | Wallet launch |

## Gate discipline

- A tool launches only when **all** of its gates pass; tools launch
  independently (Letters can lag the rest — Decision 6 expects it).
- Gate outcomes, reviewer names, and dates are recorded in
  `decision-log.md`; a gate claimed "passed" without a recorded reviewer
  and date is not passed.
- Re-opened gates (source change, FR action, CVSA annual update) re-block
  their surfaces per the ledger's re-verification schedule.

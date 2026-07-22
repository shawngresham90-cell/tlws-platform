# DOT Tools — Shared HOS Engine Integration Specification

Owner Decision 8: DOT Tools, the Trip Planner, and the Split Sleeper
Calculator consume **one** verified HOS engine. The standalone app's
independent HOS arithmetic is discarded. No second implementation may be
created, vendored, forked, or "temporarily" inlined.

## 1. The one engine

`src/lib/trip-planner/hos-engine.ts` (+ `HOS` constants in
`src/lib/trip-planner/types.ts`), with exception posture in
`src/lib/trip-planner/hos-exceptions.ts`.

Consumed surface for "Before You Move":

| Export | Use in DOT Tools |
|---|---|
| `freshClockState` / `validateClockState` | Build + fail-closed validate a state from the driver's four ELD numbers |
| `remainingClocks` | Per-clock remaining time + `limitedBy` (names the limiting clock for the verdict body) |
| `legalDrivingMin` | The usable-now figure, break-aware (fixes ledger R-HOS-08) |
| `planDrive` | Future: "can I make this stop" projections (not MVP) |
| `recapProjection` | Future: cycle roll-off display (not MVP) |

## 2. Input mapping (BYM form → engine state)

The standalone form asks four numbers: hours driven since last 10-hr break,
hours since coming on duty, hours driven since last 30-min break, cycle
hours used (+ 60/70 selector). The rebuilt tool maps these to a `ClockState`
via a thin adapter in the DOT Tools layer. Rules:

- The adapter contains **no HOS arithmetic** — only unit conversion and
  state construction. Any subtraction against a limit happens in the engine.
- All inputs validated finite and in range; otherwise CAN'T CALL IT
  (fail closed, same posture as `last-stop.ts`).
- The four-number model assumes the last rest was a simple 10-hr reset. The
  form must ask "Was your last break 10+ hours in one block?" — anything
  else routes to CAN'T CALL IT + a pointer to the Split Sleeper Calculator
  (ledger R-HOS-11).

## 3. Exceptions posture (unchanged, conservative)

- **Adverse conditions** (`assessAdverseDriving` — architecture stub,
  returns not-supported): stays not-supported. Decision 10: no toggle that
  auto-adds time. The path unblocks only when (a) qualifying conditions are
  verified (ledger R-HOS-09/10), (b) the decision questions are specified,
  (c) the engine's conservative default is preserved for unclear answers,
  and (d) the regulatory reviewer approves.
- **Split sleeper** (`assessSplitSleeper`): expert-gated per the Split
  Calculator ledger; BYM never computes splits itself.
- **Short haul** (`assessShortHaul`): out of MVP scope; short-haul
  indications route to CAN'T CALL IT.

## 4. Non-goals / prohibitions

- No engine changes ship in any DOT Tools PR. If DOT Tools needs something
  the engine lacks, that is a separate engine PR with its own tests and
  ledger update, reviewed on its own.
- No behavior change to the Trip Planner or the Split Sleeper Calculator as
  a side effect of DOT Tools work.
- The Violation Checker, Pre-Trip Check, Roadside Mode, Letters, Wallet, and
  regulation browser perform **no time arithmetic at all** — they are
  content/data surfaces.

## 5. Test obligations (implementation PRs, recorded here as the contract)

- Adapter unit tests: form values → expected `ClockState`, including NaN /
  negative / out-of-range → CAN'T CALL IT.
- Golden tests: BYM verdicts for a fixture set must equal verdicts derived
  by calling the engine directly — proving there is no second arithmetic.
- Banned-phrase fixture test per `verdict-language-spec.md`.

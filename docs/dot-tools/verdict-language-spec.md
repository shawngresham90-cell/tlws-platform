# DOT Tools — Verdict Language Specification

Governs every user-facing conclusion any DOT Tool renders. Extends the
approved Split Sleeper Calculator language rules (`split-sleeper-calculation-spec.md`)
to the DOT Tools surface. Owner Decision 9 (July 22, 2026) is the authority.

## 1. Banned outputs (must never render, in any casing or paraphrase)

- "You're legal" / "You are legal" / "YES — YOU'RE LEGAL"
- "Looks like valid PC" or any formulation asserting a log entry is valid
- "Safe to drive"
- "Guaranteed" (any guaranteed outcome)
- "Official CSA score" or presenting the estimator as official
- "Compliant" / "in compliance" as a verdict
- Any equivalent legal conclusion ("you may legally drive", "this is
  allowed", "you're covered", "DOT can't touch this")

Enforcement: the banned list ships as a test fixture; a unit test fails the
build if any verdict template contains a banned phrase. (Test lands with the
implementation PR, not PR 1.)

## 2. Required verdict vocabulary

Exactly four verdict levels, used across all DOT Tools:

| Verdict | Use |
|---|---|
| **LOWER RISK** | The entered facts, taken at face value, do not hit a modeled limit |
| **HIGH RISK** | The entered facts approach a limit, rely on a disfavored pattern, or include a known red-flag factor |
| **DO NOT MOVE** | The entered facts hit or exceed a modeled limit, or describe a condition with an out-of-service consequence |
| **CAN'T CALL IT** | The tool cannot honestly compute this case (see triggers) |

Every verdict body must include:
1. "**based on the information you entered**" (or the exact phrase
   "based on what you entered");
2. the **limiting clock or limiting rule named** when a computation ran
   (pattern approved for the Split Calculator: "Your 70-hour cycle is the
   limiting clock.");
3. a pointer to **the official source, your ELD, company policy, and
   qualified guidance where applicable** — phrased for the tool (e.g.
   "Confirm against your ELD and 49 CFR 395.3 before you move.").

## 3. Mandatory CAN'T CALL IT triggers

The tool must return CAN'T CALL IT — not a best guess — when:

- the driver's situation involves a **split-sleeper pattern** (any indication
  the last qualifying rest was not 10+ consecutive hours) — until the Split
  Calculator ledger clears and the shared-engine path is approved (R-HOS-11);
- an **adverse-conditions claim** is made (R-HOS-09/10 BLOCKED; Decision 10 —
  no auto-toggle, ever);
- inputs describe **passenger-carrying, intrastate, short-haul-exempt, or
  Canadian** operations (MVP models US interstate property only);
- any required input is missing, non-finite, or out of range (fail closed —
  same posture as the Last Stop engine);
- a rule the path depends on is UNVERIFIED or BLOCKED in the ledger at the
  time the path would ship.

CAN'T CALL IT copy pattern:

> **CAN'T CALL IT.** This tool doesn't model [situation] yet, and guessing
> here could cost you your CDL. Check your ELD, 49 CFR [cite], and your
> company's safety department before you move.

## 4. Per-tool mapping of current verdicts

| Current string | Replacement |
|---|---|
| "YES — YOU'RE LEGAL" | "LOWER RISK — based on what you entered" + usable time + limiting clock |
| "RISKY — UNDER 1 HOUR LEFT" | "HIGH RISK — based on what you entered" (cushion guidance retained) |
| "NOT YET — 30-MIN BREAK FIRST" | "DO NOT MOVE — 30-minute break required first" (break is a hard limit) |
| "NO — PARK IT" | "DO NOT MOVE" + which clock(s) closed |
| "LOOKS LIKE VALID PC" | "LOWER RISK — based on what you entered. PC is judged after the fact by an officer or auditor; annotate the log and keep your story consistent." |
| "HIGH RISK — KEEP IT SHORT" | Retained as HIGH RISK (already conforms); 30-min heuristic labeled as TLWS editorial rule of thumb, not regulation (R-PC-06) |
| "DO NOT USE PC" | "DO NOT MOVE — do not log this as PC" (hard-kill conditions unchanged) |
| "YARD MOVE — LOG IT ON-DUTY" | Retained, reframed as instruction not verdict; window-burn warning kept |
| Pre-trip ok/warn/no headlines | Mapped to LOWER RISK / HIGH RISK / DO NOT MOVE; colorful phrasing ("brakes are never a gamble") may remain in the body, never in the verdict slot |
| CSA points panel | Header: "CSA estimate — based on public SMS methodology. This is not your official score." + link to the official FMCSA SMS site |

## 5. Usable-time display (fixes ledger R-HOS-08)

The current app overstates drive time by ignoring the impending 30-minute
break. Required display, powered by the shared engine:

- **Usable now (before a required break):** min(remaining drive, remaining
  window, remaining cycle, time-until-break-required)
- **After a 30-minute break:** the additional time available, if any
- The limiting clock named in prose for each figure

## 6. Tone

Shawn's voice (direct, driver-to-driver) is welcome in bodies, coaching, and
"protect yourself" lists. It never replaces the verdict vocabulary, and no
body sentence may re-assert a banned conclusion the verdict slot avoided.

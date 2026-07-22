# DOT Tools — Release-Gate Matrix

Live GO/NO-GO board for every future DOT Tool. A tool is GO only when every
cell in its row reads PASS (or n/a). Update cells as gates pass; gate
definitions live in `../../dot-tools/review-gates.md`, row statuses in
`../dot-tools-rule-ledger.md`.

Status vocabulary: **PASS** · **PENDING** (work exists, not signed) ·
**OPEN** (not started) · **n/a**.

| Future tool (PR) | Regulatory gate | Attorney gate | Security gate | Owner items | Current status → GO/NO-GO |
|---|---|---|---|---|---|
| Verification package (PR 2 — this PR) | n/a (it creates the process) | n/a | n/a | O-1 assign reviewer | **GO** (docs only) |
| Regulation browser (PR 3) | RC-5: S-6 check + honest-status respec — OPEN | AT-5 disclaimers — OPEN | n/a | O-8 read-aloud | **NO-GO** |
| Document Wallet (PR 4) | n/a (no regulatory rows) | AT-5 Part 6 disclosure — OPEN | SEC-1 — OPEN | — | **NO-GO** (closest to GO; needs SEC-1 + disclosure sign-off) |
| Pre-Trip Check (PR 5a) | RC-3: S-3/S-4 + CVSA-softened language — OPEN | AT-5 — OPEN | n/a | O-3 resolved (reference-only) | **NO-GO** |
| Cheat Sheet (PR 5b) | RC-4 (cheat rows G): S-3/S-5/S-13 — OPEN | AT-4 signing/arrest + AT-5 — OPEN | n/a | O-7 voice items | **NO-GO** |
| Roadside Mode (PR 6) | RC-4 (roadside rows H, incl. R-RS-02 correction) — OPEN | AT-3 coaching + AT-5 — OPEN (may launch with say/don't section held) | n/a | sales-free policy applies by construction | **NO-GO** |
| Before You Move (PR 7) | RC-1: S-1/S-10 + worksheet A–D signed — OPEN | AT-5 — OPEN | n/a | — | **NO-GO** |
| Violation Checker + CSA estimate (PR 8) | RC-2: S-7 table complete + R-SMS-07 respec — OPEN | AT-2 scripts — OPEN (may launch with scripts held) + AT-5 | n/a | O-6 DataQs primary-link applied | **NO-GO** |
| Email capture activation (PR 9) | n/a | consent wording ride-along with AT-5 — OPEN | n/a | owner activation approval — OPEN | **NO-GO** |
| Fix-It Letters (PR 10) | RC-2 subset (cites in templates) — OPEN | **AT-1 — OPEN (hard block, Decision 6)** | n/a | DataQs-primary-link applied | **NO-GO** |
| Adverse-conditions path (no PR scheduled) | RC-6: worksheet B + reviewer approval — OPEN | n/a | n/a | Decision 10 conditions | **NO-GO (indefinite — CAN'T CALL IT until passed)** |
| Split computation inside DOT Tools | RC-7: Split Calculator ledger + expert — OPEN | n/a | n/a | — | **NO-GO (defers to Split Calc track)** |
| Canada anything beyond official link-out | Canadian ledger + qualified review — not started | — | — | Decision 1 | **NO-GO (blocked by decision)** |
| Old-app export + banner (legacy change) | n/a | n/a | export format rides SEC-1 | **approved in principle**; O-5 final go | **NO-GO until owner schedules it** |
| Redirects / retirement | n/a | n/a | n/a | migration criteria (`../../dot-tools/migration-and-redirects.md`) | **NO-GO (sequence-gated)** |

## Reading the board

- Nothing is GO except this verification package itself — correct and
  expected: PR 1 seeded 0 VERIFIED rows and PR 2 creates the means to
  change that.
- The fastest path to a first shipped tool is **Wallet (PR 4)**: one
  security pass + one disclosure sign-off, no regulatory rows.
- The regulatory critical path for everything else is O-1 (assign the
  reviewer), then S-1…S-14 click-throughs.

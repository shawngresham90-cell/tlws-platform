# DOT Tools — Conservative Implementation Sequence (revised)

Replaces the blueprint's original 8-PR plan with a sequence that respects
the owner's decisions (US-only, gates stay for now, Letters held, adverse
blocked) and the review gates in `review-gates.md`. Each PR is draft-first,
green-preview, owner-approved before merge — the platform's standing
protocol. **PR 2+ requires explicit owner approval to begin; nothing is
authorized by this document.**

| PR | Scope | Preconditions |
|---|---|---|
| **PR 1 (this PR)** | Docs only: inventory, 89-row ledger, all specs, this sequence | — |
| **PR 2** | Ledger verification support: owner click-through worksheet (like the Split Calculator package) + source-stamping updates to ledger rows as they verify. Docs only. | Owner begins click-throughs; reviewer assigned (O-1) |
| **PR 3** | `/dot-tools` hub + regulation browser (US only): 39-part index, 147 shortcuts, synonym search, eCFR live fetch with honest status + visible data date; Canada = labeled official-source link only. No calculators. | RC-5 passed |
| **PR 4** | Document Wallet (Model A): free, device-local, export/import. | SEC-1 passed |
| **PR 5** | Pre-Trip Failure Check + Cheat Sheet page (print styles; email capture UI present but send path inert until email PR). | RC-3, RC-4 (cheat-sheet rows), AT-4/AT-5 for the held lines |
| **PR 6** | Roadside Mode, sales-free per policy. | RC-4, AT-3 (or launch with say/don't-say held) |
| **PR 7** | Before You Move on the shared engine: adapter + verdict layer + banned-phrase tests; split/adverse/short-haul → CAN'T CALL IT. | RC-1 passed; verdict spec tests in place |
| **PR 8** | Violation Checker + CSA estimate (approximate framing per R-SMS-08; invented bands removed/relabeled per R-SMS-07). | RC-2 passed; AT-2 for scripts (or scripts held) |
| **PR 9** | Email capture activation: Resend template + send path + honest success/failure UI. | Owner approves activation; `email-capture-spec.md` rules enforced |
| **PR 10** | Fix-It Letters. | AT-1 passed (Decision 6) |
| **PR 11** | Analytics events per `analytics-spec.md` (may fold into PRs 3–8 per-surface instead — implementer's call, spec is binding either way). | — |
| **Phase 3+ (not platform PRs)** | Old-app export + banner; migration window; redirects; retirement. | O-5; `migration-and-redirects.md` criteria |

## Sequencing rationale

- Content surfaces (browser, wallet, pre-trip, roadside) ship before
  calculators: they carry no arithmetic risk and build the traffic base.
- Both calculators land only after their ledger sections verify — the
  calculators are the two surfaces where a wrong number costs a CDL.
- Letters last among tools: it has the deepest attorney dependency and the
  legacy meter makes its current usage smallest.
- The legacy app is untouched through the entire platform sequence.

## Standing exclusions (all PRs)

No second HOS implementation; no cloud document storage; no Canadian
interpretation; no sales in Roadside Mode; no email/SMS consent mixing; no
change to Trip Planner or Split Sleeper behavior; no Directory/TPC changes
from this track.

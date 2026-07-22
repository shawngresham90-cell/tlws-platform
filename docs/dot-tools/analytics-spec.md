# DOT Tools — Privacy-Safe Analytics Specification

The standalone app has zero analytics. The platform version uses the
existing Plausible setup and the bucketed-event conventions established by
`tpc-analytics.ts`. Nothing here is implemented in PR 1.

## Never-log list (absolute)

Events must never carry: free text, exact hours or any raw HOS input,
document images/types/expiration dates, names, email addresses, phone
numbers, violation selections tied to any identifier, letter contents, or
anything from the Wallet. Plausible is cookieless and aggregate; these rules
keep the payloads clean too.

## Event list (MVP)

| Event | Props (bucketed only) | Fires |
|---|---|---|
| `dot_tools_opened` | `tool` (hub, browser, before-you-move, violation-checker, pre-trip, roadside, letters, wallet, cheat-sheet) | Page/tool view |
| `dot_reg_opened` | `part` (e.g. "395") — part number only, never section text | Regulation sheet opened |
| `dot_reg_search` | `hit` (yes/no) — never the query string | Search executed (debounced) |
| `dot_bym_verdict` | `verdict` (lower-risk, high-risk, do-not-move, cant-call-it), `limiting` (drive, window, cycle, break, none) | BYM result rendered |
| `dot_pc_verdict` | `verdict` (same vocabulary) | PC/yard result rendered |
| `dot_violation_checked` | `basic` (hos, unsafe, maintenance, fitness) — never the specific violation | Checker result rendered |
| `dot_pretrip_checked` | `defect` (abs, tire, air, light, brake, flap, glass, leak) | Pre-trip result rendered |
| `dot_roadside_opened` | — | Roadside Mode opened |
| `dot_letter_generated` | `kind` (statement, shop, company, dataq, prevent) | Letter rendered (post-attorney launch) |
| `wallet_opened` | — | Wallet opened |
| `wallet_doc_added` | — (no type, no date) | Document saved |
| `wallet_exported` | — | Export completed |
| `dot_email_submitted` | — | Accepted email capture (see `email-capture-spec.md`) |
| `dot_source_clicked` | `dest` (ecfr, fmcsa-sms, dataqs, canada-official) | Official-source link-out |
| `dot_fetch_failed` | `api` (ecfr) | Live-text fetch failure (feeds the honest-status display work) |

Bucketing rationale: `dot_bym_verdict.limiting` tells us which clock
constrains real drivers without ever logging their hours;
`dot_violation_checked.basic` shows demand shape without profiling anyone's
specific violation.

## Migration measurement

`dot_tools_opened` totals vs the legacy site's Netlify analytics are the
Phase-6 traffic-parity criterion in `migration-and-redirects.md`. No
cross-site identifier exists or is wanted — aggregate counts only.

## Kill switch

Same pattern as TPC: a single env flag can disable DOT Tools event emission
without touching the tools themselves.

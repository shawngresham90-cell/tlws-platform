# TLWS DOT Tools — Documentation Index (PR 1, docs only)

Planning and compliance groundwork for migrating the standalone Reg Deck
application into the platform as **TLWS DOT Tools** (`/dot-tools`). This PR
contains no code, no routes, no UI, no feature flags, no migrations, no
old-app changes, and launches nothing.

Authorized-scope map:

| # | Authorized item | Document |
|---|---|---|
| 1 | Standalone application inventory | `inventory.md` §1–2 |
| 2 | Complete regulatory ledger | `../compliance/dot-tools-rule-ledger.md` (89 rows) |
| 3 | Rule / threshold / citation / severity / verdict-path inventory | `inventory.md` §3 + ledger |
| 4 | Keep / improve / remove matrix | `inventory.md` §9 |
| 5 | Verdict-language specification | `verdict-language-spec.md` |
| 6 | Shared HOS integration specification | `hos-integration-spec.md` |
| 7 | Document Wallet Model A privacy & security spec | `wallet-model-a-spec.md` |
| 8 | Legacy localStorage / IndexedDB inventory | `inventory.md` §4 |
| 9 | Vault export & migration specification | `migration-and-redirects.md` + `wallet-model-a-spec.md` §3 |
| 10 | Old-route / bookmark / backlink / redirect inventory | `inventory.md` §8 |
| 11 | Parallel-run and rollback plan | `migration-and-redirects.md` |
| 12 | Pro-customer transition checklist | `pro-customer-transition.md` |
| 13 | Optional email-capture specification | `email-capture-spec.md` |
| 14 | Roadside sales-free policy | `roadside-sales-free-policy.md` |
| 15 | Privacy-safe analytics specification | `analytics-spec.md` |
| 16 | Attorney & compliance-review gates | `review-gates.md` |
| 17 | Owner decision log | `decision-log.md` |
| 18 | Revised conservative implementation sequence | `implementation-sequence.md` |

Ledger totals: **89 rows — 0 VERIFIED · 72 UNVERIFIED · 9 CROSS-REF ·
8 BLOCKED.** No row is marked verified because the behavior already exists
in the standalone app; verification requires human click-through of the
primary source plus reviewer sign-off, per the ledger's process section.

PR 2+ (any implementation) requires explicit owner approval and the review
gates in `review-gates.md`.

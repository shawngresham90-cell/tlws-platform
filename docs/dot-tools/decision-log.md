# DOT Tools — Owner Decision Log

Rulings are binding on all DOT Tools work. Open items block the surfaces
they touch. Dates are decision dates.

## Decided (owner rulings, July 22, 2026)

| # | Decision | Ruling |
|---|---|---|
| 1 | Launch jurisdiction | **US only.** No Canadian rule summaries, search results, calculator output, or compliance conclusions ship. Canada may appear only as a clearly labeled link to official Government of Canada sources. Canadian launch requires its own ledger + qualified Canadian review. |
| 2 | Core product model | All core DOT Tools ultimately free: no $9.99 Pro gate, no 3-check meter, no email gate before results, no login for core safety tools. **Gate is NOT removed in PR 1** — safe transition documented only (`pro-customer-transition.md`). |
| 3 | Existing Pro customers | Do not assume zero customers. Owner checklist in `pro-customer-transition.md`; final compensation treatment **OWNER TO APPROVE**. |
| 4 | Document Wallet | Device-local only (Model A). No cloud uploads, no DB storage of document images, no account sync. Old app must get a working export before redirect/retirement; **minimum 60-day parallel migration period** after export is available, old vault route accessible throughout. |
| 5 | Email capture | Optional, post-content only: "Email me a copy and occasional rule updates." May not block content, claim unconfirmed delivery, pre-check consent, or combine SMS with email consent. Dormant Resend documented, **not activated in PR 1**. |
| 6 | Fix-It Letters | Held from public launch until templates + disclaimers pass attorney review (gate AT-1). Other tools may launch separately once their own gates clear. |
| 7 | Roadside Mode | Sales-free, absolutely: no product CTA, pop-up, email gate, upsell, or advertisement in the roadside flow (`roadside-sales-free-policy.md`). |
| 8 | HOS architecture | One shared verified HOS engine for DOT Tools, Trip Planner, Split Sleeper Calculator. Standalone app's independent arithmetic discarded. No second implementation (`hos-integration-spec.md`). |
| 9 | Verdict language | Banned: "You're legal", "Looks like valid PC", "Safe to drive", guaranteed CSA outcomes, equivalent legal conclusions. Required: LOWER RISK / HIGH RISK / DO NOT MOVE / CAN'T CALL IT + "based on the information entered" + official-source/ELD/company-policy pointer (`verdict-language-spec.md`). |
| 10 | Adverse conditions | No toggle that automatically adds time. Path blocked until qualifying conditions verified, decision questions specified, engine's conservative behavior preserved, and the regulatory reviewer approves (ledger R-HOS-09/10). |

## Open (OWNER TO DECIDE / TO APPROVE / TO ASSIGN)

| ID | Item | Blocks |
|---|---|---|
| O-1 | Regulatory reviewer assignment (shared with Split Calculator pipeline) | All RC gates |
| O-2 | Attorney engagement for AT-1..AT-5 | Letters; script/coaching sections |
| O-3 | CVSA OOS criteria source: obtain current publication vs soften all numeric OOS claims to non-numeric language (ledger Unresolved Source 1) | RC-3 (Pre-Trip), parts of RC-2/RC-4 |
| O-4 | Pro-customer compensation treatment (refund / credit / grandfather / bonus mix) after counts are pulled from Stan | Gate removal on legacy app; public "free" announcement |
| O-5 | Old-app change approval (export button + banner — Phase 3 of `migration-and-redirects.md`) | Migration window start; all redirects |
| O-6 | DataQ Tracker (godatq.netlify.app): keep as external link vs absorb later | Link policy on Checker/Letters |
| O-7 | Voice items: Bible verse + "17 yrs, 0 violations" byline on the platform cheat sheet | Cheat-sheet content finalization |
| O-8 | Read-aloud feature: port at MVP or defer | Regulation browser scope |
| O-9 | Netlify Forms subscriber-list export timing | Retirement criteria |
| O-10 | Effective retirement sign-off (Phase 6) — future | Retirement |

## Gate outcomes (recorded as they pass)

_None yet. Format: gate ID · reviewer · date · outcome · notes._

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

## Decided — PR 2 authorization round (July 22, 2026)

| # | Decision | Ruling |
|---|---|---|
| 11 | CVSA material | **Reference-only** unless proper access or permission is obtained. Softened non-numeric language ships where CVSA is the only source; CFR-anchored numbers unaffected. Full memo: `../compliance/dot-tools-verification/cvsa-licensing-memo.md`. Resolves O-3 (upgrade path documented). |
| 12 | DataQ links | **Official FMCSA DataQs (dataqs.fmcsa.dot.gov) is the primary DataQ link** in all shipped content. The TLWS DataQ Tracker (godatq.netlify.app) may appear only as a clearly secondary, clearly TLWS-branded helper. Resolves O-6. |
| 13 | Old-app migration banner + vault export | **Approved in principle** for a later implementation PR to the legacy app. Scheduling and final go remain with the owner (O-5 narrows to timing only). No old-app change ships from the platform repo. |
| 14 | Reaffirmed | US-only MVP (Canada blocked except clearly labeled official link-outs); core tools eventually free; Wallet device-local; Fix-It Letters blocked until attorney review; existing Pro customers counted and reviewed before paid access is removed. |

## Open (OWNER TO DECIDE / TO APPROVE / TO ASSIGN)

| ID | Item | Blocks |
|---|---|---|
| O-1 | Regulatory reviewer assignment (shared with Split Calculator pipeline) | All RC gates |
| O-2 | Attorney engagement for AT-1..AT-5 | Letters; script/coaching sections |
| O-3 | ~~CVSA source~~ **RESOLVED by Decision 11** (reference-only; upgrade path in the memo) | — |
| O-4 | Pro-customer compensation treatment (refund / credit / grandfather / bonus mix) after counts are pulled from Stan | Gate removal on legacy app; public "free" announcement |
| O-5 | Old-app change **timing** (export button + banner approved in principle by Decision 13 — schedule + final go) | Migration window start; all redirects |
| O-6 | ~~DataQ link policy~~ **RESOLVED by Decision 12** (official DataQs primary; Tracker secondary) | — |
| O-7 | Voice items: Bible verse + "17 yrs, 0 violations" byline on the platform cheat sheet | Cheat-sheet content finalization |
| O-8 | Read-aloud feature: port at MVP or defer | Regulation browser scope |
| O-9 | Netlify Forms subscriber-list export timing | Retirement criteria |
| O-10 | Effective retirement sign-off (Phase 6) — future | Retirement |

## Gate outcomes (recorded as they pass)

_None yet. Format: gate ID · reviewer · date · outcome · notes._

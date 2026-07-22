# TLWS DOT Tools — Standalone Application Inventory (verified)

Complete inventory of the standalone Reg Deck application, computed from its
extracted source (11 files, 149 KB) on July 22, 2026 — not taken on faith
from any earlier description. This is the factual baseline every other DOT
Tools document builds on.

## 1. Files

| File | Size | Role |
|---|---|---|
| `index.html` | 52.2 KB | Regulation browser (US + CA), tools hub, email capture, product cards |
| `violation.html` | 18.9 KB | Violation Checker + CSA Points Estimator (`#csa` anchor) |
| `move.html` | 16.3 KB | "Before You Move" — HOS tab + PC/Yard Move tab |
| `roadside.html` | 11.2 KB | Roadside Mode (standalone styling, no rd.css) |
| `rd.css` | 9.9 KB | Shared design system for tool pages |
| `letters.html` | 9.2 KB | Fix-It Letters (5 templates) |
| `vault.html` | 9.2 KB | Document Vault (IndexedDB) |
| `pretrip.html` | 9.0 KB | Pre-Trip Failure Check (8 defects) |
| `cheatsheet.html` | 8.3 KB | 1-page DOT Cheat Sheet (print-styled) |
| `rd.js` | 4.6 KB | Shared layer: Pro gate, meter, unlock, escaping |
| `_headers` | 236 B | `no-cache` on shell + assets; no security headers |

## 2. Routes and gates

| Route | Tool | Gate today | Future (Decision 2) |
|---|---|---|---|
| `/` | Regulation browser + hub | Free | Free |
| `/move.html` | Before You Move | Metered 3/day | Free |
| `/violation.html` | Violation Checker + CSA Estimator | Metered 3/day | Free |
| `/pretrip.html` | Pre-Trip Failure Check | Free | Free |
| `/roadside.html` | Roadside Mode | Free | Free, sales-free |
| `/letters.html` | Fix-It Letters | Metered 3/day (hub badge says PRO) | Free, **held for attorney review** |
| `/vault.html` | Document Vault | Hard Pro gate | Free (Document Wallet, Model A) |
| `/cheatsheet.html` | DOT Cheat Sheet | Free (email ask is soft — page directly reachable) | Free |

## 3. Rule / threshold / citation / verdict-path inventory (totals)

Every value below has a ledger row in `docs/compliance/dot-tools-rule-ledger.md`.

- **US regulation index:** 39 parts (49 CFR 350–399; reserved: 355, 388,
  394) with 147 curated section shortcuts.
- **Canada index:** 10 topic groups, 26 section refs, hardcoded paraphrase —
  **excluded from MVP** (Decision 1 / ledger R-CA-01).
- **Search synonym maps:** 187 US phrases, 51 CA phrases → part routing.
- **Violation DB:** 23 entries (HOS 6 · Unsafe Driving 6 · Vehicle
  Maintenance 8 · Driver Fitness 3), 11 OOS-flagged; per entry: CFR cite,
  severity 1–10, BASIC, fix[] steps, docs[] evidence, "what to say" script.
- **CSA math:** points = (severity + 2 if OOS) × time weight (×3 / ×2 / ×1);
  display bands ≥21 / ≥10 (TLWS invention — ledger R-SMS-07, BLOCKED).
- **Pre-trip DB:** 8 defects; embedded numeric thresholds: ~3 psi/min air
  loss, 85 psi governor cut-in, 20 % brakes OOS, 4/32–2/32 tread, 1/4"
  windshield-crack zone rules, any-fuel-leak OOS.
- **HOS thresholds encoded:** 11 / 14 / 8 hr-then-30-min / 10-hr reset /
  60-7 & 70-8 cycles / 34-hr restart (text) / adverse auto +2 driving **and**
  +2 window (BLOCKED — Decision 10).
- **Letter templates:** 5 (driver statement, shop request, company memo,
  DataQ RDR draft, preventive action plan).

### Verdict paths (exact current strings)

| Tool | Verdicts | Disposition |
|---|---|---|
| BYM · HOS | "NO — PARK IT" / "NOT YET — 30-MIN BREAK FIRST" / "RISKY — UNDER 1 HOUR LEFT" / **"YES — YOU'RE LEGAL"** | Last is banned — full respec in `verdict-language-spec.md` |
| BYM · PC/Yard | "YARD MOVE — LOG IT ON-DUTY" / "DO NOT USE PC" / "HIGH RISK — KEEP IT SHORT" / **"LOOKS LIKE VALID PC"** | Last is banned — respec |
| Violation Checker | Color-banded points panel | Reframe per R-SMS-08 (estimate, never official) |
| Pre-trip | Per-defect ok/warn/no headlines | Respec to LOWER RISK / HIGH RISK / DO NOT MOVE vocabulary |

## 4. Legacy client-side storage inventory (complete)

| Store | Key / name | Shape | Notes |
|---|---|---|---|
| localStorage | `rd_pro` | `"1"` when unlocked | Pro flag; set by SHAWN17 code (plaintext in `rd.js`) |
| localStorage | `rd_meter` | `{d: "YYYY-MM-DD", n: count}` | 3/day shared meter (move + violation + letters) |
| IndexedDB | `rd_vault` v1, store `docs` | `{id (auto), type, exp, img, added}` | `img` = JPEG data-URL, client-downscaled ≤1600 px, q 0.82. No export. No encryption. **Origin-bound to the legacy Netlify domain** |

Nothing else is persisted. Checker/letter inputs are never stored or
transmitted — the app's "your answers never leave this device" claims are
accurate and must remain true on the platform.

## 5. Email form

Netlify Forms `dot-cheat-sheet` (email + honeypot), `action="/cheatsheet.html"`.
Non-blocking (the sheet is directly reachable). The success page claims
"a copy is also headed to your inbox" — **no sender exists in the repo**;
this claim must not be ported (see `email-capture-spec.md`).

## 6. External links (complete, computed from source)

`stan.store/TRUCKINGLIFEWITHSHAWN` (store; also `PRO_URL` — no dedicated Pro
product exists), `…/p/save-your-cdl` ($27; appears **inside Roadside Mode**
— removed per Decision 7), `…/p/book-a-11-call…` ($79),
`godatq.netlify.app` (DataQ Tracker, separate app, linked 4×),
`truckinglifewithshawn.com`, `youtube.com/@truckinglifewithshawn`,
`www.ecfr.gov` (versioner API + deep links), `laws-lois.justice.gc.ca`,
`fonts.googleapis.com` / `fonts.gstatic.com` (Google Fonts CDN — replaced by
self-hosted next/font on the platform).

## 7. Analytics

None. Zero measurement of any kind in the standalone app. The platform spec
is greenfield — `analytics-spec.md`.

## 8. Old-route / bookmark / backlink / redirect inventory

Legacy origin: the standalone app's Netlify domain (owner-controlled).
Indexable/bookmarkable routes and their eventual platform targets
(redirects are Phase-4 only — see `migration-and-redirects.md`; **no
redirect ships now**):

| Legacy route | Future platform target |
|---|---|
| `/` | `/dot-tools` |
| `/move.html` | `/dot-tools/before-you-move` |
| `/violation.html` (+`#csa`) | `/dot-tools/violation-checker` |
| `/pretrip.html` | `/dot-tools/pre-trip` |
| `/roadside.html` | `/dot-tools/roadside` |
| `/letters.html` | `/dot-tools/letters` |
| `/vault.html` | `/dot-tools/wallet` |
| `/cheatsheet.html` | `/dot-tools/cheat-sheet` |

Known backlink sources to inventory before retirement: YouTube video
descriptions/pins, Stan store product pages, community posts, the DataQ
Tracker app (links back), printed cheat sheets in circulation (URL in
footer). Owner to export the Netlify analytics referrer list before any
redirect decision.

## 9. Keep / Improve / Remove matrix

| Item | Disposition | Notes |
|---|---|---|
| Violation DB (23 entries) | **KEEP** | Crown jewel; port structure verbatim after every ledger row verifies; scripts pass attorney review |
| Regulation index + 187/51 synonym maps | **KEEP** | Verify titles (R-IDX-01..04); US only at MVP |
| eCFR live-fetch pattern | **KEEP** | Rebuild status honestly: no "LIVE" claim before a successful fetch; visible data date (R-IDX-05) |
| Pre-trip DB | **KEEP** | Thresholds gated on CVSA source decision (D-9) |
| Roadside Mode content | **KEEP** | Sales stripped (Decision 7); scripts attorney-gated |
| Cheat sheet + print styles | **KEEP** | Email optional per `email-capture-spec.md` |
| Vault flow (downscale, expiry warnings) | **KEEP** | → Document Wallet Model A; gate removed; export added |
| Letter templates | **KEEP (held)** | Launch blocked on attorney review (Decision 6) |
| Read-aloud, share, US theming | **KEEP** | Small, low-risk ports |
| HOS calculator arithmetic | **REMOVE — rebuild on shared engine** | Decision 8; independent implementation forbidden |
| Verdict language layer | **REBUILD** | `verdict-language-spec.md` |
| PC/Yard wizard logic | **REBUILD** | Same decision tree, risk-framed language, verified guidance cites |
| Canada rule summaries | **REMOVE (MVP)** | Decision 1 — official-source link only |
| Pro gate / SHAWN17 / meter / PRO badges / upsell CSS | **REMOVE (future PR)** | Decision 2 — documented transition only in PR 1; no gate change ships now |
| Google Fonts CDN | **REMOVE** | Platform self-hosted fonts |
| Netlify Forms capture | **REMOVE** | Platform `/api/lead` pipeline if email kept (D-3 resolved: optional, post-content) |
| Invented ≥21/≥10 impact bands | **REMOVE or relabel** | R-SMS-07 |
| "eCFR LIVE" pre-fetch LED | **REMOVE** | Honest status respec |
| Roadside sales CTA | **REMOVE** | Decision 7 |
| "Copy headed to your inbox" claim | **REMOVE** | Only claim delivery on confirmed success |

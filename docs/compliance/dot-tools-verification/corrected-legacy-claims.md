# DOT Tools — Corrected / Removed Legacy Claims Record

Permanent record of every standalone-app claim the official source directly
contradicts or removes. Sourced from **SMS Methodology Appendix A v3.21**
(snapshot implemented 05/15/2026, `sms_appendixa_violationslist_3.xlsx`).
The ported product uses the **corrected** value; the legacy value never
ships. Each entry is SUPERSEDED (source contradicts it) and, where the
correct choice needs a product decision, additionally BLOCKED pending that
narrowing.

## Violation severity / citation corrections (6)

| # | Legacy (Reg Deck) | Corrected per Appendix A v3.21 | Disposition |
|---|---|---|---|
| 1 | `lamp` — 393.9, **severity 6** | `393.9` "Inoperable Required Lamp" · Clearance ID Lamps/Other · **severity 2** · DSMS Y | **SUPERSEDED — severity 6→2** |
| 2 | `expmedcard` — 391.41(a), **severity 7** (reuses the possession cite) | `391.41(a)` Medical Certificate · **severity 1**; the whole 391.41 family is low severity | **SUPERSEDED — severity 7 unsupported.** Must distinguish *possession/expiration of the medical certificate* (Medical Certificate group, low severity) from *operating while medically **unqualified*** (a different, higher-consequence section — not in the 391.41 family; correct section to be identified before any high-severity claim ships) |
| 3 | `securement` — 393.100, **severity 7** for one generic "insufficient securement" | bare `393.100` General Securement · **severity 1**; `393.100(b)` leaking/blowing/falling cargo · **severity 7** · DSMS Y | **SUPERSEDED / BLOCKED** — do not preserve one generic severity; general securement (1) and 393.100(b) (7) must be **separate product choices** |
| 4 | `mudflap` — **393.87** | `393.87` is **Warning Flags for a projecting load** (wrong anchor); the mud-flap violation is **`392.2-SLLMF`** "Wheel (mud) flaps missing or defective" · Windshield/Glass/Markings · severity 1 · DSMS Y | **SUPERSEDED — cite corrected to 392.2-SLLMF** (severity 1 unchanged) |
| 5 | `nolog` — 395.8(a), **severity 5** for a generic "no log / ELD not functioning" | bare `395.8(a)` is Form & Manner · **severity 1**; the severity-5 "no record of duty status" is a **specific** code (`395.8A-NON-ELD` / `395.8A-ELD`, Incomplete/Wrong Log) | **SUPERSEDED / BLOCKED** — do not apply severity 5 to the bare citation; narrow to the specific no-RODS ELD/non-ELD choice vs form-and-manner |
| 6 | `brakehose` — 393.45, treated as a scoring violation | bare `393.45` "Brake tubing and hose adequacy" is **DSMS = N**; the scoring chafe/leak code is `393.45(b)(2)` · DSMS Y | **SUPERSEDED / BLOCKED** — distinguish the non-DSMS bare cite from the specific `393.45(b)(2)`; record DSMS accurately |

## SMS mechanics corrections / removals

| # | Legacy behavior | Corrected | Disposition |
|---|---|---|---|
| 7 | Universal **OOS +2** on any violation when the OOS box is checked | OOS weight applies only where the BASIC methodology authorizes it; **Unsafe Driving never** | **SUPERSEDED** — R-SMS-01; rebuild BASIC-aware |
| 8 | Invented impact bands **≥10 "Moderate" / ≥21 "Heavy"** | No methodology basis | **SUPERSEDED — REMOVE** — R-SMS-07 (owner order) |
| 9 | Time-weight labels "within 6 mo / 6–12 / 1–2 yr" | 0–6 = 3 · over 6–12 = 2 · over 12–24 = 1 · **older than 24 = excluded** | Relabel + add the >24-month exclusion (R-SMS-02) |
| 10 | Result framed as "CSA math," "Points on the [BASIC] BASIC," "Company impact" | "**Estimated SMS weighted value based on public methodology.**" | Reframe (R-SMS-08); banned labels below |

## DSMS discipline (record)

- The Appendix A **DSMS (Y/N)** flag = whether a code is used in the
  **Driver** SMS. It is **not** the same as carrier SMS treatment, and it is
  **not** the SMS OOS +2 adjustment.
- Rows flagged **DSMS = N** — `brakeadj` (393.47(e)) and the bare
  `brakehose` (393.45) — must **not** be presented as automatically creating
  driver points.
- A "placed out of service" / "OOS likely" outcome is **not** evidence that
  the SMS OOS +2 severity adjustment applies.
- **Unsafe Driving** violations (phone, texting, seat belt, all speeding)
  receive **no** OOS +2.

## Banned output labels (never render, any tool)

CSA score · PSP score · official FMCSA score · carrier percentile ·
points against your CDL · guaranteed company impact.

## Standing note

A source match is not a verification. Every corrected value above still
requires the independent compliance reviewer's countersignature before the
corresponding ledger row reaches final VERIFIED. The corrections are applied
now only because the official source **contradicts** the legacy value — that
much is not in doubt.

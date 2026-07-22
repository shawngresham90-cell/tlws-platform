# Reg Deck Pro — Customer Transition Checklist

Owner Decision 2/3: core DOT Tools will ultimately be free (no Pro gate, no
daily meter, no email gate, no login), but **the existing gate is not
removed in PR 1**, and we do not assume there are zero paying customers.
This checklist is the safe path from "paid gate exists" to "free for
everyone" without leaving anyone paying for a feature that became free.

Final compensation treatment is **OWNER TO APPROVE** — this document
prepares the decision; it does not make it.

## Facts from the code audit (what customers could have bought)

- Advertised: "Reg Deck Pro — $9.99/mo", unlocking unlimited checks on
  Before You Move, Violation Checker, CSA Estimator, Fix-It Letters, and
  the Document Vault.
- The Pro link (`PRO_URL`) points at the **generic Stan store**, not a
  dedicated membership product — the code comments say the membership
  product "doesn't exist yet". It is therefore possible that purchases, if
  any, were of other products (guides/bundle) whose delivery message may or
  may not have included the `SHAWN17` unlock code.
- Unlock is client-side (`SHAWN17` → `localStorage.rd_pro`), so there is no
  server record of who unlocked. **Stan is the only source of truth for who
  paid for what.**

## Owner checklist (in order)

1. **Count the customers.** In Stan: active subscriptions (any recurring
   product), plus one-time buyers of any product whose delivery message
   included the unlock code (check each product's delivery text for
   "SHAWN17"). Record counts and dates.
2. **Identify what was promised.** Pull the exact Stan product descriptions
   and delivery messages. The promise made at purchase — not the app's
   marketing — defines the obligation.
3. **Stop new sales only when the replacement plan is approved.** Do not
   pull any product down before the free replacement and the customer
   communication are ready; do not sell new Pro access once the free plan
   is approved and dated.
4. **Prepare direct customer communication.** A short personal message from
   Shawn to every identified payer, sent before the gate is removed
   publicly: what's changing, when, and what they get.
5. **Choose the compensation treatment** (OWNER TO APPROVE; options, not
   recommendations-by-default):
   - refund of recent charges (Stan-side),
   - pro-rated credit toward any paid product,
   - grandfather benefit (e.g., a bonus product, the 4-book bundle, or a
     coach-call discount as a thank-you),
   - simple cancel + thank-you where the amounts are trivial,
   - any combination per cohort.
6. **Cancel remaining recurring billing** on or before the day the gate is
   removed. Nobody may be billed for a period in which the feature was free.
7. **Record the outcome** in `decision-log.md` (counts, treatment chosen,
   date executed) before the gate-removal PR merges.

## Gate-removal sequencing (future PR, not PR 1)

The gate is removed on the **platform** version by never building it (the
new tools launch free). The **legacy** app's gate is left as-is until
Phase 3 of `migration-and-redirects.md`; removing it there is optional and
only after steps 1–7 complete — an unlocked legacy app with paying
subscribers still billing is exactly the situation this checklist exists to
prevent.

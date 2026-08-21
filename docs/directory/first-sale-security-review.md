# Security and integrity review — the first-sale path

Reviewed against `main` at `dc08202` plus the changes on
`claude/first-customer-prep`. Every claim below names the evidence: a test that
would fail, a browser check that ran, or a query that was executed.

---

## 1. Anonymous users cannot reach admin placement tools

**Verified, in a real browser.** `scripts/e2e-directory-revenue.mjs` loads
`/admin/directory/placements`, `/admin/sponsors`, `/admin/directory/sponsors`
and `/admin/directory` with no session. All four redirect to `/admin/login`, and
the body of the resulting page is asserted not to contain `Paid placements` —
so no admin markup is rendered before the bounce.

Two walls: `requireAdmin()` in the `(dashboard)` layout gates every page in the
group before any child renders or fetches, and each of these pages calls it
again itself. The gate fails closed — `adminConfigured()` returns false unless
both `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are set, asserted in
`test-placements`.

## 2. Forged sessions are rejected

**Verified, in a real browser.** A context carrying `tlws_admin` set to 64 `f`
characters is redirected to the login page. A context carrying the genuine HMAC
(`createHmac('sha256', secret).update('tlws-admin-session-v1')`) reaches the
console. The comparison is constant-time (`timingSafeEqual`).

The password path is exercised separately: a wrong password produces
`?error=1` / "Incorrect password", the correct one does not.

## 3. Held brands and unpublished listings cannot be activated

**Verified by test, at the layer that matters.** `promotionBlockers` refuses
Love's, Pilot, Flying J, Sapp Bros, Goasis and Thorntons (case- and
spacing-tolerant), plus any unpublished, deleted or uncategorised listing.
`canActivateFeatured` refuses a held brand **even when capacity is free**.

Crucially this is enforced in `activateFeaturedAction` against a **freshly
loaded row**, not against whatever the form said — so a tampered `listing_id`
still hits the check with the real record.

## 4. Blank corridor targeting is rejected

**Verified by test.** `canActivateCorridorSponsor` refuses an empty corridor
with an explicit reason ("would target every corridor page"), refuses a non-
interstate like `US-1`, and refuses a non-http(s) link. Separately,
`corridorSponsorConflicts` **detects existing rows with blank targeting** as
conflicts on every corridor — that is the case that silently double-sells a
page, and the console labels those rows `EVERY CORRIDOR — check this`.

## 5. Capacity guards behave as documented

**Verified by test, and the documentation is honest about the limit.** A
listing appears on both its category page and its corridor page, and both must
have room — a full corridor blocks the sale even when the category is empty.
Unpublished and deleted featured rows do not occupy a slot. A listing being
re-activated does not count against itself.

The guard is **check-then-act, not a database invariant**. Two administrators
activating the same page in the same second could still overrun it. That is
accepted for the single-admin pilot, is printed on the console itself, and needs
a partial unique index — a migration — before a second person uses it.

## 6. Featured activation requires an end date

**Verified by test and in the browser.** `activateFeaturedAction` refuses
without `ends_on` ("a featured listing cannot expire by itself"), and refuses
without a typed `ACTIVATE`. The console's activation checklist puts *payment has
cleared* first and *calendar reminder created* before submission.

New in this change: the console reads the term back out of the CRM note and
shows a **Terms on record** panel, with a red banner naming any placement past
its end date. That converts the accepted manual-expiry risk from "hope somebody
remembers" into "the console says so on load".

## 7. User-controlled inquiry context is escaped

**Verified in a real browser.** A query string carrying
`"><script>alert(1)</script>`, an `onerror` image, a `javascript:` corridor and
a bogus state fires no dialog, injects no script tag, preselects nothing, and
the bad state does not appear in the page.

Defence is at the boundary, not in the template: `boundToken` collapses anything
non-alphanumeric to a hyphen and caps the length, `boundState` accepts only two
letters, `boundCorridor` only `I-<digits>`. The inbox parser is equally strict —
a hostile listing path (`../../admin`, `https://evil.example`,
`javascript:alert(1)`) yields **no link at all** rather than a bad one, and the
parsed path is asserted to always match `^/directory/location/[a-z0-9-]+$`.

## 8. No secrets or private prospect data in Git

**Verified by scanning the tracked tree.**

- No private key blocks, `sk_live`/`pk_live` keys, or JWT-shaped strings in any
  tracked file.
- The only tracked `.env*` file is `.env.example`.
- `data/revenue-readiness/local/` is gitignored; the contacts file is confirmed
  ignored by `git check-ignore`.
- No phone-shaped string appears in any file this workload committed.
- Netlify's own secret scan of the production deploy: **1,062 files, 0 matches.**
- The e2e run's throwaway `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` are random
  per run, never printed and never written to disk.

**One pre-existing observation, not introduced here:** 
`docs/directory/loves-420-florence-correction-audit.md` (from PR #177) contains
published TA/Petro switchboard numbers as part of a geocoding audit trail. They
are corporate travel-center numbers already public on those chains' own sites
and on our directory, not personal contact data, and not part of any prospect
list. Flagging it for completeness rather than acting on it — removing it is a
separate decision about that older record.

## 9. No database writes occurred during development

**Verified by digest, three times across the workload.**

| Checkpoint | `locations` digest |
| --- | --- |
| Before merging #190 | `911773b876a3a93897401406a14616e2` |
| After merging #190 | `911773b876a3a93897401406a14616e2` |
| After merging #191 | `911773b876a3a93897401406a14616e2` |

`locations` 1,556 rows, `is_featured` **0**, last `updated_at`
2026-07-26 14:46:53 UTC (PR #187's publication run, before any of this).
`sponsors` 0, `sponsor_touches` 0, `directory_sponsors` 0,
`location_submissions` 0.

No migration was added or applied — `git diff origin/main -- supabase/` is
empty. No placement was activated, no claim approved, no listing modified.

---

## Residual risks, ranked

| Risk | Severity for the pilot | Mitigation today | Real fix |
| --- | --- | --- | --- |
| Featured listing runs past its term | **Medium** — gives away inventory and blocks the next sale | required end date + Terms on record panel + red overdue banner + checklist | `locations.featured_until` (migration) |
| Two admins overrun capacity | Low while there is one admin | console states it; check-then-act on live data | partial unique index (migration) |
| Activation without payment | Medium — procedural only | checklist puts cleared payment first; reviewer name recorded | nothing short of a payment integration |
| A term is never recorded | Low | only happens if activated without a CRM row id; the panel shows what *is* recorded and the checklist asks for the id | a column on `locations` |
| `is_featured` conflates paid and editorial | Low today (0 featured, and it is paid-only by decision) | decision recorded; every surface says Sponsored | a second column (migration) |

None of these blocks the first sale. The first one is the one to watch, and it
is now visible rather than silent.

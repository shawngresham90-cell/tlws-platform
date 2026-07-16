# CDL Pre-School Integration — Source Audit

> **Price update (2026-07-16):** the Founding Student price is now **$199** (changed from $149 in `src/lib/preschool/constants.ts`, the single source of truth). The $149 figures below are historical — they describe the offer as it stood when this audit was written.

Milestone: Integrate CDL Pre-School Into Trucking Life With Shawn
Branch: `feat/cdl-preschool-sales-integration` (PR #49)
Date: 2026-07-13 (updated same day after the source repository was attached)

## 1. Sources, in order of authority

1. **`shawngresham90-cell/cdl-preschool` @ `f6a004c`** — the course source
   repository, attached read-only with owner approval. This commit is
   byte-identical to the live Netlify production deploy, so the audit reflects
   exactly what runs today. The repository was not modified.
2. **The portal's production course tables** (its own separate Supabase
   project, read-only queries against `modules`/`lessons` metadata only) — the
   repo's seed file contains placeholder titles; the real module titles and
   lesson counts live in the portal database and were read from there.
3. **The owner's integration brief** — offer terms, homepage copy, CTA labels,
   disclaimers, FAQ list.
4. **tlws-platform's own published copy** — `/apps` blurb, Academy credibility
   facts.

Earlier note, kept for the record: the *rendered* site and Stan Store are
egress-blocked (HTTP 403) from this environment and were never fetched; the
repository + database made that irrelevant.

## 2. What the old site actually is — a student portal, not a marketing site

`app/page.tsx` redirects `/` straight to `/dashboard`, which sits behind
Supabase email/password auth (middleware-protected). There are **no public
marketing pages, no testimonials, no refund policy, no legal pages** on the
old site — it is the paid course itself:

- `/login` (public) — the only public surface. Its sole marketing line points
  un-enrolled visitors to the owner's Stan Store.
- `/dashboard` — 7 module cards with locked/unlocked/passed states.
- `/module/[id]`, `/lesson/[id]` — lesson player (unlisted-video embed, notes,
  workbook download, mark-complete), sequential unlocks.
- `/quiz/[moduleId]` — module quiz, 80% pass gate.
- `/certificate` + `/verify/[certNumber]` — completion certificate with a
  public verification page.
- `/admin` — owner-only student enrollment.

**Consequence:** the PR #49 sales page is the product's first public sales
page, and (see §7) the old site must stay up — it IS the course.

## 3. Verified curriculum (from the production course tables)

**7 modules · 33 lessons · a workbook on all 33 lessons · quiz per module,
80% to pass · sequential unlocks · certificate with public verification.**

| # | Module | Lessons |
| - | --- | - |
| 1 | Before You Ever Touch a Truck | 5 |
| 2 | Choosing the Right CDL School (Not a Mill) | 5 |
| 3 | Crushing the Permit Tests | 5 |
| 4 | The Pre-Trip That Passes Every Time | 5 |
| 5 | Backing, Turning & Truck Control | 5 |
| 6 | On the Road Without the Panic | 4 |
| 7 | Land the Job & Keep It | 4 |

Module one-liners on the sales page are the course's own module descriptions,
lightly paraphrased. The repo also ships 7 per-module cheat-sheet PDFs
(`public/workbooks/module-{1..7}-cheat-sheet.pdf`).

**Video status (owner decision needed):** lessons in Modules 1–3 have videos
attached in the database; Modules 4–7 do not yet (15 of 33 lessons have
video). The sales page therefore does **not** advertise "video lessons" —
it claims lessons + workbooks + quizzes only, all fully true today. Once the
remaining videos are uploaded, the copy can safely add them.

## 4. Verified buyer-access workflow

1. Buyer purchases on Stan Store (external checkout — unchanged).
2. **Stan Store does NOT redirect or provision automatically.** There is no
   Stan Store integration anywhere in the course source.
3. The owner manually enrolls the student in `/admin` (name + email). This
   creates the account with a generated temporary password and sends a
   welcome email (Resend) with the login details; if email isn't configured,
   the temp password is shown to the owner to deliver directly.
4. Access is **account-based** (email + password, Supabase auth). Self-paced,
   phone-friendly, progress saved automatically.

The sales-page access FAQ now states exactly this (issued personally, not
instant) and deliberately does not name the portal URL. Not claimed anywhere:
instant access, lifetime access.

## 5. Refund policy, testimonials, disclaimers — findings

- **Refund policy: none exists** anywhere in the course source. Per the
  content rules the refund FAQ was **removed** from the sales page rather
  than answered with an invented policy. The owner should write one; it can
  be added to the page and to Stan Store in minutes once decided.
- **Testimonials: none exist** in the source. None are shown.
- **Legal disclaimers: none exist** on the old site. The sales page keeps the
  owner-supplied "what it is not" disclaimers (no license, no ELDT
  substitute, no employment/exam/admission guarantees).

## 6. Privacy — what was deliberately NOT published

- The portal URL and any course/lesson/quiz URLs.
- The temporary-password format, welcome-email internals, sender mechanics.
- Unlisted video IDs, certificate-number format, admin route or workflow
  details, any student data (none was read — only `modules`/`lessons`
  metadata was queried).
- Paid lesson content: only module titles + one-line descriptions are
  summarized publicly; no lesson bodies, notes, or workbook contents.

## 7. Content migrated vs. omitted

**Migrated:** the verified curriculum summary (§3), the what's-included list,
the access workflow (§4), offer terms ($149 / 20 spots / wall), the /apps
benefit framing, Academy credibility facts.

**Omitted:** everything that doesn't exist to migrate (testimonials, refund
wording, legal pages) and everything private (§6).

**No longer unresolved:** module names/counts, workbooks, access flow — all
verified. **Still owner-decided:** refund policy wording; whether/when to
advertise videos (§3); the transition timing in
`docs/cdl-preschool-transition-plan.md`.

## 8. External dependencies

- **Stan Store** — checkout only; enrollment is manual by design.
- **The portal's own stack** (separate Supabase project + Resend) — untouched
  by this PR; the platform never connects to it at runtime.
- **Cloudflare Turnstile / platform Supabase** — claim-form intake (PR #49,
  migration 028, NOT applied).

## 9. Old-site plan (summary — full plan in the transition doc)

The old Netlify site is the live course portal, so **it must not be redirected
or shut down** — students would lose access. Recommendation: keep it running
as the portal; the marketing role it never had now lives at
`/cdl-pre-school`. Optionally move the portal to a branded subdomain later.
No change to the old site was made.

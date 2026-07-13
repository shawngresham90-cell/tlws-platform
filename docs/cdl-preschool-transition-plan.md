# CDL Pre-School — Old-Site Transition Plan

Scope: what to do with **https://cdl-preschool.netlify.app** now that the
integrated `/cdl-pre-school` sales pages exist on truckinglifewithshawn.com.
**No change was made to the old Netlify project in this milestone.** Every
step below requires explicit owner approval.

## Verified reality (source repo audit, 2026-07-13)

The old site is **not a marketing site — it is the live student portal**:
`/` redirects to the login-gated `/dashboard`; the course (7 modules /
33 lessons, quizzes, workbooks, certificates) is served from it, backed by its
own Supabase project. Enrolled students log in there with email + password.

**Therefore the original Option A (blanket 301 to `/cdl-pre-school`) is
ruled out** — it would lock every enrolled student out of the course they
paid for. The precondition flagged in the first version of this plan is now
answered definitively.

## Recommended plan

1. **Keep the portal exactly as it is.** It has a job — delivering the paid
   course — and nothing about PR #49 changes that. The marketing role the old
   site never had (its `/` was a redirect to login) now lives at
   `/cdl-pre-school` on the main platform.
2. **Point all future marketing at the platform page.** The Stan Store product
   description and any social bios that mention the old URL should link
   `https://truckinglifewithshawn.com/cdl-pre-school` instead. (Owner action;
   nothing to deploy.)
3. **Optional, later — branded portal subdomain.** Add a custom domain like
   `portal.truckinglifewithshawn.com` (or `preschool.…`) to the existing
   Netlify project so the welcome email and login URL carry the brand. This is
   a DNS + Netlify-domain change only; the netlify.app URL keeps working
   alongside it, so nothing breaks for existing students.
4. **Optional, later — one small courtesy redirect on the portal.** If
   logged-out visitors ever land on the portal root, its `/` → `/dashboard` →
   `/login` flow already shows the Stan Store pointer. If the owner wants
   them to see the sales page instead, a single change on the portal (send
   unauthenticated `/` to the sales page, leave `/login` and everything else
   untouched) does it safely. This is a change to the `cdl-preschool` repo —
   out of scope here, listed for completeness.

## Explicitly rejected

- **Blanket 301 of the old site** — breaks student access (see above).
- **Replacing the old site with a migration notice** — same problem.
- **Shutting down or deleting the Netlify project or repo** — it is the
  product.

## Explicitly out of scope in this milestone

- No DNS, redirect, deploy, or repo change to the old site or portal.
- No change to the portal's Supabase project (only read-only course-metadata
  queries were made for the audit).

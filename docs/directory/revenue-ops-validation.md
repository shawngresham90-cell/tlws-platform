# Revenue operations milestone — validation record

Run date: 2026-07-26. Branch `claude/directory-revenue-ops`, on top of `main` at
`17fcfa0` (PR #190 merged).

## Merge of PR #190 (Phase 1)

| Step | Result |
| --- | --- |
| Head unchanged since Shawn's approval | `0b3ee4d4fcf151b81b198ef60f45c2e2cf10b46f` |
| Mergeable state | `clean` — no conflicts against `main` |
| Checks before merge | `verify` success, Netlify header + redirect rules success |
| Migration in the diff | none (`git diff origin/main...HEAD -- supabase/` empty) |
| Payment integration / new vendor / new dependency | none (`package.json`, `package-lock.json` unchanged) |
| Approval recorded | PR comment + squash-merge commit body |
| Merge | squashed to `main` as `17fcfa0` |
| CI on `main` | **success** — format, lint, typecheck, harnesses, build, drift |
| Netlify production deploy | `6a666c04b3f1430008d27d51`, context `production`, state **ready**, published 20:22:40 UTC |
| Netlify secret scan | 1051 files scanned, **0 matches** |
| Database write by the merge | none — digest identical before and after |

Read-only production checks were done through the Netlify deploy API and
read-only Supabase queries. The production domain and `*.netlify.app` are
blocked by this environment's egress policy; that was **not** bypassed, and no
claim is made about the live HTML beyond what the deploy API reports.

## Checks run (Phase 9)

| Check | Command | Result |
| --- | --- | --- |
| Format | `npx prettier --check` (src, scripts, docs, data md) | pass |
| Lint | `npx next lint --max-warnings=0` | pass, 0 warnings |
| Types | `npx tsc --noEmit` | pass |
| All offline harnesses | `node scripts/run-tests.mjs` | **68/68 pass** |
| Production build | `npm run build` | pass, 0 errors, 0 warnings |
| Generated-file drift | clean rebuild, then `git status` | no tracked file changed |
| Browser e2e | `node scripts/e2e-directory-revenue.mjs` | **122/122 pass** |

Harness changes this milestone:

| Harness | Assertions |
| --- | --- |
| `test-placements` | 138 (new) |
| `test-directory-inquiry` | 73 (was 62) |
| `test-directory-funnel` | 85 |
| `test-directory-offers` | 76 |

## What the browser run covers

Against a real `next start` production build, headless Chromium:

- **Accessibility** — axe-core on `/sponsors`, `/sponsors` with listing context,
  `/directory`, `/directory/tire-repair`, the listing funnel, **the placements
  console and the sponsor inbox**, at 390×844 and 1280×900. **Zero serious or
  critical violations** everywhere.
- **Authorization** — four admin routes redirect an anonymous visitor to
  `/admin/login` and leak no markup first; a wrong password is rejected and the
  correct one is not; a valid session reaches the placements console; a forged
  session cookie is rejected.
- **Mobile overflow** — no horizontal scroll on any page at 390px, admin
  included.
- **Keyboard** — the inquiry form's seven controls and the corridor activation
  form's eight controls are all reachable by Tab, in visual order.
- **Pricing integrity** — every dollar figure rendered on a public surface and
  on the placements console is one of the six approved values.
- **Disclosure** — the console states that paid placement is labelled Sponsored,
  that it takes no payment, that capacity is not a database constraint, and that
  a typed confirmation is required.
- **Injection, form failure and retry, analytics-failure tolerance, internal
  links** — as before, all passing.

### Two environment limits, stated rather than worked around

1. **No route to Supabase.** Directory detail pages 404 locally and the
   hub/category/admin pages render their empty state. The listing funnel is
   therefore audited from its own server-rendered markup with the production
   stylesheet — same component, same CSS, real axe and real layout, but not a
   live data page. `/knowledge/dot-compliance` 404s for the same reason and is
   reported separately from the link check.
2. **The admin session cookie is `Secure`,** which a browser will not store over
   plain http. The e2e run therefore seeds the session cookie directly with the
   same HMAC the app itself issues, rather than logging in through the form. The
   password check is still exercised through the form, and a forged cookie is
   asserted to fail, so this is a transport limitation and not an auth bypass.
   The throwaway `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` used for the child
   server are random per run, never printed, and never written to disk.

## Database drift

No write of any kind was made this milestone. Measured after all work:

| | |
| --- | --- |
| `locations` | 1556 rows, `is_featured` **0** |
| `locations` last `updated_at` | 2026-07-26 14:46:53 UTC (PR #187's publication run) |
| `locations` row digest | `911773b876a3a93897401406a14616e2` — identical before the merge, after the merge, and after all development |
| `sponsors` | 0 |
| `sponsor_touches` | 0 |
| `directory_sponsors` | 0 |

`git diff origin/main...HEAD -- supabase/` is empty. No migration was added and
none was applied.

## Confirmations

- No payment was taken, and no payment integration exists in the codebase.
- No outreach was sent — no email, call, DM, or form submission.
- No social post was published or scheduled.
- No claim was approved and no sponsored placement was activated. Both counts
  are zero.
- No contact detail was committed. `data/revenue-readiness/local/` is
  gitignored; the committed prospect CSV records `on listing` / `to source`
  only.
- No new vendor, connector, paid service, or dependency.
- No secret was printed, logged, or committed. Netlify's own secret scan of the
  production deploy found nothing.
- Plausible remains disabled. `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is still unset in
  Netlify, no account was created, and no charge was incurred.

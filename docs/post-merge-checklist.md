# Post-Merge Checklist

Run after merging any of the open PRs to production.

## Immediately after merge

- [ ] Netlify production deploy goes green (watch the deploy log).
- [ ] Open the homepage — hard refresh; check the favicon appears and the
      nav works (desktop + phone).
- [ ] Click through: Trip Planner, Directory, Books, Sponsors, a Knowledge
      article — no 404s, no layout breakage.
- [ ] Old URLs still land somewhere sensible: `/dot-guide`, `/contact`,
      `/videos`, `/directory/trip-planner` (all redirect).

## Forms (2 minutes)

- [ ] Newsletter: submit a real test email → success state → shows in
      `/admin/leads`.
- [ ] Sponsor inquiry: submit a test row (company "TEST — ignore") →
      shows in `/admin/sponsors` → delete/mark it dead in the CRM.

## After the analytics env var is set

- [ ] Plausible Realtime registers your visit.
- [ ] `window.plausible` exists in the browser console on production —
      and does NOT exist on deploy previews (variable is scoped to
      production).

## If something is wrong

- Netlify → Deploys → "Publish deploy" on the previous green deploy rolls
  production back in one click; nothing in these PRs touches the database,
  so rollback is safe and total.

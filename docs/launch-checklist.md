# Launch Checklist

Everything between today's state and "fully switched on", in order. Items
marked **(owner)** need your account or your click; everything else is
already built and waiting.

## 1. Merge the open work (owner)

- [ ] Merge PR #161 (platform activation) — analytics loader, nav fixes,
      newsletter capture, OG/favicon, a11y/perf, `/sponsors`.
- [ ] Merge PR #159 (books catalog + affiliate compliance).
- [ ] Merge the launch-readiness PR (this branch).
- [ ] Follow `post-merge-checklist.md` after each merge.

## 2. Analytics (owner, ~15 min)

- [ ] Create the free plausible.io site for `truckinglifewithshawn.com`.
- [ ] Netlify → env var `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=truckinglifewithshawn.com` → redeploy.
- [ ] Mark the six goals listed in `analytics-setup.md`.

## 3. Directory data (owner, ~10 min)

- [ ] Census approval session: apply the 713 pre-approved coordinates
      (`directory-census-approval-runbook.md`) — coverage 6.8% → ~63%.
- [ ] The 32 held rows + 2 Knoxville weigh stations: later, at leisure.

## 4. Monetization switches (owner)

- [ ] Apply migration `024_directory_sponsors.sql` so sponsor slots can
      serve (they render nothing until then).
- [ ] First featured listing / sponsor row when a deal lands
      (`directory-monetization-guide.md`).

## 5. Content & channel (owner)

- [ ] Add `/go/...` short links to video descriptions
      (`youtube-funnel-guide.md`).
- [ ] Supply the Defensive Driving cover when ready (only missing book
      asset).
- [ ] Decide THE ROAD AHEAD merge timing (PR #160, feature-complete,
      parked at your request).

## 6. Verify (10 minutes, after the above)

- [ ] Visit the site → Plausible Realtime shows your visit.
- [ ] Submit the newsletter form with a test email → appears in
      `/admin/leads` under "Drivers — general newsletter".
- [ ] Submit a sponsor inquiry → appears in `/admin/sponsors` with your
      message.
- [ ] Share the homepage in a messenger → branded social card renders.
- [ ] Search "site:truckinglifewithshawn.com" after a few days — sitemap
      now covers all top-level surfaces.

## Explicitly not required for launch

- Email sending (infrastructure is ready; no provider is wired by design).
- Store/affiliate work (separate workstream).
- The remaining directory coordinate coverage beyond the Census batch.

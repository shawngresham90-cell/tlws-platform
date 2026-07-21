# Sponsor Program — Owner Guide

How the sponsor pipeline works end-to-end and how to run it day to day.

## The pipeline

1. **Front door:** `/sponsors` — three partnership paths, the placement
   inventory, an FAQ, and the inquiry form. "Get featured" links across the
   directory (hub, state pages, corridor pages, parking pages, listing
   detail pages) deep-link here with the interest preselected.
2. **Inquiry:** the form posts to `/api/sponsor-inquiry` (Turnstile
   protected, rate limited). Each inquiry inserts a prospect into the
   `sponsors` table at stage `contacted` and logs an inbound touch in
   `sponsor_touches`.
3. **CRM:** `/admin/sponsors` — every inquiry with company, contact, phone,
   email, package interest (including which directory surface sent them,
   e.g. `directory-placement (I-75)`), their message, and a status
   dropdown you can advance as the conversation progresses.

## Turning on directory placements

Sponsor slots already render on five surfaces (hub, state, corridor,
listing detail, parking) and are **empty until you create a sponsor row**:

1. Apply migration `024_directory_sponsors.sql` (one-time; it is committed
   but not applied to production).
2. In `/admin/directory/sponsors`, create the sponsor: name, outbound URL,
   placements, optional state/interstate/category targeting, and an
   active date window.
3. The slot appears automatically wherever the targeting matches — clearly
   labeled "Sponsored", with `rel="sponsored"` on every link. Deactivate
   the row (or let the window lapse) to remove it.

## Featured listings

Every listing has an `is_featured` toggle in `/admin/directory` (edit
form). Featured listings sort first in browse results and carry a badge.
There is no self-serve payment — you flip the flag after the deal is done.

## Pricing

Nothing on the site publishes a rate. Every inquiry starts a conversation;
price placements however you like, per deal, and nothing needs a deploy.

## What to check weekly

- `/admin/sponsors` — new inquiries (status `contacted`).
- Reply personally; the site promises that.
- Advance statuses so the pipeline reflects reality.

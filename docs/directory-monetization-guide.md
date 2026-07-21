# Directory Monetization — Owner Guide

What the directory can sell today, with zero additional engineering.

## Inventory that exists right now

| Product | Where it shows | How to activate |
| --- | --- | --- |
| **Featured listing** | Badge + first position in browse results for its category | `/admin/directory` → edit listing → `is_featured` |
| **Corridor sponsorship** | Sponsor slot on `/directory/i-<n>` corridor pages (+ parking pages for that corridor) | `/admin/directory/sponsors` → placement `interstate`, target the corridor |
| **State sponsorship** | Sponsor slot on state pages + top-truck-stops pages | placement `state`, target the state |
| **Hub placement** | Sponsor slot on `/directory` | placement `directory-hub` |
| **Listing-detail placement** | Sponsor slot on individual location pages, targetable by state/corridor/category | placement `detail` |
| **Map sidebar** | Beside the interactive map | placement `map-sidebar` |

One-time prerequisite: apply migration `024_directory_sponsors.sql`
(committed, unapplied). Until then every slot renders nothing.

## How buyers find you

- "Get your business featured →" links sit next to every sponsor slot and
  on every listing page. They land on `/sponsors#inquire` with the interest
  preselected and the originating surface recorded (visible in
  `/admin/sponsors` as e.g. `directory-placement (parking-I-75)`).
- The `/sponsors` page explains the inventory honestly and prices nothing.

## Suggested sequence

1. Apply migration 024.
2. Land the first sponsor conversation from the inbound pipeline (or
   outreach to businesses already listed — every listing detail page shows
   the get-featured link to its owner).
3. Create their sponsor row with a date window; renewal = extend the
   window.
4. Featured listings are the lighter first sell for single locations;
   corridor sponsorship is the premium product once coverage on that
   corridor is strong.

## Rules the platform enforces for you

- Sponsored units are always labeled and never mixed into ranked results.
- Every sponsored link carries `rel="sponsored noopener noreferrer"`.
- Outbound sponsor URLs are validated (http/https with a real host).
- No payment is collected on-site; nothing is committed by the site copy.

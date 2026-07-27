# TA / Petro / TA Express — official access is blocked

**Status: BLOCKED at this environment's egress proxy. Not a credentials
problem.** No official TA data was obtained, and nothing was scraped.

Attempted 2026-07-27. Every host returned `connect_rejected` — the proxy
answered **403 to the CONNECT** before any TLS handshake, so no request ever
reached TA:

| Host attempted | Result |
|---|---|
| `https://www.ta-petro.com/locations` | 403 CONNECT — `connect_rejected` |
| `https://www.ta-petro.com` | 403 CONNECT — `connect_rejected` |
| `https://api.ta-petro.com` | 403 CONNECT — `connect_rejected` |
| `https://developer.ta-petro.com` | 403 CONNECT — `connect_rejected` |
| `https://www.ta-petro.com/sitemap.xml` | 403 CONNECT — `connect_rejected` |
| `https://www.ta-petro.com/robots.txt` | 403 CONNECT — `connect_rejected` |
| `https://tatravelcenters.com` | 403 CONNECT — `connect_rejected` |
| `https://www.tatravelcenters.com` | 403 CONNECT — `connect_rejected` |
| `https://roadsquad.com` | 403 CONNECT — `connect_rejected` |
| `https://ir.ta-petro.com` | 403 CONNECT — `connect_rejected` |

The denial is environment-wide, not TA-specific: `data.transportation.gov`,
`geocoding.geo.census.gov` and even `truckinglifewithshawn.com` return the same
403. **The policy was not bypassed and must not be.**

Because the CONNECT is refused before TLS, this run could not determine whether
TA publishes a developer API, whether an export requires credentials, or what
the terms are. Those questions are answerable only from an unblocked network.

---

## The exact official access path to try

In order, from cheapest to most involved. Each must be attempted from a normal
network, not from this build environment.

1. **Public location pages** — `https://www.ta-petro.com/locations`.
   Check for a "download locations", "all locations" or fleet-resources link,
   and check `/sitemap.xml` for a locations index.

2. **Developer / API portal.** Confirm whether `developer.ta-petro.com` or an
   equivalent exists and what it offers. If a public API exists, the location
   endpoint is the target; record the terms of use before any automated call.

3. **Fleet / business services contact.** TA sells to fleets, so a
   location-data request is a normal commercial ask rather than an unusual one.
   This is the most likely route to a complete, licensed, refreshable file.

4. **Investor-relations material** for store counts only — useful to
   **verify completeness** of whatever file arrives (the way Love's published
   count of 731 confirmed that export), never as a source of location rows.

## What to ask for

A single national export, one row per site, with:

`site_id` · `brand` (TA / Petro / TA Express — **kept distinct**) · `name` ·
`street` · `city` · `state` · `zip` · `latitude` · `longitude` ·
`truck_parking_spaces` · `showers` · `scales` · `status` (open / closed /
temporarily closed) · `last_updated`

Plus, in writing: **redistribution terms**, **update frequency**, and whether a
refresh can be pulled on a schedule.

`status` matters more here than for Love's, because the directory currently
holds **more** TA-network rows than the reference file lists — see
`2026-07-27/GAP-ANALYSIS.md`. Without a status column, closures are detectable
only as absence between two dated exports, which means every export must be
retained.

## What must not happen instead

- **No scraping of `ta-petro.com`.** A blocked download is not permission to
  crawl the site.
- **No AllStays.** It is registered `discovery_only` / `license_required`. Its
  listings, coordinates, parking counts, amenities and exclusive locations must
  not be copied, and its paid PDF must not be purchased for reuse. See
  `data/sources/allstays/`.
- **No promotion of `data/imports/locmaster20260725.xlsx`.** It is stale
  reference material with unknown provenance. It is profiled for shape and
  magnitude only, and **nothing in it is approved for import** — the accounting
  in `2026-07-27/REFERENCE-ACCOUNTING.csv` records 0 approved rows by
  construction.
- **No invented coordinates, space counts, amenities or names.**

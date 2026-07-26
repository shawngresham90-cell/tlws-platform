# Northeast MD/DE — second candidate manifest (read-only, UNEXECUTED)

Forward-looking preparation produced during the MD/DE geocode-and-publication
milestone. **Nothing here is geocoded, published, inserted, or written to the
database.** Every row is an **existing unpublished `csv-import` row** (no
net-new inserts are proposed). The three already-published MD TA rows and the
three held-network rows (Pilot #290, Flying J #784/#875) are excluded.

Machine-readable companion: `SECOND-CANDIDATE-MANIFEST.json`.

## Totals (live read-only, 2026-07-26)

- **42 candidate rows** — 32 MD, 10 DE.
- **Tier 1 (28):** carry a geocodable street address → the existing US Census
  batch pipeline can resolve them with a street-address match.
- **Tier 2 (14):** mile-marker / median-plaza / no-address rows → need a
  rooftop coordinate from an authoritative source before geocoding.

By category: cdl-schools 9 · cat-scales 6 · roadside-service 6 · parking 5 ·
tire-repair 4 · weigh-stations 4 · truck-washes 3 · truck-stops 3 ·
hotels-truck-parking 2.

## Preconditions before ANY of these publish (same guardrails as this milestone)

1. **Authoritative geocode** — operator master where the row matches exactly,
   else the Census pipeline on the full street address; two-source agreement
   < 500 m for `high` confidence. No inference/snippets/centroids.
2. **Category validation** — every row already carries a valid `category_slug`
   (all nine are in the DB CHECK constraint), but confirm the directory renders
   that category before publishing into it.
3. **Dedup / colocation** — the six `cat-scales` and several service rows are
   colocated with a truck stop at the same address (e.g. *CAT Scale at TA
   Baltimore* shares 5501 O'Donnell St with the now-published TA #216). They are
   distinct service listings, not duplicates, but must pass the colocation check
   (`src/lib/directory/colocation.ts`) so they group correctly.
4. **Guarded publish** — blank-only geocode write → `ROW_COUNT` guard →
   3-record canary → remaining, one state per transaction, coordinates required
   before `is_published`. Never touch held networks or `is_indexable`.

## Ranked next work (driver usefulness · I-95 coverage · row availability · confidence · geocode readiness · dedup risk · SEO · monetization)

1. **Resolve + publish the 3 deferred truck stops** — Maryland House Travel
   Plaza, Chesapeake House Travel Plaza (median plazas, MM82/MM97), Biden
   Welcome Center DE. Highest driver value (actual fuel/food/parking on I-95),
   but Tier 2: each needs a rooftop coordinate from an authoritative DOT/operator
   source (blocked by egress today). Do these first once a source is available.
2. **Tier-1 tire-repair + truck-washes (7)** — Boss Truck Shop Elkton, Maryland
   Truck Tire Services, TA Truck Service Elkton, STTC New Castle; Blue Beacon
   Elkton, VIP Quality Express Jessup, Craig's Mobile Steam DE. High driver
   utility on a breakdown, all street-addressed, low dedup risk, monetizable.
3. **Tier-1 cat-scales (6)** — colocated with published TA/held stops; strong
   SEO for "CAT scale near me" on I-95. Publish only after the colocation check;
   the three at held-network sites list the scale service (not the held stop),
   so confirm they don't resurface a held brand.
4. **Tier-1 cdl-schools (7 with addresses)** — steady search/monetization value;
   lower urgency than on-road services.
5. **Tier-1 hotels-truck-parking (2)** + **weigh-stations (3 street-addressed)**
   — useful, lower priority.
6. **Tier-2 remainder (parking / welcome centers / no-address towing)** — need
   rooftop coordinates or an address backfill first; defer.
7. **MA / ME / VT** — genuinely empty; net-new sourcing, still egress-blocked.
   Prepare from an authoritative operator/DOT file when one is reachable; never
   from search snippets or aggregators as sole evidence.

Nothing above is executed. Each tier remains a separate, explicitly-authorized
step.

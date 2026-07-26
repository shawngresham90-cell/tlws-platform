# Northeast MD/DE Tier-1 — quarantined / held (14 of 28)

Fourteen of the 28 Tier-1 candidates were **not** published — left entirely
unchanged (no coordinate, still unpublished). Quality over count: a quarantined
row is better than a low-confidence or misleading listing.

## Held — hotel with no authoritative truck-parking evidence (2)

| Name | UUID | Reason |
|---|---|---|
| Days Inn by Wyndham Perryville | `1c486059…` | Structured truck-parking fields all false/null; truck parking claimed only in free-text description (unverified) that also names a held network (Pilot). Priority #4 requires authoritative existing evidence. |
| Elkton Lodge | `588ee9e4…` | Same: structured parking false/null; description names a held network (Flying J). |

## Quarantined — held-network brand in the row name (3)

| Name | UUID | Reason |
|---|---|---|
| CAT Scale at Flying J Elkton | `7fa26b2f…` | Census Exact, but the listing name embeds a held network (Flying J); publishing would resurface a held brand in the directory. |
| CAT Scale at Flying J North East | `61a7d832…` | Same (Flying J). |
| CAT Scale at Pilot Perryville | `a2881397…` | Same (Pilot). |

## Quarantined — Census `Non_Exact` (medium confidence, below the high bar) (7)

| Name | UUID | Note |
|---|---|---|
| Smith & Solomon CDT - New Castle | `ed11b1c5…` | Non_Exact interpolation. |
| Craig's Mobile Steam Cleaning | `cc5eadd1…` | Non_Exact **and** street-name mismatch (input "Springdale Dr" matched "SPRINGLAKE DR"). |
| Biden Welcome Center Truck Parking | `cdeada8d…` | Non_Exact and zip mismatch (19713 → 19702). |
| Newark Toll Plaza CVE | `f637c363…` | Non_Exact. |
| Cecil College Truck Driver Training (CDL) | `4678d9cd…` | Non_Exact and ambiguous multi-location source address. |
| Prince George's CC CDL (Laurel) | `83264a37…` | Non_Exact. |
| I-95 Perryville Weigh Station (SB) | `ec267e71…` | Non_Exact. |

## Quarantined — Census `No_Match` (2)

| Name | UUID | Note |
|---|---|---|
| Harford Community College CDL | `a7a13453…` | No_Match. |
| I-95 Perryville Weigh Station (NB) | `7eb47ea3…` | No_Match. |

## How to resolve later

The `Non_Exact` and `No_Match` rows need a corrected/complete street address or
an authoritative rooftop coordinate, then re-run the same Exact-only gate. The
hotels need verified truck-parking evidence (structured fields, not free text).
The held-brand CAT scales stay excluded while the held-network policy stands —
a rename that drops the held brand from the listing name would be a separate,
explicitly-authorized decision. Nothing here was inferred or guessed.

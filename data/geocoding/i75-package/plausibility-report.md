# Plausibility report — proposed I-75 GA/TN candidates

Every candidate below RESOLVES to the I-75 corridor and was linearly
interpolated between two verified anchors bracketing its exit (rows whose
corridor normalizes elsewhere via concurrency are excluded and listed in the
rejected CSV). Confidence is capped at `medium` by design (≤10 mi anchor gap
→ medium; ≤30 mi → low); action is always `manual-review` — nothing can be
auto-applied.

| listing | exit | proposed | confidence | anchor gap (mi) | checks |
| --- | --- | --- | --- | --- | --- |
| Pathway Travel Plaza | 306 | 34.395318, -84.884490 | low | 14 | in-state bounds ✓ · corridor bounds ✓ |
| QuikTrip Travel Center #757 | 306 | 34.395318, -84.884490 | low | 14 | in-state bounds ✓ · corridor bounds ✓ |
| Big Foot Travel Center | 29 | 31.000556, -83.386482 | low | 23 | in-state bounds ✓ · corridor bounds ✓ |
| Kwik Fuel Center (Lee's Travel Center) | 122 | 36.165355, -84.077276 | low | 17 | in-state bounds ✓ · corridor bounds ✓ |

Interpolation refusals inside the calibrated corridors are listed in
`i75-ga-tn-rejected.csv` with per-row reasons (outside anchor range, anchor
gap too large, no exit number, etc.). The pipeline never extrapolates beyond
the anchored milepost range.

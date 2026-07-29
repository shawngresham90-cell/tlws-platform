# State-DOT evidence pass (2026-07-29) — search-level verification

Ceiling stated honestly: this environment's egress proxy blocks direct
fetches to state-DOT sites; evidence below comes from official-domain
WebSearch results (result snippets from the official pages themselves).
Rows whose decisive wording lives inside a blocked PDF are HELD. NTAD 2019
is treated as identity/geometry baseline only — never as proof a facility
is open in 2026.

## Canary states (facility-level, verified this pass)

| Facility (row id) | Official source (domain) | Vintage | Route/dir | Position | Truck spaces | Hours | Overnight | Open status | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| Guilford Welcome Center, VT (`ed44c220`) | informationcenter.vermont.gov (Guilford pages) | current | I-91 northbound | **MM 5.6 (official)**, before Exit 1 | not stated | building 7:00–19:00 | **unknown** (no truck-overnight wording) | open; ramp-work note needs click-through | high identity / med detail |
| Kennebunk Service Plaza NB, ME (`211b73ca`) | maineturnpike.com plaza page | current | I-95 (Maine Turnpike) northbound | **Mile 25 (official)** | not stated | fuel/C-store 24 h | **unknown** (24 h alone ≠ overnight confirmation) | open; SB twin has parking-installation project MM 25.5 | high / med |
| Smyrna Rest Area, DE (`f1ae4251`) | deldot.gov rest-areas page + DelDOT truck-parking flyer | flyer 2023–24, page current | US 13 (at DE-1 Exit 119 area) | held pending flyer click-through | listed as DelDOT truck-parking location; camera-monitored availability | 24 h | **unknown** (exact wording in blocked PDF) | open | high / med |
| Darien Service Plaza SB, CT (`a6570355`) | ctserviceplazas.com (official CT plaza operator) | current | I-95 southbound | between Exits 10 and 9 | not stated | **24/7** | **unknown** | open | high / med |
| Gold Run SRRA EB, CA (`bd40b5b6`) | Caltrans SRRA feature service + dot.ca.gov QuickMap | **status updated 2026-05-15** | I-80 eastbound | 0.5 mi west of Exit 144 | **7 truck** (+51 auto) — Caltrans official; resolves the 24-vs-7 conflict in favor of 7 | 24 h | **unknown** | **Open** | high / high |

AL Grand Bay (I-10 Welcome Center): remains an identity HOLD (unchanged
from the 2026-07-28 verification); no new evidence sought this pass.

## Not yet investigated this pass (honest accounting)
- AK / HI / DC: zero directory candidates; official dataset inventory was
  recorded in the merged NTAD coverage report — facility-level verification
  not performed this pass.
- I-95 / I-80 / I-90-94 / I-10 / I-15 corridor states beyond the five
  above: source registry to be built in the next authorized pass; the 46+33
  existing rest/welcome rows concentrate on I-95/I-40/I-75/I-65 and carry
  legacy csv-import provenance needing per-state DOT re-verification before
  any publication.

## Rules applied
Time limit ≠ prohibited · "open 24 hours" ≠ overnight confirmed · no counts
from imagery · exits never copied to mile_marker (the two official MM
values above are STATE-SOURCED mile markers, eligible for `mile_marker`
with `mile_marker_source='state-dot'` when execution is authorized) ·
state-DOT outranks NTAD 2019 · blocked official documents → HOLD, never
substituted with blogs/AllStays/snippet guesswork.

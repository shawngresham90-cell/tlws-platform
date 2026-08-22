# Navigator destination-first (NAV-ENTRY-2)

The implementation record for the milestone that made destination entry the
first thing a driver meets on the parked Navigator map.

Base: `b24725690815a5318c0f27c77eee6539aeb3a70f`
(`NAV-ENTRY-1: simplify Navigator to Start, Plan, and Settings (#354)`).

## The problem, measured

NAV-ENTRY-1 replaced the setup-heavy entry with three buttons and stopped
there deliberately. What it exposed is that tapping START DRIVING landed the
driver on a map that asked for a destination in a box they could not see.

Recorded in Chromium on a production build of main, with
`NEXT_PUBLIC_NAVIGATOR_ENABLED=true`, after tapping START DRIVING, with no
scrolling of any kind:

| Viewport | Input top | Input bottom | Height | **Painted** | Page height |
| --- | --- | --- | --- | --- | --- |
| 360x740 | 813 px | 877 px | 64 px | **0 px** | 5,213 px |
| 390x844 | 753 px | 817 px | 64 px | **0 px** | 5,005 px |
| 430x932 | 731 px | 795 px | 64 px | **0 px** | 4,753 px |
| 844x390 | 649 px | 713 px | 64 px | **0 px** | 3,751 px |
| 932x430 | 649 px | 713 px | 64 px | **0 px** | 3,751 px |
| 1280x800 | 649 px | 713 px | 64 px | **0 px** | 3,515 px |

The painted column is the finding. The destination input was not merely low
on the page — **none of it was on the screen at any required viewport.**

The cause, traced through the clip chain at 390x844:

- the parked map box was 286 px tall, starting at y=204;
- inside it, an absolutely positioned overlay held a
  `max-h-full overflow-y-auto` scroller;
- inside that, a card 700 px tall: the plan-your-stops prompt (270 px), the
  road-test arm, then the destination search, then the border toggle;
- so the input sat **541 px below the visible top of a 286 px box**, reachable
  only by scrolling *inside the map* — a gesture nothing on the screen
  suggested, and one that competes with panning the map underneath it.

The existing `navigator-fullmap` bench had been failing exactly eight checks
on main for this, all of them `parked: search sits at the top of the map`,
measured at 935 / 813 / 753 / 731 / 649 / 649 / 649 / 649 px. The 935 px
figure is the 320x568 case; that bench runs eight viewport cases, of which
six are this milestone's required set.

## After

Same build settings, same journey, same measurement:

| Viewport | Input top | Bottom | Height | Painted | Fully visible | Delta vs before | Map visible |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 360x740 | 146 px | 210 px | 64 px | 64 px | yes | **−667 px** | 279 px tall, 33.3% |
| 390x844 | 146 px | 210 px | 64 px | 64 px | yes | **−607 px** | 319 px tall, 33.7% |
| 430x932 | 146 px | 210 px | 64 px | 64 px | yes | **−585 px** | 352 px tall, 34.1% |
| 844x390 | 146 px | 210 px | 64 px | 64 px | yes | **−503 px** | 148 px tall, 11.8% |
| 932x430 | 146 px | 210 px | 64 px | 64 px | yes | **−503 px** | 161 px tall, 16.4% |
| 1280x800 | 146 px | 210 px | 64 px | 64 px | yes | **−503 px** | 302 px tall, 19.8% |

At every viewport the input is inside the initial viewport, entirely painted,
above the site's fixed mobile tool bar, with nothing hit-testing on top of it,
in the **top half** of the screen, and the page opens unscrolled.

The touch target is **64 px** — the Navigator's own blueprint floor, not the
44 px accessibility minimum. Nothing was shrunk to reach the target.

### The landscape trade-off, stated plainly

At 844x390 and 932x430 the map is 148-161 px tall and only its top 58-71 px
is above the fold; the rest is one short scroll away. That is the honest cost
of a 390 px-tall viewport that must hold a 65 px site header, a destination
box and a map. Portrait phones — where a driver parked at a truck stop
actually holds the phone — keep a third of the screen as live map. No control
is clipped and no assertion was relaxed to make this pass.

## The parked hierarchy

What a driver meets, top to bottom, on `/drive/navigate` with no active route:

1. **Destination search** — label, 64 px input, status line, results, then the
   deliberate cross-border toggle
2. **Map** — `38dvh` with a 200 px floor (150 px on screens under 480 px tall)
3. **Route/start controls** — the chosen destination, Start, the truck summary
   line, the Settings link
4. Plan-your-stops prompt and the road-test arm
5. Motion status
6. Basemap picker
7. HOS clocks and the trip controls row

Encoded as data in `src/lib/navigator/destination-first.ts` (`PARKED_HIERARCHY`)
so it can be asserted rather than described.

## The active-navigation hierarchy — unchanged

Once guidance is live the surface is untouched by this milestone: maneuver
card first, full-bleed map behind everything, off-route line, status, trip
strip, compact HOS, control row on the bottom edge. Measured map coverage
during guidance is **100% of the viewport at all eight `navigator-fullmap`
cases**, exactly as before.

Three invariants that make that true rather than merely intended:

- there is still exactly **one** `{mapSlot}` mount point;
- the element order is identical in both modes and only classes change, so
  React never unmounts the map to reposition UI — **no map remount**;
- the parked search slot renders `null` during guidance, holding its child
  position so the map's index in the child list never moves.

## What changed, and why each

| Change | Reason |
| --- | --- |
| Search hoisted out of the map overlay to a sibling **before** the map | The overlay was the clipping mechanism. Nothing overlays it now, so nothing must pass touches through; nothing above it scrolls, so nothing can clip it. |
| Plan-your-stops prompt and road-test arm moved **after** the map | They were 541 px of material above the destination box. Both render on exactly the conditions they always did. |
| Maneuver card suppressed when parked with nothing to say | It read "No maneuver to show" in a 50 px box directly above the search. It always renders during guidance, and "You have arrived" still renders parked. |
| Route-progress list appears only once a route exists | Parked it was three rows of "—" between the map and Start. |
| Start controls ordered ahead of the supporting blocks (parked only) | The DOM order was written for the driving surface. `order-*` on the parked branch only; the DOM is identical in both modes. |
| `Section`'s `py-16 sm:py-24` replaced with a tight wrapper | 64-96 px of marketing padding above a driving surface, plus a redundant nested `Container`. |
| Parked map box `h-72 sm:h-96` → `h-[38dvh]` with floors | `sm` is a WIDTH query, so the two landscape phone shapes were handed the tallest map (384 px) on the shortest screen (390 px). |
| Loading placeholder updated to match the new box | The placeholder and the mounted box are one invariant; letting them drift reintroduces a layout jump when the map chunk lands. |

## Route-spend boundary

Unchanged by this milestone, and now covered by regression tests. Route
requests and destination-search requests are counted separately at every
stage; conflating them is how a search contract gets used to excuse a route
contract.

| Action | Route requests | Search requests |
| --- | --- | --- |
| Open `/drive` | **0** | 0 |
| Tap START DRIVING, open `/drive/navigate` | **0** | 0 |
| Focus the destination field | **0** | 0 |
| Type a query | **0** | ≥1 after the 350 ms debounce, past `MIN_SEARCH_LENGTH` |
| Select a result | **0** | 0 (the pick cancels in-flight work) |
| Open Settings | **0** | 0 |
| Open Plan My Trip | **0** | 0 |
| One deliberate Start on a valid destination | **exactly 1** | 0 |
| Return from Settings during an active trip | **0** | 0 |

The last row is the one that costs money if it breaks: the trip is restored
from its `sessionStorage` snapshot through the lifecycle's own `plan()` with
the payload pre-armed, so the provider is never asked twice for the same trip.
Verified in the browser: route count before and after the round trip is
identical, and the driving surface is still on screen afterwards.

## Search and provider behaviour

No change. Same `DestinationSearch` component, same
`/api/navigator/destination-search` endpoint, same search coordinator, same
350 ms debounce, same `MIN_SEARCH_LENGTH` gate, same result cards, same
cancellation on pick, same failure handling ("Search unavailable right now."
is not "no places found"). **No autocomplete was added** and no provider call
was introduced to make the UI feel faster. There is still exactly one search
implementation — asserted by count, after a mutation proved that an ordering
check alone would not have noticed a second one.

## Truck-profile behaviour

- Fresh device: seeded with the shipped standard truck, 13 ft 6 in (13.5 ft)
  and 80,000 lb, already confirmed. No confirmation is required before the
  search may be used.
- Returning driver: a valid saved custom profile is kept, read back through
  the shipped versioned storage, and comes back **confirmed** — the stored
  fingerprint still matches, so nothing re-asks.
- The parked map shows the truck as one summary line plus a Settings link. No
  editor, no confirmation gate, no setup wall.

## Motion behaviour

Unchanged from NAV-ENTRY-1's owner decision: **motion never disables editing.**
Every editing action in `ACTION_PERMISSIONS` remains `true`. The three
stationary-only actions are camera actions — pan, route overview, basemap
switch — which the owner's road test split out deliberately and which this
milestone does not touch.

Verified in a real browser rather than asserted: the geolocation is walked
north at ~65 mph for longer than the 10 s `MOVING_DWELL_MS`, the motion status
line is confirmed to read **"Moving"**, and only then is the destination field
checked. It is present and not disabled. An earlier draft of that bench ran
for 4 s, never left `UNKNOWN`, and would have passed without testing anything —
so reaching the MOVING state is itself an assertion now.

Passenger Access, the passenger declaration, hold-to-unlock, the countdown and
the override state all remain absent — checked by source-level absence tests
over the files this milestone touched, and by a browser check that the word
"passenger" appears nowhere on the rendered surface.

## Known pre-existing issues, left untouched

- **Shared site-header mobile-nav overflow at 200% text zoom.** Baselined
  against main in a separate worktree at the same commit. `/drive`,
  `/drive/navigate` and the site homepage `/` all overflow by **46 px at
  390x844 on main**, and by **46 px on this branch** — identical. The offender
  is `nav.absolute right-0 top-12 …` inside the shared `<header>`, present on
  every page of the site. `/drive/settings` is 150 px on both. NAV-ENTRY-2
  neither caused nor fixed this, and no site-header change is in scope.
- **One ESLint warning on main**, `NavigatorSettings.tsx:165` —
  `react-hooks/exhaustive-deps` missing dependency `notifySaved`. Present at
  `b247256` before this branch; CI's `npm run lint` exits 0 because warnings
  do not fail it. Not absorbed into this milestone.
- **`trip-planner-waypoint-handoff` assertion 7h had been passing on comment
  proximity.** It read `/edit-destination[\s\S]{0,1200}<TripPlanFirst/` and its
  name claimed a lock gate. NAV-ENTRY-1 removed that gate; what the regex
  actually matched from then on was the *word* "edit-destination" in a nearby
  comment. Moving the block out of comment range exposed it. Replaced with the
  two facts that are true: the block mounts on the same parked-and-idle
  condition as the search it feeds, and carries no motion gate. Every
  structural assertion this milestone adds strips comments first.

## Assertions replaced rather than disabled

Four, each with the contract that replaced it:

| Was | Now |
| --- | --- |
| `navigation-map-ui` #34 — parked map box is `h-72 … sm:h-96` | Same invariant (a box only while a map is mounted, matching the placeholder, both occurrences counted) against the new class string |
| `navigator-drive-design` — mounted map sits in the placeholder-sized box | Same, against the new class string |
| `navigator-map-search` — overlay clears map panes / wrapper passes touches through / list scrolls inside the map box | The search is a sibling of the map and precedes it; no overlay chrome survives. The retired promise was "scrolls **instead of clipping**", and it did not hold. |
| `navigator-fullmap` — `parked: search sits at the top of the map` (failing 8/8 on main) | `parked: search sits above the map, fully painted, inside the viewport` — the stronger statement the old one approximated |

## Performance

| Measure | Before (b247256) | After |
| --- | --- | --- |
| `/drive` First Load JS | 100 kB (3.23 kB page) | 100 kB (3.23 kB page) |
| `/drive/navigate` First Load JS | **190 kB** (37.7 kB page) | **190 kB** (37.8 kB page) |
| `/drive/settings` First Load JS | 149 kB (7.49 kB page) | 149 kB (7.49 kB page) |
| Route calls on initial parked load | 0 | 0 |
| Search calls on initial parked load | 0 | 0 |
| Map mounts when a trip starts | 1 (never remounted) | 1 (never remounted) |

Layout shift around destination entry: the search is in ordinary flow above
the map, so the map's own load cannot move it. The map's loading placeholder
and its mounted box now carry the same height rule, and the harness counts
both occurrences so they cannot drift apart.

## Tests

- `scripts/test-navigator-destination-first.ts` — NED1-NED60, **82 checks**.
  The visibility rule is fed the real measured before-values (must be
  rejected) and after-values (must be accepted).
- `scripts/bench/navigator-destination-first.mjs` — six viewports plus
  route-spend, motion and 200% zoom journeys, **144 checks**.
- `scripts/mutate-navigator-destination-first.mjs` — **10/10 mutations
  caught**. Mutation 1 initially survived and exposed a real hole: an ordering
  check using `indexOf` is happy with a *second* search box below the map.
  NED1b counts instead.
- Full suite: **218 harnesses**, all passing.

## Storage and database

No new storage record, no schema change, **no migration**. The four synced
records (truck, route preferences, clocks, briefing) and the three device-local
ones from NAV-ENTRY-1 (voice, display, standard notice) are untouched.

## Rollback

The change is layout and test-only; there is no data to unwind.

- Reverting the single commit restores the previous parked layout exactly,
  including the overlay. No storage written under this milestone needs
  clearing, because none is.
- A partial rollback is possible and safe: reverting only the
  `drive/navigate/page.tsx` wrapper restores the marketing `Section` padding
  and costs about 60 px of the improvement while leaving the search above the
  map. Reverting only the `mapWrapCls` change restores the fixed 288/384 px
  box — if that is done, the dynamic-import placeholder must be reverted with
  it or the map will jump when its chunk loads; `navigation-map-ui` #34 fails
  if they drift.
- Reverting the four replaced assertions without reverting the source will
  turn `navigator-fullmap` red again with the same eight failures main has
  today.

# Navigator destination → route → drive (NAV-ENTRY-3)

The implementation record for the milestone that made the next step obvious
once a driver has chosen where they are going.

Base: `86b417ee0ad7f75753cf17d8179489ba4edef96e`
(`NAV-ENTRY-2: put destination first on the parked Navigator map (#357)`).

## The problem, measured

NAV-ENTRY-2 put the destination box in front of the driver. It did not
finish the sentence. A driver tapped a search result and then had to work
out, unaided, whether the tap had landed and what to do next.

Recorded in Chromium on a production build of main, with
`NEXT_PUBLIC_NAVIGATOR_ENABLED=true`, after tapping START DRIVING and
selecting a real search result, with no scrolling:

| Viewport | Confirmation top | CTA top | CTA **painted** | In fold | Scroll needed to reach CTA |
| --- | --- | --- | --- | --- | --- |
| 360x740 | 1,114 px | 1,182 px | **0 px** | no | 514 px |
| 390x844 | 1,074 px | 1,142 px | **0 px** | no | 370 px |
| 430x932 | 1,107 px | 1,175 px | **0 px** | no | 315 px |
| 844x390 | 819 px | 859 px | **0 px** | no | 541 px |
| 932x430 | 832 px | 872 px | **0 px** | no | 514 px |
| 1280x800 | 1,005 px | 1,045 px | **0 px** | no | 317 px |

Both halves of the answer were below the fold. The driver got no visible
acknowledgement that the selection had registered, and no visible next step.

What sat between the search and them: the map (148–352 px), the status line,
the 230 px HOS clock card and the control row.

**What was already correct, and was left alone.** The audit measured the
route-spend contract as intact before any change — zero route requests
through opening `/drive`, tapping START DRIVING, opening `/drive/navigate`,
focusing the field, typing and selecting — and exactly one map mount. This
milestone did not need to fix those and did not touch them; it added
regression coverage for them instead.

## After

Same build settings, same journey, same measurement:

| Viewport | Confirmation | CTA top | CTA painted | In fold | Scroll needed | Delta vs before |
| --- | --- | --- | --- | --- | --- | --- |
| 360x740 | in fold, fully painted | 383 px | 72/72 px | yes | **0 px** | −799 px |
| 390x844 | in fold, fully painted | 355 px | 72/72 px | yes | **0 px** | −787 px |
| 430x932 | in fold, fully painted | 355 px | 72/72 px | yes | **0 px** | −820 px |
| 844x390 | in fold, fully painted | 303 px | 72/72 px | yes | **0 px** | −556 px |
| 932x430 | in fold, fully painted | 303 px | 72/72 px | yes | **0 px** | −569 px |
| 1280x800 | in fold, fully painted | 327 px | 72/72 px | yes | **0 px** | −718 px |

At every viewport the CTA is inside the initial viewport, entirely painted,
with nothing hit-testing on top of it, outside any inner scroller, and at a
**72 px** touch target — well above the 44 px floor. Nothing was shrunk.

## The parked hierarchy

1. **Destination search**
2. **Selected-destination confirmation + Start** (the primary flow)
3. **Map**
4. Search scope (the deliberate cross-border toggle)
5. Trip-planning prompt
6. Motion status
7. Basemap picker, HOS clocks, control row, pilot diagnostics

Encoded as data in `PARKED_HIERARCHY` (`src/lib/navigator/destination-first.ts`)
so it is asserted rather than described.

## How it is done — and what it deliberately is not

The parked shell is now **one flex column**, and both of its blocks are
`display: contents`, so every parked element lives in a single ordering
context and `order` can interleave them. **The DOM is untouched and identical
in both modes; only classes change.**

That discipline is not decoration. It is what keeps:

- the map mounted across the parked → guidance transition (one `{mapSlot}`
  mount point, verified at 1 mount by a MutationObserver in the bench), and
- the trip-control state machine from being torn down mid-Start, which a
  second render tree would have done at exactly the moment it matters.

### The split that made it possible

Hoisting the trip controls as one block did not work, and the number says
why: the component measured **2,192 px** on a preview build, and moving it
above the map pushed the parked map to **2,451 px** — effectively gone.

`PilotTripControls` was therefore split at a seam **its own source already
named** — "optional, below the primary flow on purpose", written during the
startup-simplification round:

- **Primary half** (`order-3`): the heading, the confirmation of what was
  picked, the cross-border notice, Start, and the blocked reason.
- **Optional half** (`order-11`): the settled-setup summary, the way back to
  the long form, the developer coordinate box, the pilot briefing, the
  road-test report and the debug log.

Every one of those renders on **exactly the condition it always did**. The
new `rootClassName` / `primaryClassName` / `optionalClassName` props default
to the previous single-box rendering, so any other caller — and every
existing assertion — sees what it saw before.

## Active navigation — unchanged

Guidance mode is untouched: maneuver card first, full-bleed map behind
everything, off-route line, status, trip strip, compact HOS, bottom control
row. `navigator-fullmap` passes, with map coverage during guidance unchanged.
No parked order class leaks into the full-screen branch (asserted, NER9).

## Route-spend accounting

Route requests and destination-search requests are counted **separately** at
every step and priced by the shipped ledger in
`src/lib/navigator/route-start-contract.ts`. Measured at all six viewports:

| Action | Route | Search |
| --- | --- | --- |
| open `/drive` | **0** | 0 |
| tap START DRIVING | **0** | 0 |
| open `/drive/navigate` | **0** | 0 |
| focus destination field | **0** | 0 |
| type a destination query | **0** | 1 |
| select a destination result | **0** | 0 |
| open Settings | **0** | 1 |
| return from Settings | **0** | 0 |
| open Plan My Trip | **0** | 0 |
| return from Plan My Trip | **0** | 0 |
| one deliberate Start | **exactly 1** | 0 |
| return from Settings **during an active trip** | **0** | 0 |
| return from Plan My Trip **during an active trip** | **0** | 0 |

The ledger treats a step that was never measured as a violation, so a bench
that quietly skipped a journey cannot report a pass.

## Search and provider behaviour

No change. Same `DestinationSearch` component, same endpoint, same
coordinator, same 350 ms debounce, same `MIN_SEARCH_LENGTH` gate, same result
cards, same cancellation on pick, same error handling. **No second search
implementation** — asserted by count. **No autocomplete added.** Editing the
text still drops the previous pick, and choosing still fills the box, so
nothing has to be retyped.

## Truck, voice, display, motion

- Fresh device: standard 13 ft 6 in (13.5 ft) / 80,000 lb, seeded and ready.
- Returning driver: a valid saved custom profile is kept, read back through
  the shipped versioned storage, and comes back **confirmed**.
- Voice: defaults On for a new device; a saved Off is respected, verified
  through the real writer rather than a hand-built record.
- Display: Automatic / Night / Day, unchanged.
- Motion: **no motion-based editing lock.** Verified in a real browser — the
  geolocation is walked north at ~65 mph for longer than the 10 s
  `MOVING_DWELL_MS`, the status line is confirmed to read **"Moving"**, and
  only then are the field and the CTA checked. Both present, neither
  disabled. Reaching MOVING is itself an assertion (M0), because a loop that
  never left UNKNOWN would pass without testing anything.
- Passenger Access, the declaration, hold-to-unlock, countdown and override
  all remain absent — in source over every touched file, and on the rendered
  page.

## The landscape trade-off, stated plainly

At 844x390 and 932x430 the CTA is in the fold at 303 px, and the map — 148 px
and 161 px tall — sits just past it, with about 6 px above the fold. Portrait
phones and the laptop keep the map fully visible (319 px at 390x844, 302 px
at 1280x800, both entirely in fold).

That is the honest cost of a 390 px-tall viewport holding a 65 px site
header, a destination box, a confirmation and a 72 px primary action. The
milestone's own hierarchy puts the map after the primary action, and on the
shortest screens that is where it lands. Nothing is clipped and no assertion
was relaxed to make it pass.

To buy the landscape CTA its place, the **cross-border search-scope toggle**
moved out of the search card to after the map. It is a 72 px control
answering "which country am I searching?", which a driver asks far less often
than "where am I going?" — and on those two viewports those 72 px were the
difference between Start being on screen and Start being clipped to 15 px of
itself. It is still one clearly labelled deliberate tap.

## Performance

| Measure | Before (86b417e) | After |
| --- | --- | --- |
| `/drive` First Load JS | 100 kB (3.23 kB page) | 100 kB (3.23 kB page) |
| `/drive/navigate` First Load JS | **190 kB** (37.8 kB page) | **190 kB** (37.9 kB page) |
| `/drive/settings` First Load JS | 149 kB (7.49 kB page) | 149 kB (7.49 kB page) |
| Route calls on initial parked load | 0 | 0 |
| Search calls on initial parked load | 0 | 0 |
| Map mounts across the journey | 1 | 1 |

First Load JS is unchanged on all three routes. This is a layout and
ordering milestone; the only new module is a pure contract used by tests.

## Tests

- `scripts/test-navigator-route-start.ts` — NER1–NER60, **73 checks**.
- `scripts/bench/navigator-route-start.mjs` — six viewports plus active-trip,
  motion and 200% zoom journeys, **124 checks**.
- `scripts/mutate-navigator-route-start.mjs` — **12/12 mutations caught**.
- Full suite: **219 harnesses**, all passing (was 218 on main).
- Existing Navigator benches re-run against this branch: NAV-ENTRY-2
  destination-first **146/146**, `navigator-fullmap` **PASS**,
  NAV-ENTRY-1 entry-viewports **353/353**.

### Two instrument bugs found and fixed while building the bench

Both are recorded because each would have produced a green result that
proved nothing:

1. The zoom checks conflated *clipped by an ancestor* with *outside the
   viewport*. At 200% text zoom the page legitimately doubles and scrolling
   is expected, so demanding a 144 px control fit a viewport now holding half
   as much was a requirement no honest layout could meet. The measurement now
   reports the two separately, and the zoom checks ask the meaningful one.
2. A comment in `DrivingScreen` quoted the map wrapper's own tokens, and two
   harnesses **count** those tokens to prove there is one mount point — so
   the count read 2. The comment was de-tokenised rather than the assertions
   loosened.

## Known pre-existing issues, left untouched

- **Shared site-header mobile-nav overflow at 200% text zoom.** Baselined by
  NAV-ENTRY-2 at 46 px on main and 46 px on branch, on `/drive`,
  `/drive/navigate` and the site homepage alike. Measured again here at
  46 px. Printed by both benches, asserted by neither. Not this milestone's
  to fix, and no site-header change is in scope.
- **One ESLint warning on main**: `NavigatorSettings.tsx:165`,
  `react-hooks/exhaustive-deps` missing `notifySaved`. Present at the base
  commit; CI's `npm run lint` exits 0 because warnings do not fail it. Not
  absorbed into this milestone; this branch adds no new warnings.
- **PR #356 (REVENUE-2) overlap, non-blocking.** It is open and modifies
  `scripts/test-navigator-entry.ts` — rewriting NAV-ENTRY-1's NE70 from "no
  migration above 056" to "no *unexplained* migration above 056", because
  REVENUE-2 adds `057_featured_listing_term.sql`. This milestone does **not**
  touch that file, so there is no textual conflict; and its own no-migration
  assertion (NER60a) is written against the base migration set rather than a
  fixed number, precisely so a different milestone doing its job cannot
  falsify it.

## Assertions updated rather than disabled

| Was | Now |
| --- | --- |
| `destination-first` NED6 — "the input comes first, before the border toggle", sliced from `mapSearchSlot=` to `parkedPlanSlot=` | The toggle left the search card. Left alone the old check would still have **passed dishonestly**, because the new scope slot happens to sit between the same two anchors. It now slices the search card itself and asserts the toggle is not in it. |
| NED7 / NED57 — pinned the literal `'order-1'` spelling next to a slot name | Read the actual order numbers back and compare positions, so the rule survives an insertion |
| NED8 / NED9 / NED11b — hierarchy `[search, map, controls]` | `[search, route-start-cluster, map]`, with the old order now asserted as a violation |

## Storage and database

No new storage record, no schema change, **no migration**. No Supabase
schema was touched and no pending migration was applied.

## Security

Navigator access remains server-authoritative — `requireNavigatorAccess` on
`/drive/navigate` untouched, middleware prefixes untouched. Client-chunk scan
found no pilot password, HERE key or app id, and no service-role credential.
No new position, destination or route persistence, and no new analytics
event.

## Rollback

Layout and test-only; there is no data to unwind.

- Reverting the two commits restores the previous parked order exactly. No
  storage written under this milestone needs clearing, because none is.
- A partial rollback is possible: reverting only the `PilotTripControls`
  split restores the single-box rendering, but the parked order must be
  reverted with it — the primary/optional class props are what place the two
  halves, and without the split the whole 2,192 px block would ride at
  `order-3`, pushing the parked map to ~2,451 px. `NER2` and `NER4` fail if
  they drift apart.
- Reverting the cross-border toggle to the search card costs the landscape
  CTA its place; `S6` at 844x390 and 932x430 fails if that is done alone.

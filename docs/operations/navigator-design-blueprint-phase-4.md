# Navigator Design Blueprint — Phase 4 record

**Scope shipped:** the destination search results restyled into cockpit
destination cards, from REAL candidate fields only. The search flow —
debounce, coordinator, first-party endpoint, rate limiter, selection
path, stationary-only gate — is byte-for-byte the proven implementation.

## The audit (done before any UI change)

1. **Flow:** typed query → 350ms debounce → search coordinator (dedupe,
   same-query cache, staleness sequencing) → `search-port` → first-party
   `/api/navigator/destination-search` (flag-gated, provider-key
   server-side, `searchLimiter` 429s) → up to 8 candidates → `onPick` →
   `picked` in the trip controls → the same plan request → the Phase 3
   briefing.
2. **Candidate fields that exist:** `id`, `title`, `address` (may be
   empty), `position` (never rendered, by pin), `facility` (mapped from
   HERE's own category ids — the one authoritative category source),
   `distanceMi` (HERE's straight-line miles, may be null). **Nothing
   else exists** — no amenities, no hours, no ratings, no parking, no
   fuel, no scales.
3. **Shown before:** everything real was already shown, as plain
   bordered rows with facility+distance merged into one dim line.
4. **Duplicate/low-value presentation found:** none removed — the one
   improvement was honesty: "12 mi away" now reads "≈ 12 mi away ·
   straight line", because a bare number beside a destination invites
   reading it as route distance, which it is not.
5. **States:** waiting-for-GPS, searching, no-results, failure, and
   results all existed and keep their exact wording; the whole surface
   is parked-only behind the `edit-destination` LockGate, unchanged.

## The card (blueprint §6.3 hierarchy, real data only)

FACILITY eyebrow (only when HERE's category mapped to one) → place name
→ postal address (only when present) → "≈ N mi away · straight line"
(only when HERE returned it) → the whole card is the ≥64px button, with
a decorative chevron affordance. Cockpit surface, calm active-state
transition, no new colors, no severity colors, no TLWS yellow.

**No inference from names:** a result called "Pilot" gains nothing its
candidate record does not carry. The harness feeds the card exactly that
fixture and bans every amenity and verdict word from the render.

## Deferred blueprint items (recorded, not faked)

- **Status dots / parking-fuel-scale metadata on cards (§6.3)** — no
  data source; the deferred-data list from Phases 1–3 stands. Seam: the
  candidate type + this card's metadata row.
- **"Distance off-route / adds 11 min" (§6.3)** — computing detour cost
  needs a route-alternatives call per candidate (provider spend). The
  straight-line honesty label is the truthful substitute until the
  paid-alternatives owner decision.
- **Voice search / mic affordance (§6.1)** — no speech-recognition path
  exists in this app, and the microphone ban is pinned by the voice
  harness. A dead mic button would be theater. Owner/UX decision.
- **"Add stop" multi-stop (§6.3)** — no multi-stop trip model exists;
  selection remains single-destination into the existing lifecycle.

## What is explicitly unchanged

Search endpoint and its rate limiter, the coordinator, the debounce, the
candidate contract, `onPick` → plan → briefing, the LockGate posture,
every status string, and the route/search rate limits.

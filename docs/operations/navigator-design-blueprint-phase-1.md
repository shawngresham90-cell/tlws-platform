# Navigator Design Blueprint — Phase 1 record

**Scope shipped:** blueprint build-order steps 1–2 — the design-token system
and the Drive Mode cockpit shell — as a purely presentational modernization.
Every navigation, safety, voice, GPS, authentication and privacy behavior is
the proven pre-Phase-1 code, untouched. This document records what Phase 1
implemented, and — feature by feature — what it deliberately did NOT build
because the repository has no legitimate data or provider path for it.

The rule this document enforces: **nothing on the driving screen may look
like live driver information unless it is.** A mocked speed-limit shield or
a placeholder parking dot is not a design improvement; it is a lie a driver
might act on at 70 mph. Blocked features ship as documented seams, not as
props.

## Implemented (build-order steps 1–2)

| Blueprint section | What shipped |
| --- | --- |
| §3 Color system | Night-first `--nav-*` palette, exact blueprint hexes; day palette complete but dormant (`[data-theme='day']` — nothing sets it yet); semantic rules enforced by harness |
| §4 Typography | Type-scale tokens; Inter as UI face; tabular numerals on every Drive Mode numeral; `--font-data` seam for the Barlow decision (see blocked list); 16px drive-mode text floor |
| §5 Drive Mode | Cockpit restyle of the existing surface: maneuver banner hierarchy (huge distance, provider-structured glyph, instruction beneath), map ≥65% of the portrait layout, trip bar with speed emphasis from real GPS/route data, compact truck chip stating the pilot-default profile, imminent-maneuver glow |
| §8 Touch | 64px primary driving controls (already the house floor), 48px absolute floor, 12px gap token |
| §9 Motion | 200ms/300ms ease tokens; reduced-motion collapses them to 0ms at the token, so every consumer inherits the preference |
| §11 Kill list | Pinned by the `navigator-drive-design` harness: no ads/promos, no modals while moving, no hamburger, no sub-16px drive text, no TLWS yellow in Drive Mode chrome or on the map, ≤3 information clusters |
| §12 Tokens | `src/app/(navigator)/navigator-design.css`, loaded by the (navigator) layout; Tailwind `nav.*` aliases |

## Blocked blueprint features — recorded, not faked

Each entry: **(1)** the blueprint requirement, **(2)** the missing
dependency, **(3)** the safest future implementation seam, **(4)** the
decision that unblocks it and whose it is.

### Automatic satellite Arrival Mode (§6.4)
1. At 0.5 mi from destination the map switches to satellite imagery.
2. No satellite tile source. OpenStreetMap — the keyless provider this app
   ships — publishes street tiles only. `SATELLITE_REQUIREMENT` in
   `src/lib/navigator/map-style.ts` already states this to the driver.
3. `MAP_STYLES` in `map-style.ts` (the style seam ships disabled-with-reason)
   plus the lifecycle's real `final-approach` state as the trigger.
4. Owner: choose and pay for a licensed imagery provider (HERE, Mapbox,
   Esri, Google), with keys and terms.

### Facility entrance pins and dock/gate notes (§6.4)
1. Entrance pin drops and a gate-notes card slides up on final approach.
2. No verified truck-entrance dataset. `truck-entrance.ts` models entrance
   provenance and today every searched destination is honestly `'unknown'` —
   the provider pin is the front door, not the gate.
3. The existing `DestinationFacility` / provenance model: verified entrances
   would flow through the same field the arrival engine already reads.
4. Owner: decide the data source (curated per-facility records vs. a
   commercial dataset) and its maintenance burden.

### Custom map style and truck-restriction tiles (§7)
1. Near-monochrome slate basemap; truck-restricted roads dashed red on the
   map itself; terrain hillshading; zoom-gated POI pins.
2. Requires a stylable vector-tile provider and a truck-restriction data
   layer. The shipped map is Leaflet over OSM **raster** tiles: the imagery
   is not restylable, and no restriction dataset exists in the repo. A CSS
   filter over raster tiles was considered and rejected — it degrades label
   contrast, which fails the one-second rule at night.
3. `map-style.ts` (a new style entry) + `NavigationMap.tsx` (tile layer is
   already swappable per style). Route-line presentation is already
   tokenized after Phase 1.
4. Owner: vector-tile provider selection, licensing, cost; separately, an
   authoritative truck-restriction source (never a guessed overlay).

### Offline / downloaded maps (§10)
1. "Offline — routing from downloaded maps" strip; everything else works.
2. No offline tile store and no offline routing engine; routing is HERE,
   online. What DOES exist and is honest today: the in-memory route
   survives offline, and the screen says exactly what offline costs
   (`network-status.ts`).
3. `offlineNotice()` — the copy seam — and the service-worker layer for any
   future tile caching.
4. Owner/provider: offline routing is a product-scale decision (storage,
   licensing, staleness policy), not a UI patch.

### Real-time fuel prices (§5 quick rail, §6.3)
1. Fuel stop cards with live prices; fuel-plan chips.
2. No fuel-price data source or vendor relationship.
3. The POI search port (`search-port.ts`) — a price field would join search
   results, never the map directly.
4. Owner: fuel-price vendor, cost, and freshness guarantees.

### Real-time parking availability (§6.3)
1. 🟢 available · 🟡 filling · 🔴 full · ⚪ unknown on every parking POI.
2. No live availability feed. The platform's community parking reports are
   driver observations, not real-time occupancy.
3. Same POI port; the blueprint's ⚪ unknown state is the honest default the
   existing data could already fill — but a rail of ⚪ dots adds a cluster
   with no decision value, so it waits for real data.
4. Owner: availability source (state DOT feeds, vendor, or community-report
   freshness policy).

### Real-time weigh-station status (§5, §6.3, §7)
1. OPEN/CLOSED as the dominant element on weigh-station cards; scale glyphs
   on the map.
2. No weigh-station status source.
3. POI port + the restriction icon language (§7) once data exists.
4. Owner: data source decision.

### Paid route alternatives (§6.2)
1. Route preview offering alternates with tolls/fuel comparison.
2. Requesting alternates multiplies provider transactions — a spend
   decision — and the route contract deliberately requests one route.
3. `route-contract.ts` / the plan port; alternates would be a schema
   version, not a UI hack.
4. Owner: provider spend and the product decision, per the volume doc.

### Hazard timeline, grade strip, warning rail escalation (§5, §6.2)
1. In-order hazard list with mile markers; elevation profile; live warning
   rail that escalates amber→red by distance.
2. No bridge-height, weight-restriction, or grade dataset in the repo. What
   exists that is REAL: HERE route **notices** (`HereRouteNotice`) already
   parsed and used for truck-viability refusal — but they are route-level
   notices, not positioned hazards with mile markers.
3. The warning-rail POSITION exists and carries its one honest instance:
   the off-route state line (#272's real data) now wears the blueprint's
   amber advisory edge, paired with its words. A positioned hazard feed
   would extend that slot without moving any other cluster — nothing else
   renders there today, and nothing fake ever will.
4. Owner/provider: hazard data source; separately, whether route notices
   should surface on the driving screen (a UX decision worth its own
   road test).

### Posted / truck-specific speed limits (§5 speed cluster)
1. Posted-limit shield beside current speed; truck limit when lower;
   over-limit color escalation.
2. The route response carries no speed-limit data today, and the current
   speed comes from GPS. A shield rendered from nothing would be the most
   dangerous fake on the screen.
3. The trip bar's speed cell (Phase 1 gives speed the blueprint's 48px
   numeral); a limit field would join the route contract when the provider
   sends one.
4. Owner + provider evidence: whether HERE's response can carry limits for
   the routed segments — a contract change gated like every provider
   parameter (authoritative evidence, separate approval).

### Lane guidance (§5)
1. Lane-arrow strip under the banner within 1 mi of complex interchanges.
2. Lane data is not parsed from the provider response, and no independent
   source exists.
3. `parseHereResponse` → `HereManeuver` — lanes would be provider fields
   flowing through the same parse, with the banner strip as the seam.
4. Provider evidence + owner approval, same bar as any HERE parameter.

### Quick rail: Parking · Fuel · Weigh · Report (§5)
1. Right-edge rail of four 64px POI buttons, auto-hiding.
2. Three of the four buttons front data that does not exist (above); and a
   new class of while-moving tappable controls must go through the safety
   lock's permission map — a policy decision, not a styling one.
3. The SafetyLock permission map + POI port; the rail is pure presentation
   once both exist.
4. Owner: whether POI interaction belongs on the moving screen at all.

### Barlow Semi Condensed (§4)
1. Data face for every numeral.
2. This repo loads fonts as committed woff2 files via `next/font/local`;
   adding a family means adding font assets — a licensing/asset decision.
   Phase 1 was instructed not to download or commit font files, so it
   stopped here rather than guessing.
3. `--font-data` in `navigator-design.css` — every numeral already reads
   it; the owner's woff2 + one localFont entry + one token edit completes
   §4 with no component changes.
4. Owner: approve the font asset (Barlow Semi Condensed is SIL OFL, the
   same license family as the committed Anton/Inter subsets).

### Automatic day/night switching (§3)
1. Auto-switch at sunset/sunrise plus tunnel detection.
2. Needs a clock-and-position policy; the navigator core is deliberately
   clock-free and this decision (like HOS) belongs above the pure layer.
3. `[data-theme='day']` — the palette is complete and dormant; switching is
   one attribute on the navigator surface.
4. Owner/UX: whether day mode is automatic, manual, or system-following —
   then a small wiring PR that can be looked at on a phone in daylight.

### Glove Mode (§8)
1. +25% targets, gestures replaced by buttons.
2. Needs a driver-facing setting surface and a policy for how it composes
   with the safety lock's gesture permissions.
3. The `--tap-*` tokens: Glove Mode is a token multiplier once a setting
   exists.
4. Owner/UX: settings surface design (parked-only, per §6.5).

### Maneuver chime / severity tones (§9)
1. Two-tone maneuver chime; urgent triple-tone for restrictions.
2. The audio channel is owned by voice guidance, whose arbitration and
   anti-chatter rules are proven safety behavior. Tones must enter through
   that arbitration — never beside it — and that is a voice-design change,
   not a Phase 1 restyle.
3. `voice-guidance.ts` request queue (a tone would be a request kind with
   an announce-once id, subject to the same arbitration).
4. Owner/UX: whether sound beyond speech belongs in the pilot at all.

### 3D tilted camera, heading-up canvas (§5 camera)
1. ~55° 3D tilt, ahead-up map, chevron in the lower third.
2. Leaflet renders flat raster tiles: no tilt, and canvas rotation is not
   supported without replacing the map layer. What IS real today:
   heading-up is carried by the rotated truck chevron, speed-based
   auto-zoom already exists (`navigationZoom`), and overview/recenter
   behavior is proven `map-follow` logic Phase 1 does not touch.
3. `NavigationMap.tsx` is already an isolated leaf component — a future
   vector map (same provider decision as §7) would replace its internals
   behind the same props.
4. Owner: same vector-tile provider decision as the custom map style.

## The one intentional visual change to the map

The route line changes from `#facc15` (a yellow one hue from TLWS brand
yellow — the exact collision §3 bans) to the blueprint's `--nav-route`
electric cyan over a dark casing. Purely presentational: same polyline,
same geometry, same redraw triggers, same follow behavior. Every other map
behavior — provider, tiles, matched-position display, recenter, overview,
truck marker logic — is byte-for-byte the proven code.

## One recorded tension: the TL vehicle marker's amber

The road-tested vehicle marker (#272, owner-approved on the Hwy 92 retest)
carries Sodium Amber accents — the site's money color, not the brand
yellow the blueprint bans, but adjacent to the `--nav-warn` warning amber.
Under a strict reading of blueprint law 4, nothing non-warning on the
drive map should be amber. Phase 1 deliberately does NOT touch it: the
marker is fresh, owner-approved, road-verified work, and re-skinning it is
a one-line color decision in `vehicle-marker.ts` that belongs to the owner
— ideally judged on a phone, on a road, like the original. The design
harness's amber ban therefore covers every Drive Mode component EXCEPT
`vehicle-marker.ts`, and this paragraph is the record of why.

# Partner PWA audit — what was extracted, and what was rejected

**Audit date:** 2026-08-02 · **Status:** closed. This note is the durable record; the audit itself was read-only and nothing from it is pending.

A partner-supplied React PWA archive was audited in full, read-only, to decide whether it could serve as a foundation for TLWS Navigator or contribute reusable code. This note records the conclusion so the question does not get re-opened from memory or from the archive's own planning documents.

## The finding that shaped everything else

**The archive contained no navigation or GPS capability.** Not a partial implementation — none.

A capability sweep across the whole of its application and server code returned zero occurrences of `watchPosition`, of any mapping library (Mapbox, MapLibre, Leaflet, Google Maps), of any routing provider, and of turn-by-turn, maneuver, reroute, off-route, polyline, voice-guidance, or truck-profile terminology. `getCurrentPosition` appeared exactly twice: one implementation and its test double. Its dependency manifest listed eleven production packages, none of them geospatial. Its own epic breakdown defined seven epics — foundation/auth, parking discovery, HOS logging, admin/affiliate, cohort attribution, privacy, UX polish — with no navigation epic and no navigation requirement.

What it actually was: a client-rendered PWA for parking lookup and manual hours-of-service logging.

The archive shipped roughly as much documentation as code, and its top-level status file was two months stale relative to its own source. Conclusions here were drawn from files and greps, never from planning documents.

## TLWS remains authoritative

On every axis where the two projects overlapped, TLWS was already ahead:

- **Routing.** TLWS has a live HERE Routing API v8 integration with full truck profile — dimensions, gross weight, axle count, hazmat class — plus polyline decoding, a provider-port seam, weather and fuel layers, and an optimizer. The archive had nothing comparable.
- **Hours of service.** TLWS's engine covers the 30-minute break, the 34-hour restart, both 60/7 and 70/8 cycles, and split-sleeper 8/2 and 7/3. The archive's was a fraction of the size and implemented none of those four.
- **Parking.** TLWS's directory is a large curated dataset built against authoritative sources. The archive's ten-state DOT integration pointed every request at placeholder URLs and mapped an explicitly assumed feed shape — a framework, not working integrations.

## What was extracted

Two utilities, both pure, both currently unreferenced by anything that ships:

| Module | What it does |
|---|---|
| `src/lib/pwa/install-prompt.ts` | Decides whether a visitor can install the site to their home screen, and by which route. |
| `src/lib/navigator/direction-of-travel.ts` | Given a position, a heading, and a candidate location, answers whether the candidate is ahead, behind, or off to one side. |

Both were **reimplemented from documented behaviour, not copied.** The archive contained no `LICENSE`, no `NOTICE`, no authorship record, and no git history, so its reuse terms are unknown. Under that uncertainty the only safe course was to take the *problem statement* — which cases must be handled and why — and write TLWS's own implementation, API, and tests. No file, function body, comment, test fixture, or API shape was carried over.

Why these two were worth the trouble:

- **Install detection** is deceptively hard and TLWS had never solved it. Chrome, Firefox, Edge, and Opera on iOS are all WebKit and all carry `Safari` in their user agent, yet none can add to the home screen. In-app browsers (Instagram, Facebook, the Google app) carry it too and also cannot. Since iPadOS 13, Safari on iPad reports itself as a desktop Mac. Each of those is a wrong answer that either shows instructions to someone who cannot follow them or withholds them from someone who needs them.
- **Direction of travel** answers a question the directory could not. "Nearest" is the wrong sort at highway speed: a stop four miles behind ranks above one eight miles ahead and is useless. The signed along-heading projection fixes that with about eighty lines of geometry.

## What was rejected

Everything else, deliberately:

- **HOS logging** — TLWS's engine is a strict superset.
- **Authentication, onboarding, and settings** — these presuppose consumer accounts. TLWS has no consumer login, and adopting them would be a product decision disguised as an integration.
- **Admin console and affiliate-slot engine** — TLWS has its own, already live.
- **Parking search, state DOT feeds, and the OpenStreetMap mirror** — placeholder endpoints and assumed contracts, and an unvetted mirror would regress a curated dataset.
- **All Supabase schema, policies, and edge functions** — TLWS's database is established and was not touched by this work.
- **The archive's own hosting and project configuration** — not inherited, not referenced.

## Boundaries this PR holds

- No service worker and no web app manifest were created. The install utility is detection only; it renders nothing and registers no listeners. The PWA milestone remains separate and unstarted.
- Neither module is imported by anything under `src/`, so there is no behaviour change and no visible UI change. `scripts/test-extraction-boundaries.ts` asserts this mechanically, along with the absence of React, Next.js, Supabase, network I/O, DOM mutation, and environment-variable reads in both modules.
- No database write, migration, dependency, environment variable, or paid service was introduced.
- `src/lib/trip-planner`, `src/lib/hos`, `src/lib/directory`, and `src/lib/store` are untouched, and the boundary harness asserts none of them reference the extraction.

## What comes next

Two follow-on milestones, each independent and neither started here:

**PWA / offline.** TLWS has no service worker, manifest, or offline story today. If that milestone happens, the install utility is ready to wire into a real surface, and the archive's cache-partition discipline — a fixed set of permitted cache namespaces, asserted at service-worker activation — is worth reproducing then. It is out of scope until a service worker exists to partition.

**Navigator.** Any Navigator work continues on HERE routing and the existing TLWS provider-port architecture. Nothing in the audited archive changes that, and the direction-of-travel module is explicitly not a substitute: it is straight-line geometry against an instantaneous compass heading, it knows nothing about roads, and where real route geometry exists the Trip Planner's route-mile projection is authoritative.

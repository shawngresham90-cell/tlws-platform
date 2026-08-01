# 02 — Component Inventory

Design only. `NEW` components do not exist yet; `REUSE`/`EXTEND` reference real
files on `origin/main` at `46f2a40`.

Update frequency legend: **1 Hz** = per GPS fix · **60 s** = HOS cadence ·
**5 mi** = per 5 route-miles of progress · **static** = set once per route ·
**event** = user action only.

---

## Existing components Navigator reuses

| Component | Path | Verdict | Navigator use |
|---|---|---|---|
| `PlaceCombobox` | `components/trip-planner/PlaceCombobox.tsx` (236 L) | **REUSE** | Destination entry on Trip Setup |
| `SavedTripsPanel` | `components/trip-planner/SavedTripsPanel.tsx` (251 L) | **REUSE** | Launch screen saved-trip list |
| `AccountPanel` | `components/trip-planner/AccountPanel.tsx` (246 L) | **REUSE** | Sign-in for cloud sync |
| `useSavedTrips` | `components/trip-planner/useSavedTrips.ts` (160 L) | **REUSE** | Local store hook |
| `useCloudSync` | `components/trip-planner/useCloudSync.ts` (353 L) | **REUSE** | Cloud merge on sign-in |
| `LeafletMap` | `components/map/LeafletMap.tsx` | **EXTEND** | Needs heading-up rotation, own-position marker, route polyline layer |
| `MapMarker` | `components/map/MapMarker.tsx` | **REUSE** | Stop pins |
| `TpcReserveBand` | `components/trip-planner/TpcReserveBand.tsx` (233 L) | **REUSE** | Reservation CTA inside Parking panel |
| `ReportParkingSheet` | `components/directory/ReportParkingSheet.tsx` | **REUSE** | Driver report, stationary only |
| `Button`, `Container`, `Section` | `components/ui/**` | **REUSE** | Primitives |
| `MobileToolBar` | `components/layout/MobileToolBar.tsx` | **REUSE** | Entry point to Navigator |
| `TripPlannerApp` | `components/trip-planner/TripPlannerApp.tsx` (837 L) | **DO NOT MODIFY** | Navigator is a sibling surface, not a rewrite of this |

`TripPlannerApp` stays exactly as it is. Navigator borrows its *sub*-components
but does not alter the planner's own screen — that surface has shipped and works.

---

## New components

### Shell & providers

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `NavigatorShell` | Root layout for `(navigator)` routes; hosts providers | `children` | — | — | — |
| `SafetyLockProvider` | Supplies lock state app-wide | `children` | `lockState`, `override` | `SafetyLockController` | 1 Hz |
| `LockGate` | Refuses to render interactive children when locked | `action: UIAction`, `children`, `fallback?` | — | `useSafetyLock()` | on lock change |
| `NavigationProvider` | Supplies the session snapshot | `children` | `NavigationState` | `NavigationController` | 1 Hz |
| `GpsProvider` | Owns the single `watchPosition` subscription | `children` | `fix`, `health` | `GPSSessionManager` | 1 Hz |
| `OfflineProvider` | Connectivity + cache status | `children` | `online`, `cacheStatus` | `OfflineManager` | event |

`LockGate` is the enforcement point for AD-4. Per-component permission checks
are prohibited.

### Launch & setup

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `LaunchScreen` | Entry, resume, saved trips | — | — | `useSavedTrips` | event |
| `ResumeTripCard` | Offers interrupted-session recovery | `session: PersistedSession` | — | IndexedDB | event |
| `TripSetupForm` | Destination, truck, clocks | `initial?: TripDraft` | draft | local | event |
| `TruckProfileSelector` | Pick/edit truck preset | `presets`, `value`, `onChange` | — | `truck_presets` | event |
| `ClockEntry` | HOS clock state entry | `value`, `onChange` | — | local | event |
| `ProfileValidationList` | Shows `validateTruckProfileForRouting` problems | `problems: string[]` | — | pure fn | on change |

### Route preview

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `RoutePreviewScreen` | Container | `quote: QuoteResult` | — | `/api/trip-planner/quote` | event |
| `RouteSummaryBar` | Distance, drive time, ETA | `route`, `itinerary` | — | quote | static |
| `PlannedStopsList` | Stops with reason for each | `stops: PlannedStop[]` | — | quote | static |
| `RouteSourceBadge` | "HERE truck route" vs "Estimated" | `provider: string` | — | quote | static |
| `WarningsBlock` | HOS violations, degradations, exceptions | `warnings: string[]` | — | quote | static |
| `CostEstimateCard` | Cost with unknowns shown as unknown | `cost: TripCostEstimate` | — | `cost-engine` | static |

`RouteSourceBadge` is safety-relevant: it gates the Start button per AD-8.

### Driving screen

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `DrivingScreen` | Container, motion-safe layout | — | — | `NavigationProvider` | 1 Hz |
| `ManeuverCard` | Primary guidance element | `maneuver`, `distanceMi`, `next?` | — | `ManeuverEngine` | 1 Hz |
| `ManeuverIcon` | Turn arrow by maneuver type | `type: ManeuverType` | — | pure | 1 Hz |
| `NavMap` | Heading-up map, position, route | `route`, `position`, `stops` | zoom/follow | Leaflet + fix | 1 Hz |
| `HosStrip` | **Permanent** drive + on-duty countdown | `clocks: RemainingClocks` | — | `hos-engine` | 60 s |
| `HosWarningLine` | "Break required in 1:48" | `nextAction` | — | `hos-engine` | 60 s |
| `StatusStrip` | ETA, remaining mi, remaining time, speed | `eta`, `remainingMi`, `speedMph` | — | tracker + fix | 1 Hz |
| `OneTouchBar` | Parking / Fuel / Legal, ≥ 64 px | `onOpen(panel)` | — | — | — |
| `OffRouteBanner` | Off-route / rerouting / paused | `state: OffRouteState` | — | `OffRouteDetector` | on change |
| `PositionHealthBadge` | Approximate / lost / dead-reckoning | `health` | — | `GPSSessionManager` | 1 Hz |
| `WeatherBanner` | Warning-severity interrupt only | `alert`, `ageMs` | — | weather cache | 5 mi |

### Panels (sheets)

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `PanelSheet` | Shared sheet chrome; keeps maneuver card visible | `title`, `onClose`, `children` | open | — | event |
| `ParkingPanel` | Ranked parking ahead | `candidates`, `currentMile` | — | `recommendParking` | 5 mi |
| `ParkingCard` | One stop | `candidate`, `milesAhead`, `detourMin` | — | — | 5 mi |
| `OvernightChip` | confirmed / prohibited / **unknown** | `status` | — | `overnight.ts` | static |
| `SpaceCountBadge` | Confirmed positive count only | `spaces: number` | — | — | static |
| `FuelPanel` | Fuel stops + range ring | `stops`, `rangeMi` | — | `recommendFuelStops` | 5 mi |
| `FuelPriceTag` | EIA price or "unknown" | `price?`, `period?` | — | `eia-fuel` | 5 mi |
| `LastLegalStopPanel` | Four named slots | `slots: LastStopSlot[]` | — | `last-stop.ts` | 5 mi |
| `SlotCard` | One slot + margin + reasoning | `slot`, `explanation` | — | — | 5 mi |
| `NoReachableStopWarning` | Critical escalation | `clocks` | — | `last-stop.ts` | 5 mi |
| `WeatherPanel` | Bands and alerts with age | `bands`, `alerts`, `ageMs` | — | `nws-weather` | 5 mi |
| `HosPanel` | Full clocks, recap, split eligibility | `clocks`, `recap`, `split` | — | `hos-*` | 60 s |

`OvernightChip` must render all three states explicitly — never omit "unknown".
`SpaceCountBadge` renders only for positive counts; the zero-space rule filters
upstream so the component never receives a zero.

### Arrival & summary

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `ArrivalScreen` | Arrival confirmation | `destination`, `actualMs`, `estimatedMs` | — | session | event |
| `TripSummaryScreen` | Post-trip recap | `summary` | — | session | event |
| `SaveFavouriteButton` | Persist to `saved_trips` | `trip` | — | cloud sync | event |

### Safety

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `MotionLockOverlay` | Shown when a locked action is attempted | `action`, `onRequestOverride` | — | lock state | event |
| `PassengerOverrideDialog` | Press-and-hold attestation | `onConfirm`, `onCancel` | holdMs | — | event |
| `OverrideBanner` | Countdown of remaining override | `expiresMs` | — | lock state | 1 s |
| `EmergencyButton` | Always available, never locked | — | — | — | — |
| `EmergencyScreen` | Position as readable text + nearest help | `fix`, `nearest` | — | fix + directory | event |

`EmergencyScreen` is the only surface that renders precise position as text, and
only on explicit user action.

### Offline & errors

| Component | Purpose | Props | State | Data source | Update |
|---|---|---|---|---|---|
| `OfflineBanner` | Persistent offline indicator | `since` | — | `OfflineProvider` | event |
| `CacheAgeLabel` | Data age for any cached panel | `ageMs`, `staleAfterMs` | — | cache | 60 s |
| `CachePrompt` | Pre-trip download with size estimate | `estimateMb`, `onAccept` | — | `OfflineManager` | event |
| `StorageBudgetBar` | Used vs limit | `usedMb`, `limitMb` | — | `OfflineManager` | event |
| `PermissionRationale` | Plain-language pre-prompt | `permission` | — | — | event |
| `ErrorState` | Uniform error presentation | `code`, `message`, `recovery?` | — | — | event |

---

## Component-count estimate

| Group | New | Reused |
|---|---|---|
| Shell & providers | 6 | 0 |
| Launch & setup | 6 | 3 |
| Route preview | 6 | 1 |
| Driving screen | 11 | 1 |
| Panels | 13 | 2 |
| Arrival & summary | 3 | 1 |
| Safety | 5 | 0 |
| Offline & errors | 6 | 0 |
| **Total** | **56** | **8** |

## Rendering discipline

1. **Only `NavigationProvider` re-renders at 1 Hz.** Everything else subscribes
   to a selector. A naive context that re-renders the whole tree at 1 Hz will
   miss the frame budget in [08](./08-performance.md).
2. **The map is not a React-render surface.** Position updates mutate the
   Leaflet layer imperatively; React owns the chrome, not the canvas.
3. **`ManeuverCard` and `HosStrip` are memoised** on the values they display,
   not on the session object.
4. **No component reads `Date.now()`.** Time arrives as a prop, preserving the
   testability property that makes the core replayable ([09](./09-testing.md)).

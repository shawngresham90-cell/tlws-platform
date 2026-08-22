# Navigator simple entry (NAV-ENTRY-1)

The implementation record for the milestone that replaced the setup-heavy
Navigator entry with three buttons.

## The old journey, measured

Recorded on the shipped build with `NEXT_PUBLIC_NAVIGATOR_ENABLED=true`,
before any change, for a driver who had already entered everything:

| Viewport | Parked-screen height | Start Route at | Destination search at | Interactive controls |
| --- | --- | --- | --- | --- |
| 360x740 | 7,654 px | 5,954 px | 488 px | 111 |
| 390x844 | 7,590 px | 5,906 px | 488 px | 111 |
| 430x932 | 7,242 px | 5,594 px | 464 px | 111 |
| 844x390 | 6,292 px | 5,106 px | 460 px | 111 |
| 1280x800 | 6,056 px | 5,106 px | 460 px | 111 |

What the driver met at `/drive` immediately after the password:

- **First route shown:** `/drive` — the full driving screen, no intermediate step.
- **Visible controls:** driver-name form, region/units picker, five-row truck
  editor with a confirmation gate, route-preference panel, HOS clock form, a
  motion-lock status banner, the destination search, and Start Route beneath
  all of it.
- **Taps to reach the map:** 0 — the map was the entry screen, but it was
  buried under the setup stack.
- **Taps before a destination could be entered:** 1 (the search box), which
  sat at ~488 px, below the site header.
- **Truck confirmation required:** yes. `profileGate` returned `unconfirmed`
  until the driver tapped "This is my truck", and Start Route was genuinely
  disabled until then with "Confirm your truck first".
- **Voice:** started **muted** on every load (`createVoiceGuidance(..., { startMuted: true })`).
  The driver had to find "Enable voice" to hear anything.
- **Motion blocked destination entry:** yes — `'edit-destination': false` in
  `ACTION_PERMISSIONS`, exempted only during the cold-start setup window.
- **Motion blocked settings:** yes — truck, clocks, preferences and the
  detailed clocks panel were all stationary-only.
- **Passenger Access appeared:** in `LockGate`'s locked state, whenever the
  lock reason was confirmed motion — a "Passenger access" button opening
  `PassengerOverrideDialog`.
- **Passenger declaration existed:** yes — "Only a passenger may use this. I
  am not the driver of this vehicle."
- **Press-and-hold override existed:** yes — a 2,000 ms hold granting 15
  minutes of unrestricted use, revoked by a stop/start cycle.
- **Theme behaviour:** night only. The day palette shipped complete but
  dormant behind `[data-theme='day']`; nothing set the attribute.
- **Stored truck behaviour:** restored across visits through
  `truck-storage`, honoured only while its fingerprint still matched.
- **Active-trip restore:** a `sessionStorage` snapshot, restored on mount
  through the lifecycle's own `plan()` with the payload pre-armed — no
  provider re-spend.
- **Start Route behaviour:** one tap owning location permission, a wait for a
  usable fix, one validated route, then navigation (pausing at the flight
  briefing when the route carried warnings).
- **Route-request count:** one per Start attempt; zero on page load.
- **Location-permission timing:** requested by the Start tap. A watch could
  also resume on load, but only when the Permissions API positively answered
  `granted`.

## The approved new journey

After the password/access gate:

```
/drive              →  START DRIVING · PLAN MY TRIP · SETTINGS
/drive/navigate     →  the Navigator map (what /drive used to be)
/drive/settings     →  truck, clocks, voice, display, units, prefs, name, reset
```

Both children sit under the `/drive` prefix already in
`PROTECTED_NAVIGATOR_PREFIXES`, so splitting the surface did not split the
lock, and each page still carries its own `requireNavigatorAccess` call.

Measured after the change:

| Viewport | Launcher height | Before | Delta | Button heights |
| --- | --- | --- | --- | --- |
| 360x740 | 2,101 px | 7,654 px | −5,553 px | 126/126/154 |
| 390x844 | 2,057 px | 7,590 px | −5,533 px | 126/126/126 |
| 430x932 | 2,021 px | 7,242 px | −5,221 px | 126/126/126 |
| 844x390 | 1,485 px | 6,292 px | −4,807 px | 98/98/98 |
| 932x430 | 1,485 px | — | — | 98/98/98 |
| 1280x800 | 1,249 px | 6,056 px | −4,807 px | 98/98/98 |

## Scope

- A three-button launcher at `/drive`, with no setup form and nothing that
  can request a location, a route, a search or speech on load.
- The driving surface moved to `/drive/navigate`, unchanged in what it does.
- One Settings surface at `/drive/settings`, reusing the existing editors
  against the existing storage authorities.
- The shipped standard truck loaded automatically, confirmed, with a
  one-time notice stating the height and the weight.
- Voice preference (default On) and display mode (Automatic/Night/Day) as
  device-local versioned records.
- Passenger access removed entirely; motion-based editing locks removed.
- Tests, mutations, a six-viewport bench, and this record.

## Non-goals

No route-algorithm change, no new HERE parameters, no map-provider change,
no parking work, no sponsor or Founder Wall work, no SEO content, no database
change and no migration. The camera discipline (pan, route overview, basemap
switch) is deliberately untouched.

## Storage decisions

Three new records, each with its own key behind its own parser, through the
existing `versioned-storage` envelope — so a damaged one costs only itself:

| Key | Shape | Default when absent |
| --- | --- | --- |
| `tlws-navigator-voice-v1` | `{ enabled: boolean }` | On |
| `tlws-navigator-display-v1` | `{ mode: 'automatic' \| 'night' \| 'day' }` | Automatic |
| `tlws-navigator-standard-notice-v1` | `{ seen: boolean }` | not seen |

All three are device-local: never synced to an account, never sent to a
provider, never included in a diagnostic payload. The voice record stores a
strict boolean, because a truthy `"false"` string is exactly how a stored
"off" turns itself back on.

The four synced records (truck, route preferences, clocks, briefing) are
unchanged, but their **sync nudges moved with their editors** to the settings
surface. Leaving the nudges behind would have left a driver's second phone
quietly stale — a silent failure, the worst kind.

## The motion-editing decision

Owner decision: **editing is never disabled because of motion.** Every
editing action in `ACTION_PERMISSIONS` is now `true`, and the surfaces that
matter most — the launcher and Settings — mount no safety-lock provider at
all, so motion cannot reach them even in principle.

What replaces the lock is a sentence at the top of Settings:

> Only make changes when safely parked.

It is a `role="status"` region. It has no button, no timer, no
acknowledgement and no countdown, and it disables nothing. The harness
asserts all of that, because "informational" is exactly the property that
erodes.

**What did NOT change:** the camera. `pan-map`, `route-overview` and
`change-map-style` remain stationary-only. Those are not edits — they point
the driver's attention at somewhere they are not — and follow mode is
unchanged with them. Every other motion-dependent system is untouched: map
matching, off-route detection, rerouting, arrival, camera behaviour, route
progress, speed display, HOS progression and safety warnings all still read
GPS exactly as before. What was removed is motion-based *UI restriction*, not
navigation intelligence.

## Passenger access removal

Removed in full: the `PassengerOverrideDialog` component, the 2,000 ms hold,
the 15-minute grant, the countdown banner, the in-memory override log,
`grantOverride` on both the controller and the provider, `OVERRIDE_DURATION_MS`,
the override fields on `SafetyLockState`, and every line of copy.

The `SETUP_WINDOW_PERMISSIONS` exemption map was **deleted rather than
emptied**. Its only grant — destination entry during a cold start — is now
the ordinary rule, and an empty second permission map beside the real one is
a place for a future exemption to hide.

Why it went: the override asked whoever was holding the phone to declare they
were not driving. A parked driver whose GPS died under a truck-stop canopy
got the same question, and it has no honest answer. An app that makes a
driver lie to it in order to change their own destination has already lost
the argument — and the lock cost the honest driver while the other one simply
tapped through.

## Active-trip behaviour

Opening Settings or the planner mid-trip cannot destroy the trip, and that is
structural rather than remembered: `/drive/settings` mounts no lifecycle, no
GPS provider and no route port, so there is nothing there that could cancel
or re-plan anything.

Leaving the driving screen **flushes the snapshot before the cancel**. The
order is the whole fix — cancelling first would move the machine into
`completed`, and `completed` is the state whose job is to delete the
snapshot. Returning through START DRIVING restores through the lifecycle's
own front door with the payload already armed: no network, no provider spend,
every transition invariant intact.

Routing-critical edits made during a trip are saved for the **next** route,
and the driver is told so:

> Saved. This change applies to your next route.

Display and voice changes apply immediately and spend nothing.

A `route-ready` plan is deliberately *not* flushed — it is not an active
state — so a driver who plans, goes to Settings to change the truck, and
comes back gets a fresh plan for the truck they just saved. The old
`discardRoute` call that used to enforce this is gone because the situation
it guarded can no longer arise.

## Theme behaviour

One authority: `DisplayModeProvider`, mounted in the `(navigator)` route-group
layout so it survives navigation between all three surfaces and holds exactly
one `matchMedia` subscription for the whole session.

- **Automatic** follows `prefers-color-scheme`. No sunset maths, no location,
  no stored time or place — the driver's phone already knows the answer they
  chose for every other app they own.
- **Night** is `:root` itself, so night is the *absence* of `data-theme`.
- **Day** sets `data-theme="day"`, activating the palette that shipped
  complete and dormant.

The basemap is **not** re-themed. OpenStreetMap publishes day tiles and there
is no night tile set behind them; inverting or dimming them would repaint
roads into something a driver could mistake for information. The existing
mild desaturation is identical in both modes. What follows the theme is the
colour of the void behind the tiles, applied with `setPaintProperty` — no
`setStyle`, so no remount, no camera touch, no route redraw.

## Voice behaviour

Default **On**, reversing the previous decision. A driver looking at the road
is exactly the person who needs to be told about a turn out loud, and "off
unless you went looking" meant most drivers drove in silence without ever
deciding to.

"Default on" means the *preference* is on — not that anything speaks on page
load. Browsers refuse speech that no user gesture started, so the unlock
moved to the **START DRIVING tap**: the one gesture every driver makes, and a
better one than a mute button they had to hunt for. The driving screen then
unmutes silently, because the launcher already spoke the confirmation.

An explicit Off is remembered forever; only the *absence* of a record takes
the default. A browser that cannot speak says so once and stops:

> Voice could not start. Turn it on in Settings.

No retry loop, no modal, and no microphone — the voice path contains no
recognition or recording API of any kind.

## Known, not fixed here

At 200% text zoom the **document** overflows horizontally on narrow phones —
76 px at 360, 46 px at 390, 6 px at 430, 348 px at 1280. The offender is the
shared site header's collapsed mobile-nav dropdown
(`nav.absolute right-0 top-12`), which renders 512 px wide at that text size.
It is present on every page of the site and predates this milestone. Fixing
site chrome is outside a bounded Navigator change, so the bench measures and
reports it rather than tolerating it silently, and asserts instead that the
launcher's own content fits and stays unclipped.

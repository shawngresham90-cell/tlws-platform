# Navigator Observability — audit, schema, and the decision that is yours

**Nothing in this document has been switched on.** It delivers a schema, a
port, an in-memory implementation, a privacy analysis, and one decision the
owner has to make. No database, no vendor, no secret, no environment
variable, no retention policy, no network call.

---

## Part 1 — What exists today

Verified against the code on 2026-08-10.

| Mechanism | What it captures | Where it goes | Lives for |
|---|---|---|---|
| **Pilot debug log** (`pilot-mode`) | 500-entry ring buffer of event + detail strings, every one coordinate-redacted before storage | Memory. Rendered on screen in the report. | The page |
| **Road-test report** (`road-test-report`) | The session as prose — build id, trip summary, voice and wake state, the driver's note | Clipboard, and the screen | Until the driver pastes it |
| **Diagnostic snapshot** (`diagnostic-snapshot`) | One instant as structured fields — an allowlist of categories, bounded numbers, short identifiers | Clipboard, and the screen | Same |
| **Post-trip feedback** (`post-trip-feedback`) | The driver's answers | Clipboard | Same |
| **Route API diagnostics** | Last provider outcome bucket, last provider HTTP status, sanitized response *shape* — counts and field names, never values | Returned in the API response | One warm serverless instance |

### Three things this audit establishes

**1. The Navigator surfaces emit no analytics and write no logs.** Not one
`trackEvent`, not one `console.*` anywhere under `src/components/navigator`,
`src/lib/navigator`, or `src/app/(navigator)`. A test in this PR pins that.

**2. There was exactly one exception, and it fired at the worst moment.**
A render crash on the driving screen fell through to the *site-wide* error
boundary, which calls `trackEvent('app_error', { digest })` — dispatching to
Plausible, GTM's dataLayer, and Vercel Analytics if any is present. It is only
the digest, and it is a no-op when no vendor is loaded. But it meant the one
event a Navigator session could send to a third party was the one it sent
while a driver's navigation had just died.

That boundary also offered the driver links to the Knowledge Center, the
Practice Tests and the Directory.

**This PR adds `src/app/(navigator)/error.tsx`**, which takes precedence for
every Navigator route: no vendor dispatch, no marketing links, and copy that
says navigation has stopped and the route is gone. See Part 4.

**3. Nothing survives the tab.** No trip history, no route archive, no event
store. Every mechanism above is memory or clipboard. That is the current
privacy position, and it is a strong one — it is also why nobody can answer an
ordering question about a road test.

### What none of it can answer

Every mechanism above is either **prose** or a **single instant**. The
questions that a pilot actually generates are sequence questions:

- Did the reroute request go out *before* or *after* the position degraded?
- How many searches failed before the driver gave up?
- Was voice ever unlocked at all, or did the driver skip the tap?
- Did the off-route detector confirm once, or six times in ninety seconds?

A snapshot cannot answer any of those, and a driver's memory at a truck stop
after a ten-hour day is not evidence.

---

## Part 2 — The schema

`src/lib/navigator/pilot-events.ts`. **26 events**, one shape.

```ts
type PilotEvent = {
  v: 1;
  name: PilotEventName;      // one of 26, closed set
  tSec: number;              // seconds since session start — NEVER wall clock
  build: string;             // 7 hex characters, or 'unknown'
  lifecycle: LifecycleCategory;
  gps: GpsHealthCategory;
  network: NetworkCategory;
  reason: string | null;     // from this event's fixed vocabulary, or null
  count: number | null;      // bounded at 999
};
```

### The events

| Group | Events |
|---|---|
| Session | `navigator-session-start` · `pilot-authorized` · `session-expired` |
| Voice | `voice-enabled` · `voice-unavailable` |
| Destination | `destination-search-request` · `destination-search-success` · `destination-search-failure` |
| Route | `route-request` · `route-ready` · `route-rejected` · `navigation-start` |
| Off route | `off-route-confirmed` · `reroute-request` · `reroute-rejected` · `reroute-ready` · `reroute-failed` |
| Health | `gps-degraded` · `gps-recovered` · `provider-unavailable` · `network-offline` · `network-recovered` |
| End | `arrival` · `problem-report-created` · `feedback-completed` · `fatal-error` |

### Three load-bearing design choices

**Relative time only.** `tSec` is seconds since the session began. A stream
with wall-clock timestamps would publish where a driver was at 3 a.m. even
with no coordinate in it, because *a route plus a clock is a location*. The
road-test report already made this choice; the schema matches it rather than
inventing a second posture.

**No free text, anywhere.** Every reason comes from a fixed vocabulary per
event, and an unrecognised value becomes `'other'` rather than passing
through. A free-text field is where a road name, an address, or a provider
error containing a URL eventually ends up.

**Events with no vocabulary carry no reason.** Not `'other'` — `null`. If a
reason was never designed for an event, supplying one is a caller error and
the strict answer is to drop it.

The reason vocabularies deliberately reuse enums that already exist in the
codebase — the reroute refusals, the provider outcome buckets, the validation
verdicts — so a stream reason and a snapshot reason are the same word and can
be read side by side.

---

## Part 3 — Privacy analysis

### What cannot be in an event, structurally

There is no field a coordinate could occupy. No field for a road name, an
address, a place name, a destination, a driver's name, a provider payload, a
URL, a header, or a credential. The factory's input type is deliberately
narrow, so a caller cannot pass a provider response "in case it helps" —
there is nowhere to put one.

This is the same inversion the diagnostic snapshot uses. A redaction pass can
only remove what it recognises; **an allowlist cannot emit what it was never
given.**

### The belt to that braces

`checkEventPrivacy()` scans every string value on the way out for five
forbidden shapes — a coordinate, a secret-shaped run of 32+ characters, a
credential keyword, a URL, an email address — and the in-memory sink
**refuses to store** an event that fails, incrementing its drop counter so
the refusal is visible rather than silent.

That check is redundant today by construction. It exists so that a field
added six months from now without thinking is caught by a test rather than by
a driver reading their own latitude out of a pasted report.

### Residual risk, stated honestly

An event stream is **not** anonymous even with no coordinate in it. Given a
known route and a known departure, a sequence of relative timings is a
fingerprint of a drive. That is inherent to sequence data and no schema
choice removes it. It is bounded here by three things: the stream never
leaves the device, it dies with the tab, and it contains no destination.

**If persistence is ever switched on, that third bound is the one that
matters.** A persisted stream tied to a session identifier tied to a
destination is a trip history, whatever the field names say.

---

## Part 4 — The crash boundary

`src/app/(navigator)/error.tsx`, new in this PR. Five promises:

| It never | Because |
|---|---|
| Claims the route survived | A reset re-mounts the screen with no route and no destination. The copy says **"Your route is gone"** in a bordered block, not in a footnote. A boundary offering "Try again" while implying the trip continued would be the most dangerous screen in the app. |
| Fabricates guidance | It knows nothing about where the truck is and does not pretend to. No route, no maneuver, no "continue on your current road". |
| Shows the raw error | Only Next's digest, which is an opaque server-side identifier. An error message can carry internals, a URL, or a provider payload; a digest cannot. |
| Reports telemetry | No vendor dispatch. The digest is rendered for the driver to copy instead. |
| Sends the driver to marketing | The only two actions are "Start a new session" and "Reload the driving screen". |

It shows the build id through the same whitelist as the pilot strip, so the
identifier on the crash screen and the one on the driving screen can never
disagree — and a crash report can still name its build.

---

## Part 5 — ⚠ OWNER DECISION MEMO

### The decision

**Should Navigator persist pilot events, and if so, where?**

Not made here, deliberately. Every option below crosses at least one line the
overnight brief put out of bounds: a new database, a new vendor, a new
secret, a new environment variable, a retention policy, or a paid service.

### The options

| Option | What it costs | What it buys | Crosses |
|---|---|---|---|
| **A. Nothing changes** | Nothing | Ordering questions stay unanswerable | — |
| **B. In-memory only, summary in the report** | One wiring change to the driving screen | "Four reroute requests, three rejected for `unsafe-reversal`" appears in the report the driver already sends. Answers most ordering questions for a 2–3 driver pilot. | Nothing. `summarizeEvents()` and `eventSummaryLines()` are built for exactly this. |
| **C. Persist to the existing Supabase project** | A table, a migration, a retention policy, a privacy position, and RLS | Cross-session analysis. Trends across drivers. | **DB migration + retention policy** |
| **D. A telemetry vendor** | An account, a key, an environment variable, a data-processing relationship, and a monthly bill | Dashboards, alerting | **New vendor + new secret + paid service** |

### The recommendation, for what it is worth

**Option B.** At two to three drivers, the bottleneck is not storage — it is
that the report a driver already sends does not carry the sequence. A summary
appended to that report answers the questions above with no store, no
retention decision, and no new privacy surface. It is also the only option
that can be built without asking anyone's permission.

Option C becomes interesting at a wave large enough that you cannot read
every report personally. That is not this wave, and the Wave 1 gate caps it
at three drivers precisely so it does not become that wave by accident.

### What was built, so that B is a small decision later

- The schema and its 26 events.
- `PilotEventSink` — a port, not an implementation, because choosing a
  destination is the owner's decision.
- `createMemoryEventSink()` — bounded ring buffer, persists nothing,
  transmits nothing, reaches no store.
- `summarizeEvents()` / `eventSummaryLines()` — the session as counts, in the
  same line format the road-test report already uses, so it can be appended
  without inventing a second format.

**Not wired to the driving screen.** Wiring is one small change, and it
belongs in a PR that can be road-tested — not stacked on top of PR #272,
which owns that file and is waiting on its own road retest.

### If you pick C or D, these must be decided first

1. **Retention.** How long, and what deletes it. "Until we need the space" is
   not a retention policy.
2. **What a driver consented to.** They agreed to drive a pilot. They did not
   agree to a stored record of their driving.
3. **Session identity.** A stable per-driver id turns a bounded stream into a
   trip history. If one is added, that is the decision — not the storage.
4. **Who can read it.** RLS or equivalent, decided before the first row, not
   after.

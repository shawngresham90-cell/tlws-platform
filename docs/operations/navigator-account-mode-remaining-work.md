# Navigator Account Mode — Remaining Work

**Handoff spec. Written at the end of the session that built the account
surface, so the next one starts from the brief rather than from someone's
memory of it.**

Production stays on `NAVIGATOR_ACCESS_MODE=pilot` throughout. `public` mode
is merged code and must not be enabled or tested in production — see
`navigator-public-beta-cost-audit.md` for why.

---

## Why account mode is the safer opening, not just the nicer one

Worth stating plainly, because it inverts the usual assumption that requiring
a sign-in is a cost rather than a control.

In `public` mode an anonymous script reaches `/api/navigator/route` and
`/api/navigator/destination-search` directly. The only things in its way are
per-IP limiters and a per-process ceiling, and neither survives a caller with
many addresses spread across many warm instances.

In `account` mode the same script has no session, so it reaches nothing
metered at all — **provided every metered endpoint actually checks the
session server-side.** That proviso is the whole point of task 2 below.
Gating the Navigator *page* protects nobody: the page is not what spends
money, and an attacker does not use the page.

---

## 1. Wire sync into the real save and restore flows

**Built and tested already:** `src/lib/navigator-account/state-sync.ts` (pure
policy — newer wins per domain, ties change nothing, a cloud payload from a
newer build is refused) and `src/components/navigator/sync-client.ts` (reads,
writes, and the re-read-before-write that survives the debounce race).

**Not done:** nothing calls them on a real save. `DrivingScreen` still reads
and writes only `versioned-storage`.

Wire the four domains — truck profile, route preferences, driver-entered HOS
clocks, onboarding state — through to the account, and hold these:

- **Local first, always.** The local write completes before any cloud write
  is attempted, and the local record stays complete on its own.
- **Debounced cloud writes** (`SYNC_DEBOUNCE_MS`), with the existing backoff.
- **A cloud failure never blocks starting a route.** `syncFailureBlocksDriving()`
  returns false and is named so a caller has to argue with it.
- **No sync UI on the driving surface.** Status and retry live on the Account
  screen only.
- **Restore on first verified sign-in** using `reconcile()`: cloud empty +
  local present uploads; local empty + cloud present downloads; both present
  resolves per domain by `updated_at`.
- **Nothing location-shaped syncs.** The four domains are the whole list and
  the database enforces it with a check constraint.

**Do not disturb:** Fast Start behaviour from PR #321 (`6b81913`) — one truck
summary, independent route preferences, fast access to destination and Start,
optional HOS clocks — the 60-second stationary GPS-loss grace, the
real-movement safety lock, or the rule that a parked driver is never asked to
declare they are a passenger.

**Do not alter routing or HERE request behaviour in this task.**

---

## 2. Every metered endpoint must check the session server-side

> ### 🐞 A DEFECT FOUND WHILE VERIFYING THIS, 2026-08-16
>
> **Neither metered endpoint passes `signedIn` to `navigatorApiAccessVerdict`.**
> Both call it with `flagEnabled`, `mode` and `tokenValid` only:
>
> ```ts
> const accessVerdict = navigatorApiAccessVerdict({
>   flagEnabled: true,
>   mode,
>   tokenValid: mode === 'pilot' ? await requestHasPilotAccess(req) : false,
> });
> ```
>
> In account mode the verdict function reads `input.signedIn === true`, which
> is `undefined`, so it returns `'unauthorized'` **unconditionally** — for a
> legitimately signed-in driver as much as for an anonymous script.
>
> **This fails CLOSED, so it is not a security hole.** An anonymous caller is
> refused, which is the required behaviour. But it means account mode is
> functionally broken above the page layer: a signed-in driver reaches
> `/drive` and then cannot search a destination or plan a route, because both
> endpoints 401.
>
> It is also the exact reason the brief's instruction matters — the page gate
> passed while the API gate did not, and only reading the endpoints revealed
> it. A page-level test would have shown account mode working.
>
> **The fix is not just passing the flag.** These are Node route handlers, so
> they must verify the session server-side against Supabase (`getUser()`, not
> `getSession()` — the latter trusts what it decodes), and that verification
> has to happen before any limiter token, provider budget or configuration
> probe, exactly as the existing rails are ordered.


Audit and then prove, endpoint by endpoint:

| Endpoint | Must verify |
|---|---|
| `POST /api/navigator/route` | Supabase session, server-side, in account mode |
| `GET /api/navigator/destination-search` | same |
| Any reroute path that reaches a provider | same |

The page gate is not sufficient and is not evidence. What is evidence: a test
that calls each endpoint with **no session** in account mode and asserts it is
refused before any provider call, limiter token, or configuration probe.

---

## 3. The usage guard

Everything below is new work. The existing limiters stay; these sit on top.

**Per-user request limits.** Keyed to `auth.uid()`, not to an IP. An IP is
shared by a whole carrier's NAT and split across towers by one moving truck;
a user id is the only key that means one driver.

**Reroute and repeated-request controls.** Bound how often one session can
ask for the same thing. Today's reroute budgets are per device and in memory.

**A centralized atomic monthly usage guard.** In Supabase, or another shared
store — the requirement is that it works **across all serverless instances**,
which is precisely what every current limiter does not do. Increment and
check must be atomic (a Postgres function returning the post-increment count,
not read-then-write from the app).

**A configurable safety threshold below the HERE monthly allowance.** An
environment variable, set below the documented allowance, not equal to it —
the margin is what leaves room to notice and react.

**Fail closed at the threshold.** Metered endpoints refuse with a clear
message. Refusing service is recoverable; an unbounded bill is not.

**Admin usage reporting.** Current month against the threshold, visible in the
admin area, so the number is knowable before it matters rather than after.

---

## 4. What must NOT be claimed about HERE

**Do not describe HERE dashboard alerts as a guaranteed hard spending
ceiling.** An alert that notifies is not a control that stops requests, and
writing it up as one would put a false backstop in the record — exactly the
kind that gets relied on.

Document instead, as owner actions:

1. Shawn configures **usage alerts** in the HERE dashboard.
2. Shawn **asks HERE directly** whether his plan supports an **enforceable
   account-level quota** that refuses requests past a limit.

Until HERE confirms enforcement, the centralized guard in task 3 is the only
thing that actually stops spend, and it should be described that way.

---

## 5. Gates before production leaves `pilot`

All six, not a majority:

1. Sync wiring complete and tested.
2. Custom SMTP and authenticated sender domain confirmed.
3. Migrations `049` and `050` reviewed and applied.
4. Terms and Privacy updates reviewed.
5. Real-phone tests pass.
6. Centralized usage guard and provider alerts active.

---

## Standing constraints for the next session

- Draft PR with preview and evidence. **Do not merge.**
- **Do not** apply production migrations.
- **Do not** change production environment variables.
- **Do not** deploy account mode.
- **Do not** enable or test `public` in production.
- Do not weaken an existing safety assertion to get a green run. One already
  caught a mistake in this work — the no-logging rule in the Navigator
  surfaces — and it was right both times.

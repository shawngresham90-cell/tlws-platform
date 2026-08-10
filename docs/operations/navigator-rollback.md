# Navigator Rollback — Procedure and Drill Record

**What you do when the build that is live is the problem.**

Two halves. The first is the procedure, written to be followed rather than
studied. The second is the record of a drill actually performed on
2026-08-10, including the three steps that were **not** performed because
performing them would have touched production.

---

## Part 1 — The procedure

### 0. Before anything: what kind of problem is this?

| If | Then |
|---|---|
| A confirmed P0 from the stop policy | Stop the pilot first, roll back second. Drivers stop being at risk the moment you send the message; the rollback takes a build cycle. |
| Navigator is broken but the rest of the site is fine | Feature-disable, not rollback. It is smaller and it is reversible. |
| The whole site is broken | Rollback. |
| You are not sure what changed | **Do not roll back yet.** Preserve evidence first (step 3). A rollback destroys the state you need to reproduce the bug. |

### 1. Identify the bad build

Ask the driver for the **build strip** — the short sha on screen. Do not
infer it from what you think is deployed; a failed deploy leaves an older
build serving, and the strip is the only thing that knows.

If the strip says `unknown` where a sha belongs, the deploy did not inject
`COMMIT_REF`. That is its own defect: reports from that build cannot name
what they ran on, and the pilot should pause until it is fixed.

### 2. Stop new pilot use

Send one message to every pilot driver: *stop using Navigator for guidance,
finish the trip on your own knowledge or another device.* Do not wait for
the technical fix to send it.

If you need to enforce it rather than ask for it, **change
`NAVIGATOR_PREVIEW_PASSWORD`.** Every issued pilot cookie is
`v1.<issuedAt>.<hmac>` signed with that password, so changing it makes every
outstanding session fail verification at the next request. It is the fastest
access stop available and it needs no code change.

### 3. Preserve the evidence — before you deploy anything

Once you redeploy, the failing build is gone and so is the ability to
reproduce it.

- The driver's **problem report** (category + note + build id), copied out of
  the app.
- The **diagnostic snapshot**, if the driver can still open the app.
- Photographs of anything posted on the road — a clearance sign, a
  restriction, a closed ramp.
- The road, the direction of travel, the approximate time, and the weather.
- Which phone and which browser.

Write down the **short sha of the bad build** next to all of it.

### 4. Identify the known-good target

Open the release register. Take the newest row graded **KNOWN-GOOD**.

If there is no KNOWN-GOOD row — which is the case today — take the newest
**CANDIDATE** and understand exactly what you are accepting: it has offline
evidence only. Nobody has driven it. Roll back to a candidate only when the
alternative is leaving a known-bad build live.

The register also lists what each rollback gives up. Read that line before
you pull the trigger, not after a driver asks where a feature went.

### 5. Choose ONE: feature-disable, or deployment rollback

| | Feature-disable | Deployment rollback |
|---|---|---|
| **Use when** | Navigator is the problem; the rest of the site is fine. | The build is broken beyond Navigator, or the Navigator defect is in shared code. |
| **How** | Set `NEXT_PUBLIC_NAVIGATOR_ENABLED` to anything other than `true`, then **redeploy** — the value is inlined into the bundle at build time, so changing it in Netlify without a rebuild changes nothing. | Netlify → Deploys → find the target deploy → **Publish deploy**. Instant. Or revert the commit on `main` and let auto-deploy build it. |
| **Effect** | `/drive`, `/navigator` and both Navigator API routes return 404. The marketing site, the directory, the planner and the tools are untouched. | Everything returns to the target build. |
| **Reversible by** | Setting the flag back and redeploying. | Publishing the newer deploy again. |

The two are not exclusive in an emergency — disabling the feature *and*
rolling back is fine. But do them in that order, because the flag change
takes effect on the next successful build, and a rollback gives you one.

### 6. Verify the production state you expect

Do not trust the deploy log. Open the site yourself:

1. The homepage loads.
2. The Navigator tile behaves as expected for the state you chose — present
   if you rolled back, gone if you feature-disabled.
3. If Navigator should be live: enter the pilot password, reach `/drive`, and
   **read the build strip**. It must show the sha you rolled back to. If it
   shows the old one, the deploy did not take.
4. If Navigator should be off: `/drive` returns a 404 page, not a password
   prompt. A password prompt means the flag is still `true`.

### 7. Smoke tests

The short list, in order, all from a stopped truck or a desk:

- [ ] Homepage loads; Navigator tile in the expected state.
- [ ] `/drive` behaves per step 6.
- [ ] Password screen accepts the current password and lands on `/drive`.
- [ ] A wrong password is refused.
- [ ] Destination search returns results for a known place.
- [ ] A route plans, and the map draws it.
- [ ] The build strip shows the expected sha.
- [ ] Problem report generates and copies.
- [ ] `npm test` is green on the deployed sha (run it locally against that
      commit — this is the only step that needs a computer).

### 8. Document the incident

One entry, in `docs/operations/`, dated. What the driver saw, what the build
was, what you did, what the evidence showed, and — the part everyone skips —
**what would have caught it earlier**. No coordinates, no PII.

Add a row to the release register for the state you are now in.

### 9. Do not reopen the pilot until the resume gates pass

The stop policy's condition carries its own `resume` line. For most P0s that
means: a fixture reproduces it, fails on the shipped build, passes on the
fix, and the owner re-drives it. "It seems fine now" is not a resume
criterion.

---

## Part 2 — Drill record, 2026-08-10

A rollback drill run to the edge of what can be done without touching
production. Performed where safe, reported where not.

### Performed

| # | Step | Method | Result |
|---|---|---|---|
| 1 | Identify current production sha | `git rev-parse origin/main` | `b6a1260a17e9f01c007782791c0a28f8bf08b55c` → `b6a1260` |
| 2 | Identify rollback target | Previous commit on `main` | `94fc6591707fa6e1cc2a335cd660ce393a9ec749` → `94fc659` |
| 3 | Check out the target in isolation | `git worktree add --detach <tmp> 94fc659` | Clean checkout, production tree untouched |
| 4 | Prove the target still passes its own tests | `node scripts/run-tests.mjs navigator` at the target | **22 Navigator harnesses, all passed** |
| 5 | Prove the target still builds | `npm run build` at the target | **Build succeeded** — all routes emitted, middleware bundled |
| 6 | Prove the build label a rollback would show | `resolveBuildId({ commitRef: '94fc659…', context: 'production' })` | `pilot 2.0 · 94fc659 · production · <build time>` — this is the string the driver would read back to you |
| 7 | Prove the feature-disable lever actually disables | Full production build of `origin/main` with `NEXT_PUBLIC_NAVIGATOR_ENABLED` unset, served locally, every Navigator surface requested | See the flag-state matrix below |
| 8 | Prove the gate holds on an enabled build | Same tree built with the flag on, served locally with and without a pilot password configured | See the flag-state matrix below |

### Flag-state matrix — measured, not assumed

Three real production builds of `origin/main`, served by `next start` on
localhost and probed over HTTP. Placeholder Supabase values were used because
the middleware constructs a Supabase client on every request; they point at an
invalid host and reach nothing. **No production system was touched.**

| Request | Flag **unset** (feature-disabled) | Flag `true`, **no password** configured | Flag `true`, password configured, **no cookie** |
|---|---|---|---|
| `GET /` | `200` | `200` | `200` |
| `GET /drive` | **`404`** | `307` → `/navigator/access?next=%2Fdrive` | `307` → `/navigator/access?next=%2Fdrive` |
| `GET /navigator` | **`404`** | `307` → access | `307` → access |
| `GET /navigator/access` | `200` | `200` | `200` |
| `POST /api/navigator/route` | **`404`** `not-enabled` | **`401`** `pilot-access-required` | **`401`** `pilot-access-required` |
| `GET /api/navigator/destination-search` | **`404`** `not-enabled` | **`401`** `pilot-access-required` | **`401`** `pilot-access-required` |

Three things this establishes, which were previously assumed:

1. **The feature-disable lever really disables.** With the flag unset, every
   Navigator page and both Navigator APIs are gone — a 404, not a password
   prompt — while the rest of the site serves normally. The API answers
   `not-enabled`, so nothing can mistake a disabled deploy for an outage.
2. **A misconfigured deploy fails closed.** Flag on but no password set: the
   pages redirect to a password screen that can never succeed, and both APIs
   answer 401. It does not fall open.
3. **`/navigator/access` stays reachable in every state**, including when the
   feature is disabled. That is by design — gating the password screen behind
   the password would loop — but note the consequence: **feature-disabling
   Navigator does not hide the fact that a pilot exists.** If concealment is
   the goal, feature-disable is not the tool.

### Gate probe — the same build, attacked

With the flag on and a password configured, a valid cookie was minted
locally and eleven malformed ones were presented to a Navigator API:

| Cookie presented | Result |
|---|---|
| Forged MAC (64 zeroes) | `401` |
| MAC signed with a different password | `401` |
| Valid MAC, tampered `issuedAt` | `401` |
| Correctly signed but 13 hours old (limit is 12) | `401` |
| Correctly signed but 10 minutes in the future | `401` |
| `v2.` version prefix | `401` |
| No dots / four parts / non-numeric `issuedAt` / empty | `401` (all) |
| Percent-encoded RTL-override characters | `401` |
| 20,000 characters | `431` — rejected before the app sees it |
| **Correctly signed, current** | **`200` on `/drive`** — the only thing that works |

Neither the homepage nor the access page contained the password or any
secret-shaped value.

**One thing the probe could not reach.** With no `HERE_API_KEY` in the drill
environment, the search and route endpoints answer
`503 provider-not-configured` *before* input validation runs — the
configuration check is deliberately ordered ahead of it so a keyless deploy
says so plainly rather than looking like an empty result. That means query
length, coordinate range, and body-shape validation were **not exercised
live** here; they are covered offline by the destination-search and route-API
harnesses instead. Worth knowing so nobody reads the 503 rows as a validation
pass.

### NOT performed — owner authorization required

| # | Step | Why it was stopped |
|---|---|---|
| A | Publish an earlier Netlify deploy | This is a **production mutation**. It changes what every visitor gets. It is also not reachable from this repository. **OWNER AUTHORIZATION REQUIRED.** |
| B | Change any Netlify environment variable | Includes `NEXT_PUBLIC_NAVIGATOR_ENABLED` and `NAVIGATOR_PREVIEW_PASSWORD`. Changing either affects live drivers. **OWNER AUTHORIZATION REQUIRED.** |
| C | Revert a commit on `main` | Auto-deploy would build and publish it. **OWNER AUTHORIZATION REQUIRED.** |
| D | Confirm what is actually deployed right now | Netlify's state is not readable from here. The register records `b6a1260` as the newest commit on `main`, **not** as a confirmed production deploy. Owner confirms by reading the build strip. |

### Unverified — one question worth five minutes of your time

**Does changing `NAVIGATOR_PREVIEW_PASSWORD` in Netlify take effect on the
already-deployed functions, or does it need a redeploy?**

It matters because that variable is the fastest access stop in the whole
system — if it takes effect immediately, you can revoke every pilot session
in under a minute without a build. The code reads it per call
(`configuredPassword()` reads `process.env` inside the function, not at
module load), so the answer depends entirely on how Netlify serves env
changes to a deployed function, which cannot be established from this
repository.

**Test it once, deliberately, before you need it:** change the value, wait a
minute, and try an existing pilot cookie without redeploying. Record the
answer in the release register. Do it on a day when nobody is driving.

### What the drill did not prove

- That the rollback target *navigates*. It compiles and its fixtures agree
  with it. Nobody has driven `94fc659`. It is graded CANDIDATE for that
  reason and the register says so.
- That Netlify still holds a publishable deploy for the target sha. Deploy
  retention is a Netlify setting, not a repository fact. **Check that a
  publishable deploy for your intended rollback target still exists — before
  you need it.** A rollback plan whose target has been garbage-collected is
  not a rollback plan.

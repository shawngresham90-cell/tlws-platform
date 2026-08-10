# Navigator Pilot Release Register

**What is deployed, what is known good, and what you roll back to.**

One page, kept by hand, in the repository. No database — a rollback register
that lives in the system it is supposed to rescue is not a rollback register.

`scripts/test-navigator-stop-policy.ts` checks this file's structure: every
row that claims KNOWN-GOOD must carry evidence and a verification date, and
the build labels must match what `resolveBuildId` would actually render. A
row cannot quietly promote itself.

---

## Reading the evidence column

| Grade | What it means |
|---|---|
| **KNOWN-GOOD** | Owner ran it in production and it behaved. Requires a date and what was verified. |
| **CANDIDATE** | Offline evidence only — tests and a build. Nobody has driven it. Roll back *to* it only if the alternative is worse. |
| **UNVERIFIED** | No evidence recorded. Not a rollback target. |

**Nothing is promoted to KNOWN-GOOD by a test run.** Tests prove a build
compiles and its fixtures agree with it. Only a drive proves it navigates.

---

## Current state — recorded 2026-08-10

### Production

| Field | Value |
|---|---|
| Production branch | `main` |
| Deployment model | Netlify, auto-deploy on push to `main` (`netlify.toml`; `DEPLOY.md`) |
| Latest `main` commit | `1ee4932aa4a70925f5e6424e9f396ed6691b4bf6` |
| Short sha (as shown to drivers) | `1ee4932` |
| Commit date | 2026-08-10T12:17:00-04:00 |
| Subject | P0: a replacement route may not imply a truck turnaround, and refusing one is not enough (#272) |
| Expected on-screen build label | `pilot 2.0 · 1ee4932 · production · <build time>` |
| **Actually deployed to production?** | **NOT VERIFIED FROM THIS REPOSITORY.** Netlify state is not readable here. Owner confirms by opening the pilot build strip and reading the short sha. **If the strip shows `b6a1260` or anything older, the deploy predates the #272 merge and has no off-route reversal check** — see the incident playbook, incident 2. |
| Owner verified in production on | *(blank — owner fills)* |

> The build label is derived, not stored: `resolveBuildId` whitelists
> Netlify's `COMMIT_REF` down to seven hex characters and maps `CONTEXT`
> (`production` → `production`, `deploy-preview` → `preview`,
> `branch-deploy` → `branch`, `dev` → `local`, anything else → `unknown`).
> If the strip shows `unknown` where a sha belongs, the build environment did
> not inject `COMMIT_REF` — that is a deployment problem, not a display bug,
> and it means **reports from that build cannot name what they ran on.**

### Rollback target

| Field | Value |
|---|---|
| Target commit on `main` | `94fc6591707fa6e1cc2a335cd660ce393a9ec749` — no longer the commit immediately before the tip; it is the newest commit with drill evidence |
| Short sha | `94fc659` |
| Commit date | 2026-08-09T10:50:32-04:00 |
| Subject | Navigator: the truck on the map wears the TL mark (#271) |
| Evidence grade | **CANDIDATE** |
| Evidence | Rollback drill 2026-08-10: worktree checked out at this sha, **22 Navigator harnesses, all passed**; production build succeeded. No road drive. |
| Owner verified in production on | *(blank — no drive recorded)* |

**What rolling back to `94fc659` gives up** depends on what the running
build contains — read the strip first. From #267: the truck-profile coverage
audit, the route-plausibility advisory, and the truck routing disclosures in
the profile panel. If the running build is `1ee4932` or later it also gives
up the pilot password rate limit (#276) and **the #272 off-route reversal
guard — rolling back a build that contains #272 removes a P0 guard and
re-opens the turnaround defect it exists to stop.** Weigh that against
whatever you are rolling back to escape. It does **not** give up the map
marker, the greeting, the route-start phrase, the diagnostic snapshot, the
problem report, or post-trip feedback; all of those are in `94fc659`.

**What rolling back does *not* undo:** if the running build predates the
#272 merge (strip shows `b6a1260` or older), nothing from PR #272 — no
production deploy recorded here has ever contained it, so there is nothing
to lose.

### Merged, not deployed

| Field | Value |
|---|---|
| PR #272 final head | `1594d01827eddbbbaef3eb0610321fa00cc7b34c` (`1594d01`) |
| Merged into `main` as | `1ee4932aa4a70925f5e6424e9f396ed6691b4bf6` (`1ee4932`), 2026-08-10 |
| State | **Merged**, CI green on the merge commit |
| Status | **READY FOR OWNER ROAD RETEST — NOT YET VERIFIED ON ROAD** |
| Blocks | Wave 1 GO. See the Wave 1 gate. |

---

## Feature-disable levers (faster than a rollback)

| Lever | Effect | Cost of pulling it | Takes effect |
|---|---|---|---|
| `NEXT_PUBLIC_NAVIGATOR_ENABLED` ≠ `true` | `/drive` and `/navigator` 404; both Navigator API routes 404. The rest of the site is untouched. | Navigator is gone for everyone, including you. | **Requires a rebuild.** `NEXT_PUBLIC_*` values are inlined into the bundle at build time — changing it in Netlify without redeploying changes nothing. |
| Change `NAVIGATOR_PREVIEW_PASSWORD` | Every issued pilot cookie stops verifying, because the cookie is `v1.<issuedAt>.<hmac>` keyed by the password. Every driver is bounced to the password screen. | Drivers need the new password; anyone mid-trip loses API access at the next call. | Server-only variable, read per call by `configuredPassword()`. **Whether Netlify serves the new value to already-deployed functions without a redeploy is UNVERIFIED — see the rollback doc.** |
| Revert the commit on `main` | Auto-deploy builds the reverted tree. | A build cycle. | Next successful deploy. |
| Netlify → Deploys → publish an earlier deploy | Instant swap to a previously-built deploy. | None, if the target deploy still exists. | Immediate. **Owner-only action; not performable from this repository.** |

The password change is the fastest *access* stop and needs no build. The flag
is the only *complete* stop, and it needs one.

---

## How to add a row

When you deploy, add a dated block above, and demote the previous one:

```
### <date> — deployed <shortSha>
| Field | Value |
|---|---|
| Commit | <full sha> |
| Subject | <commit subject> |
| Evidence grade | CANDIDATE | KNOWN-GOOD | UNVERIFIED |
| Evidence | what was actually done — tests, build, and any drive |
| Owner verified in production on | <date>, or blank |
| Previous known-good | <short sha of the row you would roll back to> |
```

Rules that the test enforces:

1. A row graded **KNOWN-GOOD** must have a non-blank verification date and a
   non-blank evidence line.
2. Every short sha in this file must be exactly seven lowercase hex
   characters — the same shape `shortCommit()` emits, so a register entry and
   a driver's screen can be compared character for character.
3. The register must always name exactly one rollback target.

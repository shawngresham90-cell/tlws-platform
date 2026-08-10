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
| Latest `main` commit | `b6a1260a17e9f01c007782791c0a28f8bf08b55c` |
| Short sha (as shown to drivers) | `b6a1260` |
| Commit date | 2026-08-09T19:02:47-04:00 |
| Subject | Navigator: audit what the truck profile actually sends, and check the route (#267) |
| Expected on-screen build label | `pilot 2.0 · b6a1260 · production · <build time>` |
| **Actually deployed to production?** | **NOT VERIFIED FROM THIS REPOSITORY.** Netlify state is not readable here. Owner confirms by opening the pilot build strip and reading the short sha. |
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
| Previous commit on `main` | `94fc6591707fa6e1cc2a335cd660ce393a9ec749` |
| Short sha | `94fc659` |
| Commit date | 2026-08-09T10:50:32-04:00 |
| Subject | Navigator: the truck on the map wears the TL mark (#271) |
| Evidence grade | **CANDIDATE** |
| Evidence | Rollback drill 2026-08-10: worktree checked out at this sha, **22 Navigator harnesses, all passed**; production build succeeded. No road drive. |
| Owner verified in production on | *(blank — no drive recorded)* |

**What rolling back to `94fc659` gives up:** everything #267 added — the
truck-profile coverage audit, the route-plausibility advisory, and the truck
routing disclosures in the profile panel. It does **not** give up the map
marker, the greeting, the route-start phrase, the diagnostic snapshot, the
problem report, or post-trip feedback; all of those predate it.

**What rolling back does *not* undo:** nothing from PR #272 — it is unmerged.

### Not deployed

| Field | Value |
|---|---|
| PR #272 head | `2f0df02f522d2e3fb78f252c36e25a86fc897a80` (`2f0df02`) |
| State | Open **draft**, not merged, CI green |
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

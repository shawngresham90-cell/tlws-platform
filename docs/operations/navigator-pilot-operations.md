# Navigator Pilot Operations — start here

Everything you need to run, stop, or roll back the Navigator pilot. Written
for one person on a phone, not for a team with a rota.

## If something is happening right now

| Situation | Go to |
|---|---|
| A driver just told you something alarming | [Stop policy](./navigator-pilot-stop-policy.md) — decide CONTINUE / PAUSE / STOP first |
| The live build is the problem | [Rollback](./navigator-rollback.md) |
| You need to stop everyone, fast | [Rollback](./navigator-rollback.md) → change `NAVIGATOR_PREVIEW_PASSWORD`. It invalidates every issued session and needs no code change |

## Before anyone drives

| Question | Go to |
|---|---|
| What do I test, myself, in the truck? | [Wave 0 road test](./navigator-wave-0-road-test.md) — 63 lines, 20 of them safety-critical |
| Can I hand this to outside drivers yet? | [Wave 1 gate](./navigator-wave-1-gate.md) — currently **🔴 NO GO** |
| What is deployed, and what do I roll back to? | [Release register](./navigator-release-register.md) |

## The standing blocker

**PR #272 has not been verified on the road.** It merged to `main` on
2026-08-10 — merging is not road verification. It fixes three P0-class
conditions found on real drives: a
replacement route implying an unverified truck turnaround, a missed turn that
kept repeating after going off route, and the truck drawn beside the roadway
instead of on it.

Until the owner re-drives the Hwy 92 / Charles Hardy scenario and section 8
of the Wave 0 checklist passes, **Wave 1 is NO GO** — regardless of what
every other gate says.

## Open owner decisions that block a wave

**This is not the complete list of open decisions — it is the subset that
holds a gate shut.** The fuller set, including the ones that are limitations
rather than blockers (the provider vehicle-type parameter, the unmodelled
truck-profile fields, satellite imagery, whether reports persist), lives in
[Known limitations](./navigator-known-limitations.md). Decision 1 below
appears in both, deliberately: it was the one that was both. It has since
been resolved by the owner, and both records mark it so.

| # | Decision | Blocks |
|---|---|---|
| 1 | **Where does a driver send a problem report?** ✅ **Resolved 2026-08-10** — the owner selected `shawngresham90@gmail.com`. Recorded in the driver guide and the known-limitations list, and pinned by test: any other destination in the guide fails the build. | No longer blocking — formerly Wave 1 entry requirement E19 |
| 2 | **Does changing `NAVIGATOR_PREVIEW_PASSWORD` in Netlify take effect without a redeploy?** It is the fastest access stop in the system, and whether it works instantly is not knowable from this repository. Test it once on a quiet day. | Nothing yet — but you want the answer *before* you need it |
| 3 | **Is a publishable Netlify deploy still retained for the rollback target?** Deploy retention is a Netlify setting. A rollback plan whose target has been garbage-collected is not a plan. | Wave 1 entry requirement E9 |

## The rest of the set

All in this folder. Every one of these has merged to `main` except the
observability memo, which is still an open draft (PR #275) — nothing in it
is switched on, and it stays a draft until the owner makes the persistence
decision it ends with. Listed here so this page stays the single entry point.

| Document | Answers |
|---|---|
| `navigator-incident-playbook.md` | 14 incidents, seven questions each: severity, what to tell the driver, posture, evidence, keep using it?, engineering triage, resume when |
| `navigator-driver-guide.md` | What an outside driver reads before their first trip |
| `navigator-known-limitations.md` | The one authoritative list, re-derived from the code by test |
| `navigator-observability.md` | What a session emits today, a privacy-first event schema, and the persistence decision |
| `navigator-provider-volume.md` | How many drivers the routing allowance supports — 42 ordinary, 3 worst case |
| `navigator-accessibility-audit.md` | Surface-by-surface, plus the one audio question that needs a device |
| `navigator-security-probe-2026-08-10.md` | A real build, attacked, and the one defect it found |

## What keeps these documents honest

`scripts/test-navigator-stop-policy.ts` runs in the normal suite and fails the
build if:

- the condition list or any threshold in the stop-policy document disagrees
  with `src/lib/navigator/pilot-stop-policy.ts`;
- a release-register row claims KNOWN-GOOD without a verification date and
  evidence;
- a short sha in the register is not the exact shape the driver reads off the
  build strip;
- the build label a document promises is not the label `resolveBuildId` would
  actually render;
- **anything in the app imports the stop-policy module.** It classifies; it
  does not act. No field report may ever switch off a driver's navigation.

The rest of the set brought its own gates, which run in the normal suite
too: `navigator-pilot-docs` re-derives the limitations list from the request
builder, `navigator-adversarial` feeds hostile strings to every
driver-facing input, `navigator-provider-volume` re-reads every rate limit
from its own source file, and `navigator-state-combinations` drives ten
pairs of real states through the real ports. One gate is still in its draft
PR: `navigator-pilot-events`, which feeds twenty hostile strings through the
observability event schema (#275).

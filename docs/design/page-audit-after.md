# Page Audit — After the Design Foundation Pass

State of each major surface after this PR, scored against the blueprint's
lens (premium feel · trust · clarity · conversion). Scores are directional,
not laboratory numbers; re-run after Plausible has 30 days of data.

| Surface | Before (blueprint est.) | After | What changed | Still open |
| --- | --- | --- | --- | --- |
| Homepage | 5.8 | ↑ strong | Thesis hero + single primary CTA; live proof bar; Four Doors routing with money edges; story strip; stub section removed; S1–S8 order | Real hero photo; confirmed listing count for proof bar |
| Academy landing | 5.6 | ↑ strong | Program journey (real phases); enrollment transparency block; student-fear FAQ (honest answers); credential chips; placard system | Tuition/schedule/licensing values (owner) |
| Application | good | ↑ | First-touch UTM attribution now captured; save-and-resume on device; interruption-safe microcopy | Server-side resume (future, needs owner-approved schema) |
| Dalton SEO page | good | ↑ | Stale "application opens soon" contradiction fixed | — |
| Header/Footer | flat 14-item nav | ↑ | Six-destination nav + grouped menu; footer trust block with real identity + disclosures | GA registration numbers (owner) |
| Directory / Trip Planner | frozen scope | unchanged code | First honest homepage surface via Four Doors ("free tools" door) | Coordinate coverage (frozen); planner nav elevation (owner call) |
| Books | PR #159 scope | untouched | — | #159 review |
| Store | separate workstream | untouched | — | ASINs (owner) |
| Sponsors / Newsletter / Analytics | PR #161 scope | untouched internals | Ranking-honesty line added to footer trust block (verified against ranking.ts) | #161 review |
| ROAD AHEAD | launched (#160) | untouched | Teaser band on homepage repositioned + story beats; amber gradient tokens | — |
| Practice tests / KC | good | consistent cards via shared grids | Score-screen conversion moments (blueprint §3.10) deliberately deferred | Future PR |
| Pre-School | conversion-audited | preserved | Purchase machinery kept verbatim inside Door 1 (placement + tracking intact) | Cross-domain unity (satellite sites, §2.10) |

## Verification pointers

- CTA discipline: homepage now renders exactly one amber button per viewport
  at 375px (hero → doors → bands), two money edges total in the doors grid.
- Every number on the page is live-queried or repo-verified; nothing static
  was invented (see `ProofBar` fail-soft behavior).
- All copy changes fact-checked against the repo: no dates, no credentials,
  no placement claims, no licensing status.

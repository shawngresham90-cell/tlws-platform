# DOT Tools — Vault Export, Migration, Parallel-Run, Redirect & Rollback Plan

Nothing in this document is executed by PR 1. It is the binding plan for the
transition. Hard facts first, because they drive everything:

- **IndexedDB is origin-bound.** The legacy vault database (`rd_vault`)
  belongs to the old Netlify origin. **The new platform cannot silently read
  the old vault — ever.** There is no technical path around this.
- **Redirecting too early strands stored documents.** A driver whose CDL and
  med-card photos live in the old vault loses one-tap access the moment `/`
  301s away, and loses the data permanently if the old origin is retired.
- **Export must be implemented on the old app and tested before retirement.**
  Until then, retirement is prohibited.
- **The old application remains operational during the entire parallel run.**
  (Standing constraint: no old-app changes without separate owner approval.)
- **Redirects are reversible** — they ship as Netlify `_redirects` rules on
  the legacy site, removable in one deploy. Rollback is part of the plan,
  not an afterthought.
- **No silent document loss is acceptable.** Any step that could orphan
  vault data requires the export path to exist, the migration window to
  have elapsed, and explicit owner sign-off.

## Phases

**Phase 0 — now (PR 1):** docs only. Old app untouched, no platform route.

**Phase 1 — build:** `/dot-tools` ships on the platform behind its own PRs
(see `implementation-sequence.md`). Old app untouched and live. No links
from the old app to the new one yet.

**Phase 2 — parallel run:** both live. Plausible events on the new surface
measure adoption. The new app may link to the old vault for legacy users;
the old app still isn't modified.

**Phase 3 — old-app enablement (separate, owner-approved mini-change to the
legacy site; NOT a platform PR):**
1. Vault **Export all** button (spec in `wallet-model-a-spec.md` §3).
2. A banner: "DOT Tools has a new home at truckinglifewithshawn.com/dot-tools
   — your vault documents stay on this device; use Export to move them."
3. Netlify Forms subscriber export pulled by owner.

**Phase 4 — migration window:** starts only when the export path is live
and verified working. **Minimum 60 days** (Owner Decision 4). During the
window `/vault.html` (and the rest of the old app) remains fully
accessible. The window restarts if the export function is found broken.

**Phase 5 — redirects (still reversible):** Netlify `_redirects` 301 map
per the table in `inventory.md` §8. `/vault.html` may redirect **last**, or
be temporarily excluded from the map, if any vault-loss report is open.

**Phase 6 — retirement:** old site archived only when ALL criteria pass:
- 60-day window elapsed since export went live,
- new-surface traffic ≥ old-surface traffic (Plausible vs Netlify analytics),
- zero open vault-loss or export-failure reports,
- Netlify Forms list exported,
- owner sign-off recorded in `decision-log.md`.

## Rollback plan

| Failure | Rollback |
|---|---|
| Platform DOT Tools bug post-launch | Old app is still live — remove the Phase-3 banner text if needed; nothing else to undo |
| Redirects cause user harm / SEO damage | Delete `_redirects` rules, redeploy legacy site (single deploy, minutes) |
| Export function defect discovered in the window | Fix on legacy site; **window restarts**; redirects deferred |
| Vault-loss report after redirects | Un-redirect `/vault.html` immediately; investigate before proceeding |

## Legacy-user data checklist (owner-visible summary)

- `rd_vault` (documents): export/import path — the only bridge. 60-day window.
- `rd_pro` / `rd_meter` (gate state): intentionally not migrated — the gate
  is being removed (see `pro-customer-transition.md` for the humans behind
  `rd_pro`).
- Netlify Forms emails: owner export before retirement.
- Bookmarks/backlinks: 301 map, Phase 5 only.

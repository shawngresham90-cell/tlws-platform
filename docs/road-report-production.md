# The Road Report — weekly production workflow

**Date:** 2026-08-03 · **Base:** `main` @ `721cb36` · **Status:** issue builder complete and inert; nothing can publish or send.

Builds on the Road Report foundation (PR #230): the renderer, approval markers, dry-run transport and send gate. This adds the thing that turns those into a weekly publication — an issue model, the rules that decide whether an issue may go out, and a preview to look at before it does.

**No email was sent. No production data was written. No migration was applied. Nothing was deployed.**

---

## 1. Editorial CMS audit

Five parallel readers went through the repository's content systems file by file. The question was narrow: can any of them store, author or render a weekly newsletter issue?

### Knowledge Center — do not reuse

Supabase-backed. `supabase/migrations/015_knowledge_center.sql` defines `kc_categories`, `kc_articles` (with `body_mdx text`, a `draft|published|archived` status, a generated `tsvector`) and `kc_related`, plus a `kc_search` RPC. Roughly 50 articles live.

- **Storage is article-shaped, not issue-shaped.** No subject line, no preheader, no send date, no send lifecycle, no recipient or delivery record, no plain-text variant. Its `status` enum is a *web-publish* state, not queued/approved/sent. The composite key `(category_id, slug)` forces every row to belong to a web category.
- **Publishing an issue there would publish it to the web.** The anon RLS policy exposes any `status='published'` row to `/knowledge`, the sitemap and `generateStaticParams`. A draft marked ready would become a public SEO page *before* it was mailed.
- **Authoring is a hand-written SQL migration.** Articles are created by writing a ~1,100-line seed migration with the markdown inlined in a `$mdx$…$mdx$` literal, then applying it to Supabase by hand — there is no migrate script and CI is explicitly offline. There is no admin UI, and RLS revokes insert/update/delete from both `anon` and `authenticated` with no admin policy at all, so only the service role can write. At weekly cadence that is ~52 committed migrations and 52 manual production applies a year, with a typo fix requiring another migration.
- **Its renderer is wrong for email.** `src/lib/kc/mdx.ts` is an 87-line hand-rolled markdown→HTML pass that emits Tailwind class names and no inline styles or table layout. Inboxes load no stylesheet. It also produces no plain-text part, which `OutboundMessage` requires.

The one genuinely reusable part is read-side: `getLatestArticles` / `getCategories` as a place a human copies a link from while writing a section. See the risk note in §9 about importing it.

### `content_pages` — do not build on

`supabase/migrations/009_content_pages.sql` is applied and looks like the obvious hook (slug, `body_mdx`, draft/published/archived, `published_at`). It has **zero rows, zero code references anywhere in `src/` or `scripts/`**, and the `scripts/content-sync` its own header names does not exist. It is dead schema and a strictly weaker duplicate of `kc_articles`.

### Markdown / MDX — no pipeline exists

No markdown or MDX processor in `package.json`. No `.md`/`.mdx` content files outside `docs/`. The `/content` directory contains only `.gitkeep`. Despite the column name, `body_mdx` holds plain markdown text and is never compiled as MDX.

### Road Ahead — do not reuse

The closest thing to a recurring series, and it is not one. It is a **singleton page** built from hardcoded TypeScript constants (`ROAD_AHEAD_CHAPTERS`). `SceneId` is a closed union appearing in type positions across five files, and `validateChapters()` enforces contiguous indices against the literal array — i.e. it actively enforces singleton-ness. There is no date, no status, no archive. Modelling issue *N+1* on it would mean editing a union type.

Its prebuild manifest script exists for an unrelated reason: `public/` is on the CDN and not in the Netlify page function's file trace, so a runtime `existsSync` lies. Issues are TypeScript modules already in the bundle — there is no filesystem to scan.

### Admin tooling — reuse the chassis, not the tooling

There is **no editorial content CRUD** in the admin. Every surface is either a moderation queue over user-submitted rows (submissions, reviews, claims) or a structured-record form over a fixed domain table (locations, founders, sponsors). None stores or edits long-form prose. The one text-heavy editor — the practice-test question form — is deliberately UPDATE-only by UUID.

What does carry over is the pattern, not the code: `requireAdmin()`, `AdminShell`/`AdminNav`, and the `requireAdmin → zod → service-role write → revalidatePath → redirect(?ok/?error)` action shape.

Two properties of that gate matter here: **auth is a single shared password with no per-user identity**, so an in-app approval would record a hardcoded string as the approver, and the login form has no rate limiting.

### Recommendation — the smallest reusable architecture

**An issue is a committed TypeScript value.** One file per week under `src/lib/newsletter/issues/`, listed in an explicit `index.ts` array. The pull request is the editorial review step.

That is not a compromise for smallness. For a weekly email with one author and one reviewer, a PR gives diffs, line comments, permanent history and a real named approver — all of which a `newsletter_issues` table, an admin route and a form would have to reimplement, behind an auth gate that could not record who approved anything as honestly as `git log` does. It also keeps the whole path testable offline in CI and deterministic between review and send.

**Reused as-is:** `render.ts`, `approval.ts`, `brand.ts`, `transport.ts`, `send-workflow.ts` (all from #230).
**Genuinely new:** the issue model, provenance, CTA rules, the state machine, the compiler, and the preview.
**Not built:** no table, no migration, no admin route, no Supabase call anywhere in the newsletter module.

## 2. Issue builder

`src/lib/newsletter/issue.ts` defines an issue as an ordered list of sections plus exactly one primary CTA.

Twelve section kinds, in canonical running order — the note that opens it, the news, the practical material, the platform's own items, the sign-off:

`opening-note` · `industry-news` · `dot-fmcsa` · `fuel` · `weather` · `driver-tip` · `parking-spotlight` · `featured-practice-test` · `academy-update` · `store-spotlight` · `youtube-video` · `closing-note`

**Sections are optional and may not repeat.** A week with nothing worth saying about fuel ships without a fuel section — not with one reading "no updates". A duplicated kind is rejected, and so is a section that appears out of the canonical order, so every issue reads the same way.

Each section carries a heading, body prose (split on blank lines into paragraphs), optional bullets, optional inline link, an optional correction, and **required provenance**.

`src/lib/newsletter/campaigns/issue-template.ts` is the blank issue an author copies. Every one of its twelve sections is a marked placeholder, which makes it a working demonstration of the gate rather than a document about it: validate it and it refuses, listing all twelve.

## 3. Content and provenance rules

Every section must be labelled one of exactly three things:

| Label | Meaning |
|---|---|
| `official-source` | Carries a publisher, an absolute http(s) URL and an ISO retrieval date. All three are validated. |
| `owner-written` | Shawn's own words. No citation line is rendered. |
| `placeholder` | Not finished. Blocks publication. |

**Unknown cannot publish.** The validator takes `unknown`, not a typed value, and treats anything it does not positively recognise — absent, null, a bare object, a misspelled label — as unknown, which blocks. Not "assume owner-written", not "warn and continue".

**Four sections may never be owner-written.** `industry-news`, `dot-fmcsa`, `fuel` and `weather` state facts about the outside world. A sentence about hours-of-service that reads as authoritative but has no source behind it is the single worst thing this newsletter could publish, because drivers act on it. Those four are `official-source` or the section is dropped.

**A citation without its parts is not a citation.** An official source missing a publisher, or carrying a relative URL, a non-http scheme, or an unparseable date, is rejected — a broken source link is indistinguishable from a fabricated one to the reader.

## 4. CTA rules

**One primary, at most one secondary.** An issue that asks for three things gets none of them; more concretely, this newsletter can ask a reader to apply to the Academy, buy a guide, or claim a directory listing, and those are different funnels with different money attached.

Three conflicts are rejected, because they fail differently:

1. **Same destination twice** — reads as a rendering bug and splits click attribution across two buttons for one action. Compared after canonicalising case, trailing slash and `utm_*` parameters.
2. **Two committing asks** — `purchase` and `apply` both cost the reader something. The secondary is meant to be a lower-cost alternative, not competition.
3. **Secondary outranks primary** — if the softer action is the Academy application and the headline is a $19 guide, the issue is pointed at the wrong thing regardless of which is labelled primary.

**Section links are not CTAs.** They compile to a `link` block that renders as ordinary underlined body text, never a button. That is what lets an issue mention a dozen things while asking for exactly one — asserted by counting button markup in the rendered HTML.

## 5. Approval workflow

```
draft → owner-review → approved → ready-to-send → sent → archived
```

**Nothing advances itself.** Every transition is an explicit act by a named actor; an unattributed transition is refused. There is no scheduler and no auto-approval.

**No stage can be skipped**, and `approved` does not lead to `sent`. `ready-to-send` exists precisely so "this content is signed off" and "send it now" are two decisions at two moments — collapsing them is how an issue approved on Tuesday goes out during Thursday's outage.

**Backwards is always allowed; forwards requires passing validation.** Review finds a problem, the issue drops to `draft`, and the fix re-enters from the start rather than keeping a stale approval.

**`sent` is effectively terminal** — its only exit is `archived`. Mail that has left cannot be unsent, so any state implying "not yet sent" would be a lie about the world. Re-sending is a new issue.

Reaching `ready-to-send` still sends nothing. `evaluateSendReadiness` (from #230) gets the final word, and the only transport that exists reports `canDeliver: false`.

## 6. Preview

`scripts/preview-road-report-issue.ts` writes to `.road-report-preview/issues/` (gitignored). Per issue:

| Output | What it is |
|---|---|
| `<slug>.html` | Review shell: validation problems listed up top, then the email in three real iframes — **mobile 375px, tablet 768px, desktop 1024px** |
| `<slug>--email.html` | The raw email document |
| `<slug>--dark.html` | The email inside a forced `color-scheme: dark` page, so the `prefers-color-scheme` rules actually fire |
| `<slug>--plain.txt` | The plain-text part |

The viewports are iframes rather than three copies pasted into one page: the email is a complete document with its own `<body>`, so pasting would produce invalid markup and let the widest copy's styles decide the layout.

The script exits non-zero if any **non-draft** issue fails validation. A draft that fails is simply a draft.

## 7. Tests and validation

| Check | Result |
|---|---|
| `road-report-issue` (new) | **139** assertions, 0 failed |
| `road-report` (extended) | **340** assertions, 0 failed |
| `npm test` — all harnesses | **92** harnesses, 0 failed |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npx prettier --check` | clean |
| `npm run build` | pass |

Coverage of the required properties: placeholder-blocking; provenance validation including every malformed shape; the one-primary-CTA rule and all three conflicts; unsubscribe, footer and sender present in **both** parts and on a zero-block email; every legal and illegal state transition; and that a draft cannot send even to a test address.

**No email is sent during tests or the build.** The `road-report` harness sweeps every file under `src/lib/newsletter/` and asserts none calls `fetch`, imports the dormant Resend helper, names a provider endpoint, or reads a secret — and it picks up new files automatically, so this stays true as the module grows. The `road-report-issue` harness adds that no issue-path module constructs a transport or touches Supabase.

### Defects found by running things rather than trusting them

1. **Placeholders double-counted.** The plain-text renderer uppercases headings, so an uppercased marker was a *different string* from the one in the HTML and every unfinished heading was reported twice — 47 reported against 35 real. Markers are no longer uppercased.
2. **The unsubscribe-wording check could never fail.** It looked for the word "unsubscribe" anywhere in the body — but the unsubscribe *URL* contains that word, so the check passed purely because the link was present. It now strips the URL first.
3. **Validation could never pass.** The pending postal address is interpolated into every footer, so `findPendingCopy` fired on every render and the success path — the branch that decides real sends happen — was the one branch no test could exercise. The postal address is now a render input defaulting to the module constant. This is not a way around the gate: `evaluateSendReadiness` reads the sender identity separately and still refuses.

## 8. Owner decisions still required

| Id | Decision |
|---|---|
| `ROAD-REPORT-SENDER-01` | From address, From display name, Reply-To and who monitors it, and the postal address required in commercial email — a legal requirement that cannot be invented. Blocks every send. |
| `ROAD-REPORT-CADENCE-01` | Which day issues go out, and whether the twelve sections or a smaller core set is the weekly norm. |
| `EMAIL-CONSENT-01` | Carried from #229 — the disclosure sentence. Still blocks recording consent, therefore any send. |
| Migration 049 | Reviewed and verified in #229, still unapplied. `email_subscription_status` is what the send gate reads for consent. |
| Provider | The dormant Resend wiring or another. Nothing here depends on the answer. |

## 9. Deliberately not here

**No newsroom.** No scraping, no source polling, no feed ingestion, no auto-publishing, no scheduling, no production sending. An issue is written by a person and reviewed by a person.

**No auto-populated sections.** The tempting next step — importing `src/lib/kc/queries.ts` to fill a "published this week" block — would break three things at once: it pulls a Supabase client and `server-only` into a module the offline harness bundles; it makes the rendered bytes differ between review time and send time, defeating the point of approving a specific render; and the live article data is not uniformly verified (`reg_verified=false` rows exist), so an auto-filled block could cite unverified regulatory copy to drivers. If it is ever wanted, it belongs in a separate offline script that emits a section literal for a human to paste.

**No transition history table.** `issue.state` is a field in a committed file, so `transition()` is a check rather than a persisted event. At this size the git log is the history, and the shared-password admin gate could not record an approver more honestly.

**No PWA, no Navigator.** No changes to HERE routing, HOS, Trip Planner, Directory, Store, Founder Wall, or parking data.

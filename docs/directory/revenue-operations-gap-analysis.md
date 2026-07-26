# Revenue operations — gap analysis

What the platform can already do for the approved business model, what it
cannot, and which of the gaps are closeable without a migration. Measured
against `main` at `17fcfa0` (PR #190 merged) and the live schema on 2026-07-26.

Approved model: claim free and manually verified · featured listing $99/mo or
$999/yr, up to three per category/corridor page · corridor sponsor $299/mo or
$2,999/yr, one primary per corridor page · paid placements labelled Sponsored ·
claims never modify a listing · no payment integration.

---

## The two independent mechanisms

Paid placement is served by **two unrelated systems**, and almost every answer
below depends on which one is in play:

| | Featured listing ($99) | Corridor sponsor ($299) |
| --- | --- | --- |
| Stored in | `locations.is_featured` (boolean) | `directory_sponsors` (row) |
| Rendered by | the listing itself, sorted first | `SponsorSlot`, a separate block |
| Disclosure | "Sponsored" badge on the card and detail page | "Sponsored" heading on the block |
| Date window | **none — the column is a bare boolean** | `starts_at` / `ends_at`, enforced |
| Deactivation | untick `is_featured` | `active=false`, or the window lapses |
| Admin surface | `/admin/directory` (list) and the listing edit form | `/admin/directory/sponsors` |

That asymmetry is the single most important fact in this document.

## Current state, field by field

### `sponsors` (the CRM / inquiry table)

`id, company, contact_name, email, phone, stage, tier_interest, pledged_cents,
paid_cents, priority, next_action, next_action_date, notes, status,
created_at, updated_at`

- `status` CHECK: `new | contacted | paid | active`
- `stage` CHECK: `prospect | contacted | warm | committed | closed_won | closed_lost`
- `priority` CHECK: 1–5
- `tier_interest`: **free text, no CHECK** — the funnel writes the offer id
  (`listing-claim`, `featured-listing`, `corridor-sponsor`) here.
- `pledged_cents` / `paid_cents`: integers, unused so far.
- Live count: **0 rows.**

### `sponsor_touches`

`id, sponsor_id, touch_type, direction, summary, created_at`

- `touch_type` CHECK: `email | call | dm | meeting | video | other`
- `direction` CHECK: `outbound | inbound`
- Live count: **0 rows.** Append-only in practice — nothing updates or deletes.

### `directory_sponsors`

`id, name, tagline, url, logo, placements[], states[], interstates[],
categories[], active, starts_at, ends_at, created_by, created_at, updated_at`

- `url` CHECK: must match `^https?://`
- `placements` values: `directory-hub | state | interstate | detail | map-sidebar | parking`
- Empty targeting array = **matches everything** (a wildcard).
- Live count: **0 rows.** The table exists — migration 024 **is applied**, despite
  the stale "not enabled yet" notice still shown on the admin page.

### `locations.is_featured`

Boolean, no window, no owner, no audit column. Live count of featured rows: **0.**
Read in `selectEntries` as `.order('is_featured', { ascending: false })`, so a
featured listing sorts first on every category, state, corridor and parking page
it appears on.

### Authentication and authorization

One gate, `requireAdmin()` in `src/lib/admin/auth.ts`: HttpOnly cookie holding an
HMAC of `ADMIN_SESSION_SECRET`, compared in constant time; fails closed when
either `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` is missing. Every mutating
server action in `/admin` calls it as its first statement. There are no user
accounts and no roles — admin is Shawn, or it is nobody.

### Campaign attribution

Not in the CRM. The `from`/surface a CTA was clicked from rides on the analytics
events (`surface`, `category`, `state`, `corridor`), and analytics is currently
disabled. `leads.utm` exists but belongs to the driver funnel, not this one.

---

## The eight questions

### 1. Can an administrator safely approve a free claim?

**Not yet — no surface exists, but the fields do.** `/admin/sponsors` is
read-only apart from the lead status select. Nothing anywhere approves a claim,
which is safe but also means the review procedure in
`docs/directory/claim-verification.md` has nowhere to record its outcome beyond
free text.

Closeable without a migration: **yes.** A verified claim maps cleanly onto
existing enums — `stage = 'closed_won'` for verified, `'closed_lost'` for
rejected — with the reviewer, date and reason written as a labelled line in
`notes` (the same convention the funnel already uses) and one `sponsor_touches`
row (`touch_type='other'`, `direction='outbound'`) as the audit entry.

### 2. Can an administrator activate a sponsored listing manually?

**Yes, but unsafely.** `setFeaturedAction` flips `is_featured` from a one-click
button on `/admin/directory`, and the listing edit form has a bare "Featured
listing" checkbox. Both are admin-gated. Neither asks for confirmation, checks
capacity, records who did it or why, or records a term.

Closeable without a migration: **yes** for confirmation, capacity, and an audit
note. **No** for a self-enforcing end date — see question 5.

### 3. Can an administrator activate one corridor sponsor?

**Yes.** `/admin/directory/sponsors` creates a `directory_sponsors` row and
`SponsorSlot` renders it on matching pages with `rel="sponsored noopener
noreferrer"` under a "Sponsored" heading. It is admin-gated and the URL is
validated server-side.

Two real problems:

- The create form **does not expose `starts_at` / `ends_at`**, so every sponsor
  created through the UI runs forever until someone remembers to deactivate it.
- Leaving `interstates` blank means *every* corridor, not none. A sponsor
  created with empty targeting silently occupies the primary slot on every
  corridor page in the country.

Both are UI gaps over columns that already exist.

### 4. Can start/end dates be enforced with existing fields?

**Corridor sponsors: yes, fully.** `starts_at` and `ends_at` exist and
`withinWindow()` in `src/lib/directory/sponsors.ts` filters on them at render
time, so the window is enforced on every request. The only gap is that the admin
form never sets them.

**Featured listings: no.** `locations.is_featured` is a bare boolean. The
approved term can be recorded against the CRM row
(`sponsors.next_action_date` = renewal date, plus a note), and admin can show an
"expired" warning, but the listing keeps showing until a human unticks it.

### 5. Can expired sponsorships stop displaying automatically?

**Corridor sponsors: yes.** Already true today — `activeSponsorsFor` drops any
sponsor outside its window on every render, with no cron and no job.

**Featured listings: no, and this cannot be fixed without a migration.** A
boolean cannot expire. The three options, none of which this milestone takes:

1. Add `featured_until timestamptz` to `locations` — a migration.
2. Move featured listings into `directory_sponsors` — a data-model change plus a
   new render path.
3. Accept manual expiry and make it loud: a dated renewal in the CRM and an
   admin panel that shows every featured listing whose recorded term has passed.

Option 3 is what is implemented, and the limitation is stated where an
administrator will see it rather than buried here.

### 6. Can the one-primary / three-sponsored capacity limits be enforced without a migration?

**Yes, at activation time — not as a database invariant.**

Both limits are computable from data we already have:

- *One primary corridor sponsor per corridor page*: count active,
  in-window `directory_sponsors` rows whose `placements` include `interstate`
  and whose `interstates` either contain the target corridor **or are empty**
  (the wildcard case is the one that actually bites).
- *Up to three sponsored listings per category or corridor page*: count
  published, non-deleted `locations` with `is_featured = true` sharing the
  target `category_slug`, and separately sharing the target `interstate`. A
  listing sits on both pages, so both counts must clear before it is activated.

What cannot be done without a migration is making the database *refuse* an
overrun — that needs a partial unique index or a trigger. The check implemented
here is check-then-act inside an admin-gated server action. With a single
administrator that is sound; it is not safe against two admins clicking at the
same instant, and it is documented as such rather than dressed up as a
constraint.

### 7. Is every paid placement visibly marked "Sponsored"?

**Yes, as of PR #190.**

- Corridor sponsor blocks: `SponsorSlot` renders under an `aria-label="Sponsored"`
  region with a visible "Sponsored" heading, and every outbound link carries
  `rel="sponsored noopener noreferrer"`.
- Featured listings: the card badge, the detail-page badge and the grouped
  section all read **Sponsored** (previously an unqualified "Featured"). The
  sort control reads "Sponsored first"; the underlying `featured` sort *value*
  is unchanged.

The residual risk is not labelling but meaning: `is_featured` is one boolean
serving both "we were paid" and any future "we picked this". Right now every
featured listing is by definition a paid one — there are zero of them — so the
label is accurate. If editorial featuring is ever wanted, that needs a second
field and therefore a migration.

### 8. Is there a safe audit trail using existing fields?

**Partially, and it is enough to be useful.**

| Event | Where it can be recorded | Quality |
| --- | --- | --- |
| Claim reviewed | `sponsors.stage` + labelled note + `sponsor_touches` row | good — who, when, why, immutable touch row |
| Payment confirmed | `sponsors.status='paid'`, `paid_cents`, note | good |
| Placement activated | `sponsors.status='active'` + note + touch row | good |
| Approved term | `sponsors.next_action_date` + note | adequate for featured, redundant for corridor (real columns exist) |
| Who flipped `is_featured` | **nowhere** | missing — `locations` has no actor column and `updated_at` only says *when* |
| Corridor sponsor created by | `directory_sponsors.created_by` (defaults `'owner'`) | present but never set meaningfully |

The gap is that a `locations` write leaves no actor trail. Mirroring every
placement change into `sponsor_touches` against the paying sponsor's CRM row
gives an actor-stamped, append-only record without touching the schema — that is
what is implemented. It is a parallel trail, not a table-level audit log, and a
`locations` row edited outside the placement flow still records nothing.

---

## Summary

| Capability | Today | After this milestone | Needs a migration |
| --- | --- | --- | --- |
| Approve a free claim safely | no surface | yes, on existing enums + notes | no |
| Activate a featured listing | yes, unguarded | yes, confirmed + capacity-checked + audited | no |
| Activate a corridor sponsor | yes, no dates | yes, with a real window + capacity check | no |
| Enforce a corridor sponsor window | yes (render-time) | yes | no |
| Enforce a featured-listing window | no | recorded and warned, not enforced | **yes** |
| Auto-expire a corridor sponsor | yes | yes | no |
| Auto-expire a featured listing | no | no | **yes** |
| Block a capacity overrun | no | yes, at activation | for a hard DB invariant, **yes** |
| Label paid placement Sponsored | yes | yes | no |
| Separate editorial from paid featuring | no | no | **yes** |
| Actor audit trail on `locations` | no | mirrored into `sponsor_touches` | for a real one, **yes** |
| Campaign attribution in the CRM | no | no (lives on analytics events) | **yes** |

Four things genuinely need a future migration, and none of them blocks selling
the first placement:

1. `locations.featured_until` — so a paid featured listing expires by itself.
2. A field separating an editorial pick from a paid slot on `is_featured`.
3. A unique/partial index making capacity a database invariant rather than an
   application check.
4. A campaign/source column on `sponsors` if attribution should live in the CRM
   rather than in analytics.

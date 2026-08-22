# REVENUE-2 — applying the featured-listing term (migration 057)

The ordered procedure for giving a paid featured listing a real end date, and
what to check before and after.

**Nothing in this document has been applied.** Migration 057 is written,
verified against a real Postgres in a transaction that rolls back, and left
unapplied. Applying it is an owner action.

**Read the whole of §3 before running anything.** The single most damaging
mistake available here is a blanket migration command, and it is one keystroke
away.

---

## 1. What changes, and what a driver would notice

Before this milestone a paid featured listing was `locations.is_featured = true`
and nothing else. The term the business bought lived in the CRM notes, which no
public page reads. So when the money ran out the placement kept its **Sponsored**
badge, its featured-first position, its map treatment and its slot against the
three-per-page limit — until a human remembered to switch it off. "Term expired"
and "placement stopped" were two different events and only the second was
visible to anyone.

After it, eligibility is `is_featured AND now < featured_until`, evaluated when
the page is read. Expiry therefore needs no cron, no job, and no write at the
moment it happens: the row simply stops qualifying.

| | Before 057 | After 057 |
| --- | --- | --- |
| A term that has ended | badge stays until someone notices | badge is gone on the next read |
| Capacity | an expired row keeps holding a slot | the slot frees itself |
| The admin console | "STILL SHOWING — stop it or renew it" | "Term expired · public placement ended" |
| Activating a placement | allowed with no end date | refused unless a term can be written |
| Corridor sponsors | already had a real window | unchanged |

A driver sees nothing except that an unpaid listing stops being labelled
Sponsored. No listing is hidden, moved, or removed. Expiry takes away a **label**,
never a business.

---

## 2. Before you apply anything

### 2.1 The application is already deployed and already correct

The code ships first and the migration second, on purpose. The application
detects whether `featured_until` exists and keeps every public surface on the
pre-057 rule while it does not. So merging the pull request changes nothing a
visitor can see, and there is no window in which the site is broken waiting for
you to run SQL.

Verified: a production build against the **current** schema (no `featured_until`)
completes with zero prerender failures, and the deploy preview renders the
Directory exactly as it does today.

### 2.2 Preconditions, checked live and read-only

Confirmed on `tlws-platform` (`cgvxwvymkembftznhcdl`) before writing this:

| Check | Value | Why it matters |
| --- | --- | --- |
| `locations.featured_until` exists | **no** | the migration's drift guard will pass |
| rows with `is_featured = true` | **0** | the CHECK validates instantly, no table rewrite |
| published rows | 2,454 | unchanged by this migration |
| active corridor sponsors | 0 | a different product, untouched |
| CRM opportunity rows | 0 | nothing live to disturb |

Re-run this immediately before applying — the zero-featured-rows figure is the
one the migration's own post-condition insists on, and it is the one that can
change between now and then:

```sql
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='locations'
       and column_name='featured_until')            as term_column_exists,
  (select count(*) from public.locations
     where is_featured = true)                      as featured_rows;
```

Expect `0 | 0`. If `featured_rows` is not zero, **stop** and go to §6.

### 2.3 Rehearse it, without writing anything

```sh
FEATURED_TERM_VERIFY_DB_URL='postgresql://…' \
  node scripts/verify-featured-term-migration.mjs
```

Every probe runs inside `begin … rollback`. Nothing in that file issues a
commit. It checks that the SQL executes, that the drift guard fires on a
database that already has the column, that the constraint refuses a featured row
with no term and permits one with a term (including a term already in the past —
expiry is a read rule, not a constraint), that the index is created and that its
predicate does not consult the clock, and that the column is still absent
afterwards.

Pointing it at a real project ref is refused unless you say so explicitly:

```sh
FEATURED_TERM_VERIFY_ALLOW_PRODUCTION=1 \
FEATURED_TERM_VERIFY_DB_URL='postgresql://…' \
  node scripts/verify-featured-term-migration.mjs
```

That override exists because a rehearsal on some other database proves the SQL
parses, not that it fits this one. It is a separate typed act, never a default.

---

## 3. Applying it — the part with the trap

### 3.1 DO NOT USE A BLANKET MIGRATION COMMAND

`supabase db push`, "apply all pending migrations", or anything that walks the
directory **will sweep in five migrations that are deliberately unapplied**:

| File | Status |
| --- | --- |
| `049_email_consents.sql` | PROPOSED — DO NOT APPLY |
| `050_navigator_accounts.sql` | PROPOSED — DO NOT APPLY |
| `051_navigator_provider_usage.sql` | PROPOSED — DO NOT APPLY |
| `052_navigator_account_table_privileges.sql` | depends on 050; unapplied |
| `053_navigator_reservation_service_role_only.sql` | depends on 051; unapplied |

Those belong to Navigator and are gated on decisions that have not been made.
Applying them as collateral damage to a Directory change would create
account tables and grant paths nobody has approved.

**Apply migration 057 specifically, and only 057.**

### 3.2 The ledger is not a complete record — check the object too

`supabase_migrations.schema_migrations` on this project lists 001–048, then 054,
055, 056. It does **not** list 047 — yet `locations.mile_marker` and
`locations.overnight_status` both exist, so 047 was applied out of band without a
ledger row.

Two consequences, and both matter:

1. "It is not in the ledger" does not mean "it is not applied". Always check the
   object, not just the list.
2. Applying 057 through a tool that writes a ledger row is preferable, because it
   leaves the record this one didn't — but the ledger row is bookkeeping. The
   column is the fact.

### 3.3 Ledger before

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Record the last row. Expect `20260819164641 | 056_seed_kc_how_long_cdl_training`.

### 3.4 Apply

Run the contents of `supabase/migrations/057_featured_listing_term.sql` as a
single statement batch — it is one transaction with its own `begin`/`commit`, a
drift guard at the top and post-conditions at the bottom. If any of them fail,
the whole thing rolls back and the database is untouched.

Do not edit the file to make it run. If it refuses, the refusal is the point;
go to §6.

### 3.5 Ledger and object after

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;

select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema='public' and table_name='locations' and column_name='featured_until';

select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid='public.locations'::regclass and conname='locations_featured_term_check';

select indexname, indexdef from pg_indexes
 where schemaname='public' and indexname='locations_featured_active_idx';

select count(*) as featured_rows from public.locations where is_featured = true;
```

Expect: the column present as `timestamp with time zone`, nullable, **no
default**; the constraint reading `CHECK ((NOT is_featured) OR (featured_until IS
NOT NULL))`; the index present with **no `now()` in its predicate**; and
`featured_rows = 0`.

A default on that column would be the one silent failure worth catching by hand:
it would hand every future row a term nobody agreed.

---

## 4. After applying

### 4.1 No redeploy is required

The running server re-asks whether the column exists at most once a minute, so
the site starts honouring terms within a minute of the apply. A `ready` answer is
then remembered for good — a column does not un-exist while a server runs.

### 4.2 What to confirm

1. **`/admin/directory/placements`** — the amber "Featured-expiry schema is not
   active yet" banner is gone, and the Activate control is available.
2. **The Directory is unchanged.** With zero featured rows there is nothing to
   see, which is the correct outcome. Load a category page and confirm it renders.
3. **`/admin/directory/revenue`** — the renewal-queue explainer no longer says a
   featured placement must be stopped by hand.

### 4.3 The staleness bound, stated honestly

Expiry is decided when a page is read, and directory pages are ISR at
`revalidate = 300`. So a lapsed placement can keep its badge on a prerendered
page for **up to five minutes** after its term ends. Surfaces that read per
request — the card endpoint, the admin console — are immediate.

Five minutes, with no human involved, replaces "until somebody remembers". That
is the improvement, and it is worth stating in those terms rather than claiming
the badge vanishes on the stroke of the second.

---

## 5. Selling and running a featured listing after 057

### 5.1 A featured listing now starts when you activate it

There is no scheduled start. Activation derives the window from the moment you
press the button, and a future start date is **refused with a message** rather
than recorded and ignored.

That is not a limitation invented here — it is the removal of a lie. Before this
milestone, activation wrote `is_featured = true` immediately whatever start date
you typed, so a placement dated to start next week went public that afternoon
while the CRM said otherwise. Rather than teach 2,454 pages about a second date,
activation now refuses to record a start it will not honour.

**So: activate on the day the term starts.** If a business wants to begin on the
first of the month, take the payment, leave the placement off, and activate on
the first.

### 5.2 Renewing

`Renew` sits beside `Stop` on the placements console. It is gated exactly as hard
as the first sale — the renewal has to be quoted, paid and confirmed on the
revenue console first, because a renewal is a second sale.

The renewed term runs from **now**, not from the old expiry. Extending from a
lapsed date would hand back days nobody paid for.

A lapsed placement can be renewed directly; it does not need to be stopped first.
Its own row never counts against its page's capacity, so renewing the third
placement on a full page is allowed while adding a fourth is not.

### 5.3 Stopping

`Stop` still ends a placement immediately, still needs no confirmation word and
still takes no payment. It clears the term along with the flag. The commercial
history — what was bought, what was paid, when it ran — stays in `sponsors.notes`
and `sponsor_touches`, which is where it belongs. The listing row only ever
carried the current state.

### 5.4 Tidying an expired placement

An expired row keeps `is_featured = true` until someone clears it. That is
deliberate and it is **housekeeping, not an outage**: the placement is already
off every public surface, and the leftover boolean is what lets the console show
you what happened. Clear it with `Stop` whenever convenient.

---

## 6. When something is wrong

### 6.1 The migration refuses with "schema drift"

Something already created `featured_until`, `featured_starts_at`, the constraint
or the index. Nothing was changed. Find out what created it before doing anything
else — a half-applied earlier attempt and a hand-made column are different
problems.

### 6.2 The post-condition refuses with "expected 0 featured rows"

A row became featured between the precondition check and the apply. Nothing was
changed. Reconcile first:

```sql
select id, name, category_slug, interstate, is_featured
  from public.locations where is_featured = true;
```

Every such row is a placement with no recorded term. Decide, per row, whether it
is a live paid placement (record its term after the migration) or a leftover
(stop it), then re-run.

### 6.3 A featured row exists with no term after the migration

It cannot: the constraint makes it unrepresentable. If you somehow see one, the
constraint is missing — re-check §3.5.

The application already fails closed on this state anyway. A flagged row with a
null term reads as **"No term recorded · placement withheld"** and gets no public
featured treatment. NULL never means "runs forever".

### 6.4 Rolling back

```sql
alter table public.locations drop constraint locations_featured_term_check;
drop index if exists public.locations_featured_active_idx;
alter table public.locations drop column featured_until;
```

**Do not run that while any row has `is_featured = true` with a term in the
future.** Dropping the column destroys the record of a term a business paid for,
and the application then falls back to treating that placement as open-ended —
the exact defect this milestone removed. Stop those placements first, or write a
corrective migration.

After a rollback, **redeploy**. The running server remembers a proven `ready`
permanently, so it would keep asking for a column that no longer exists.

### 6.5 The Directory 500s after a deploy

If every directory page fails at once with a `42703` naming `featured_until`,
something is asking for a column that is not there. The bridge exists to make
that impossible, and there is one known way it was reachable:

A build platform restores Next's Data Cache between deploys. A cached
`200 [{"featured_until":null}]` for the schema probe answers "the column exists"
long after it stops being true, and then every read names it and PostgREST fails
the **whole** query. This was observed during development — one stale cache entry
produced 4,099 prerender failures on pages with nothing to do with placements.

It is fixed: both probes use a client with fetch caching switched off, and builds
answer "unavailable" without asking at all, because there is no way to ask a
fresh question during a prerender. If you ever see this symptom, clear the
build cache and redeploy, then check that
`src/lib/supabase/static.ts` still exports `createUncachedStaticClient` and that
`probeFeaturedSchema` still uses it.

---

## 7. What this milestone deliberately did not do

- No payment processor, card collection, invoicing or automatic billing.
- No outreach automation. Nobody was contacted.
- No change to prices, offers or capacity limits.
- No change to corridor sponsorships, which already enforced their own window.
- No scheduled starts (§5.1).
- No cron, no scheduled job, no background worker. Expiry is a read.

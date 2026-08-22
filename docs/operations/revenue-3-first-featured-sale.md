# REVENUE-3 — making the first featured sale

The owner procedure for selling, activating, watching and ending the first paid
featured listing, and what the console now does for you that you previously had
to remember.

**Nothing in this document changes the database schema.** Migration 057 is
already applied in production and verified (§6). This milestone adds no
migration, no column, no constraint and no payment processor.

---

## 1. What changed, and why

REVENUE-2 gave a paid featured listing a real end date, so a placement stops
showing when the money runs out. It did not make the sale **safe to perform**.

This is the workflow as it stood, reproduced against `main` at `7e98f60`:

1. Record the quote and the payment on `/admin/directory/revenue`.
2. Read, on that page, the sentence *"Copy this CRM row id into the placements
   console: `33333333-3333-4333-8333-333333333333`"*.
3. Copy the UUID.
4. Go to `/admin/directory/placements`.
5. Search the listing by name.
6. Paste the UUID into a free-text box labelled **CRM row id (required)**.
7. Choose monthly or annual.
8. Type `ACTIVATE`.
9. Press the button — and only now find out whether the deal was paid, whether
   the term matches what was sold, or whether the page is full, because all of
   those checks lived in the server action and came back as `?err=` on a
   redirect.

Two faults, and they are the same fault twice. A UUID carried by hand between
two consoles is a fact the application already holds and asked a human to
remember. And a gate that only speaks *after* the operator has committed is not
a gate, it is a receipt.

### What it looks like now

| | Before | Now |
| --- | --- | --- |
| Choosing the paying deal | copy a UUID between two consoles | a picker showing business, stage, paid/unpaid and agreed term |
| Knowing the deal is paid | find out after pressing ACTIVATE | a checklist line, before the button exists |
| The end date | *"ends automatically one month or year later"* | the exact date, e.g. `2026-10-15` |
| Capacity | `3/3` in a dense metadata line | a checklist line that refuses, with the count |
| Held brand / unpublished / deleted | some shown, some only on refusal | one line each, always |
| Unsafe state | ACTIVATE present, refuses on submit | ACTIVATE is **not rendered** |
| A live placement | status string plus a term date | ACTIVATED · exact expiry · days left · term · who paid · what a driver sees |
| Renewing | an inline form with another UUID box | the same checklist, plus what the renewal costs |

Everything the console decides is delegated to the authority the write already
uses. The checklist is a **view**, never a second opinion — see §5.

---

## 2. Selling the first featured listing

### 2.1 On the revenue console — `/admin/directory/revenue`

Nothing here changed. In order:

1. **Create or open the opportunity.** The prospect shortlist on that page is
   built only from public directory data and ranks by listing completeness and
   corridor presence. It contacts nobody.
2. **Move the stage** one step at a time: Prospect → Contacted → Warm →
   Committed. A brand-new inquiry cannot jump to a state that lets it go live.
3. **Record the agreed offer** — Featured listing, monthly ($99) or annual
   ($999). A different price is allowed but never silent: it needs an explicit
   amount and a written reason.
4. **Take the money outside the platform.** Bank transfer, cheque, invoice —
   whatever you already do. This platform takes no card details anywhere and
   refuses free text that looks like any.
5. **Record the payment** once it has actually arrived, and tick *"I have seen
   this money arrive"*. Nothing goes live on an unconfirmed payment.

The opportunity now appears under **Paid, ready to activate**.

### 2.2 On the placements console — `/admin/directory/placements`

Three steps, and nothing is written until the third.

**Step 1 — find the business.** Search by name and press **Prepare this sale**.
That is a GET: it writes nothing and the back button undoes it.

**Step 2 — pick the opportunity and the term.** The picker lists every
featured-listing opportunity with its stage, whether it is paid, and the term
that was agreed. There is no id to copy and nothing to mistype. Choose the
billing period and press **Re-check**.

**Step 3 — read the checklist and activate.** Twelve lines, each marked `OK` or
`NO`, each carrying the fact behind the mark:

| Line | What it tells you |
| --- | --- |
| Payment confirmed | the amount received, the day, against the amount agreed |
| Billing period chosen | monthly or annual, **and whether it matches what was sold** |
| End date that will be written | the exact date, e.g. `2026-10-15` |
| Starts now | today's date; a featured listing cannot be booked to start later |
| Listing | the business name |
| Where it will appear | the category page and the corridor page, plus the town |
| Listing is published | a driver would actually see it |
| Listing is not deleted or hidden | it has a public page to sponsor |
| Brand can be sponsored | held national chains are never promoted |
| Not already sponsored | if it is, you want Renew, not a second activation |
| Room on every page it appears on | the live counts, e.g. `truck-washes 2/3 · I-95 1/3` |
| Expiry tracking is live | the placement can be given a real end date |

**If any line reads `NO`, there is no ACTIVATE control on the page.** Nothing to
press by mistake. Clear the line and press Re-check.

When every line passes, the console states exactly what pressing the button
writes — *"X becomes Sponsored now and stops on 2026-10-15"* — and asks for your
name and the word `ACTIVATE`.

### 2.3 What activation actually does

One database update, setting both fields together:

```
is_featured   = true
featured_until = <the date shown on the checklist>
```

They are never written separately. Migration 057's CHECK constraint
(`not is_featured or featured_until is not null`) would reject the intermediate
row anyway, so a split write could not even succeed — but the code does not rely
on that, because "the database would have caught it" is a worse guarantee than
not doing it.

Alongside, and best-effort so a placement is never left half-applied:

* a labelled line is appended to `sponsors.notes` and mirrored as a
  `sponsor_touches` row — this is the audit trail, and it is also the only link
  between the listing and the deal that paid for it;
* the opportunity is marked `active` / `closed_won`, with its renewal date set
  to the term end.

Every check runs **again** against live data at the moment you press the button.
A change made in another tab in the meantime is refused, not written.

---

## 3. After it is live

The placement appears under **Sponsored listings** with:

* **ACTIVATED** in a word, not a colour or a status code
* the exact end date and the days remaining
* the term, monthly or annual
* which opportunity paid for it
* what a driver sees right now, in plain words
* a **Renew this placement** control and a **Stop sponsorship** control

Three headline states are possible, and they mean different things:

| Headline | What it means | What to do |
| --- | --- | --- |
| ACTIVATED | in term and showing publicly | nothing |
| ENDED | the term passed; the badge is already gone | renew it, or stop it to tidy the flag |
| WITHHELD | flagged, but the rules refuse to show it — no term, an unreadable term, or the listing is unpublished, deleted or a held brand | stop it, or renew it to write a proper term |

**ENDED is not an emergency.** Expiry is decided when a page is read, so the
placement left every public surface the moment the term passed. The flag left
behind is housekeeping.

### The term length is read from the audit trail

`locations` has no column pointing at the CRM, so the console finds the paying
opportunity by matching the `Placement activated: Featured listing — <name>`
line it wrote into `sponsors.notes`. Notes are append-only, so a renewal's line
supersedes the original.

If nothing matches, the console says *"no CRM opportunity records activating
this listing"* rather than inventing a term. That is a real state — a row could
have been flagged by an import, or by an activation whose audit note failed to
write — and you should see it as an absence.

---

## 4. Renewing, and what it costs

**Renewal is a second sale.** It goes through the same checklist and refuses on
the same grounds: the opportunity must be committed or closed-won, carry the
featured-listing offer and an agreed term, and have a confirmed payment covering
the agreed amount. Record the renewal payment on the revenue console first.

Two things differ, and both are deliberate:

* the placement may already exist, so *Already sponsored* stops being a blocker;
* capacity **excludes the placement from its own count**, so renewing the third
  placement on a full page is allowed while adding a fourth is not.

### The renewed term runs from today

This is REVENUE-2's decision, preserved. What REVENUE-3 adds is that the console
now **says what it costs before you commit**:

> This placement still has 12 paid days left. A renewal runs from today, so it
> REPLACES those 12 days rather than adding to them — the new term ends
> 2026-10-15. Renew on the last day of the term to give none of it away.

Both halves of that matter commercially:

* **Renewing early gives days away.** A monthly placement renewed with twelve
  days left gets one month from today, not twelve days plus a month.
* **Renewing late does not hand back days nobody paid for.** A placement that
  lapsed three weeks ago gets a full term from today, and the console says *"No
  paid time is lost."*

The alternative — extending from the old expiry — needs a scheduled start, and
Model B deliberately does not have one (§5). So the behaviour stays and the
price of it is stated. Renew on the last day of the term.

---

## 5. Model B, and why the checklist is not a second opinion

**Activation starts now.** There is no `featured_starts_at` and there is no
start-date field. A future start was previously accepted by the form and then
ignored by every public surface, so the CRM said one thing and 2,454 listing
pages said another. Rather than teach every surface a second date, activation
derives the window from the moment of activation and a future start is refused
with a message.

The checklist **decides nothing for itself**. Every line delegates:

| Line | Authority |
| --- | --- |
| Payment confirmed | `saleActivationBlockers` in `src/lib/directory/revenue.ts` |
| Listing, published, deleted, brand, pages | `promotionBlockers` in `src/lib/directory/placements.ts` |
| Room on every page | `featuredUsage` in `src/lib/directory/placements.ts` |
| End date, starts now, expiry tracking | `featuredExpiryFrom` / `featuredWindowBlockers` in `src/lib/directory/featured-window.ts` |

This is the point. A checklist that reimplemented any of those could approve a
state the write then refused — which is the REVENUE-2 defect (two components
disagreeing about one placement) wearing a friendlier coat. The invariant is
tested directly: `FS45` in `scripts/test-revenue-first-sale.ts` walks 1,080
input combinations asserting the console never offers an activation the action
would reject.

The console is allowed to be **stricter** than the write, and in one place it is:
selecting Annual against a deal sold Monthly is refused here. The action has no
equivalent line — it would catch the same case through the term-length check —
so this is a tightening, not a disagreement.

---

## 6. Stopping a placement

**Stop** writes exactly two fields:

```
is_featured    = false
featured_until = null
```

and nothing else. It never unpublishes the business, never deletes it, never
touches indexability, and never erases what you were paid — that history lives
on the CRM opportunity, where commercial history belongs. The listing row only
ever carried the current state.

Stopping needs no confirmation word and no payment. It is always safe.

### One fix this milestone made here

The stop used to branch on the schema probe: `featured_until` was cleared only
when `adminFeaturedSchema()` answered `ready`. That probe answers `unavailable`
for an **indeterminate** result as well as for a genuinely absent column — the
right bias for a write that turns revenue *on*, and the wrong one for a write
that turns it *off*. One dropped request during a stop therefore left a stale
`featured_until` behind on a database that has had the column since 057 was
applied.

The clear is now attempted unconditionally, and narrowed to a flag-only write
only when PostgREST actually reports the column missing (`42703` / `PGRST204`
naming `featured_until`).

---

## 7. What expiry never does

Proved again in this milestone's lifecycle tests and its browser bench:

* it removes the **Sponsored** label
* it removes featured-first sorting
* it removes the featured map treatment
* it releases the capacity slot
* it **keeps the business published** if it was otherwise published
* it **keeps the business indexable** if it was otherwise indexable
* it never unpublishes, never deletes, and never adds `noindex`

Expiry takes away a label, never a business.

---

## 8. Production state this milestone assumed

Read-only, confirmed against the live database before any code was written:

| Fact | Value |
| --- | --- |
| `locations.featured_until` | exists, `timestamptz`, no default |
| `locations.featured_starts_at` | does not exist |
| `locations_featured_term_check` | exists |
| `locations_featured_active_idx` | exists |
| Rows with `is_featured = true` | 0 |
| Rows with a non-null `featured_until` | 0 |
| Rows featured with no term | 0 |
| Rows in `sponsors` | 0 |
| Migration ledger max version | `20260819164641` (ends at 056; 057 was applied by hand through the SQL editor) |

**The CRM is empty.** The first sale genuinely starts from nothing, so the
console's empty state matters: with no featured-listing opportunity recorded,
the picker says so and points at the revenue console rather than showing a blank
dropdown.

Migrations 049–053 remain unapplied and the ledger is deliberately **not**
repaired here. Both are separate decisions for the owner.

---

## 9. What this milestone did not do

* No migration, and migration 057 is unmodified.
* No `supabase db push`, and no "apply all pending migrations" command.
* No migration-ledger repair.
* No production write of any kind. The only production access was the read-only
  query in §8.
* No real listing activated, no CRM row created, no business contacted.
* No payment processor, no card handling, no billing infrastructure.
* No change to the approved capacity numbers (three featured per page, one
  primary corridor sponsor per corridor page).
* No environment variable changed.

---

## 10. Proving it

| What | Where |
| --- | --- |
| Rules, offline and deterministic | `scripts/test-revenue-first-sale.ts` — FS1–FS60 plus 15 mutations |
| REVENUE-2's expiry rules, unchanged | `scripts/test-revenue-featured-expiry.ts` — FE1–FE80 |
| The console in a real browser at 360/390/430/1280 | `scripts/bench/first-sale.mjs` |
| Expiry in a real browser | `scripts/bench/featured-expiry.mjs` |

Run the harness:

```
npm test -- revenue-first-sale
```

Run the browser bench. It needs Playwright (not a repository dependency — link
or install it for the run) and a **fresh** production build against the mock,
with the mock's clock set forward so the fixture placements prerender in term:

```
MOCK_PORT=54994 MOCK_REVENUE=1 MOCK_FIRST_SALE=1 MOCK_FEATURED_FIXTURES=1 \
MOCK_FEATURED_SCHEMA=ready MOCK_TEXT_PROFILE=production \
MOCK_FIELD_PROFILE=production node scripts/bench/mock-postgrest.mjs &
curl -X POST 'http://127.0.0.1:54994/__mock/clock?offsetMs=7200000'

rm -rf .next
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54994 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key \
SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key \
NEXT_PUBLIC_SITE_URL=https://truckinglifewithshawn.com \
  npx next build

kill %1                      # the bench starts its own mock and refuses if one is bound
node scripts/bench/first-sale.mjs --tree .
```

**Build fresh for each bench run, and never hand-delete `.next/cache`.** Both
rules are the same fact about ISR, and both cost a debugging cycle here:

* the bench deliberately ends with the category page regenerated against an
  **expired** term, so a second run over the same tree starts from a cache that
  contradicts its own first assertion;
* deleting `.next/cache` to reset it is worse than leaving it — the prerender in
  `.next/server` survives, the revalidation bookkeeping does not, and the page
  then serves that prerender forever while every regeneration aborts on the
  schema probe's no-store fetch.

Both look exactly like a product defect (the badge missing from a live
placement) and neither is one. The same applies to
`scripts/bench/featured-expiry.mjs`, which shares the fixture set.

The bench drives the shipping code with no test hook compiled into it. Expiry is
decided on the server against the server's own clock, which a browser cannot
move — so the mock moves the **term** instead (`POST /__mock/clock?offsetMs=n`),
which is equivalent and needs no instrumentation. That is what makes the
capacity states reachable: with the three fixture placements in term the
truck-washes page is full and the fourth sale must be refused; with them lapsed
the slot is free and the same sale must be offered.

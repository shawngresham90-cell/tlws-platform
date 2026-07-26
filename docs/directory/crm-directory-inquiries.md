# Directory inquiries in the CRM

Claim, featured-listing and corridor-sponsor inquiries all arrive through the
**existing** sponsor pipeline. No table was added, no column was added, no
migration was written. This documents where each field a sales pipeline needs
actually lives — including the two that do not live in the CRM at all.

## The data contract

The funnel writes only into fields that already existed:

| What | Where it is stored | How |
| --- | --- | --- |
| Which offer they asked about | `sponsors.tier_interest` | The offer id verbatim: `listing-claim`, `featured-listing`, `corridor-sponsor`. `tier_interest` is free text (no CHECK constraint), max 60 chars — the ids are 14–16. |
| Which listing | `sponsors.notes`, first line | `Regarding directory listing: Name · category · ST · I-95 (/directory/location/slug)` |
| Billing preference | `sponsors.notes`, second line | `Billing preference: Annual (preference only — no payment was taken)` |
| Their actual message | `sponsors.notes`, remainder | Unchanged |

Both machine-written lines are **shown to the sender before they submit**, in
the "About this listing" panel. Nothing is appended invisibly.

`src/lib/admin/directory-inquiry.ts` parses them back out. It is a pure
function: given `(tier_interest, notes)` it returns type, type label, listing
name, slug, path, category, state, corridor, billing, and the message with the
machine lines stripped. A row that does not match yields nulls and the note is
returned untouched, so a legacy sponsor lead is never mislabelled.

## The admin view

`/admin/sponsors` gained derived columns and a filter, using only the data
above plus columns that already existed but were never displayed:

| Column | Source |
| --- | --- |
| Business / Contact | `company`, `contact_name` |
| Contact | `email`, `phone` |
| Inquiry | parsed type badge + parsed billing preference |
| Listing | parsed path (linked), category · state · corridor |
| Message | parsed message, machine lines removed |
| Pipeline | `stage`, `next_action`, `next_action_date` — **existing columns, previously unsurfaced** |
| Last touch | newest `sponsor_touches` row for the sponsor |
| Status | `status` (the existing `StatusSelect`) |

`?view=directory` / `?view=other` / no param filters the list; the counts in the
tab labels and the type breakdown are computed from the same parse.

The page is a server component with no server action, no form, and no fetch.
The only writable control on it is the pre-existing lead status select. It
cannot approve a claim or touch a `locations` row.

## Lead source and campaign attribution

These are the two fields a CRM would normally hold that **this one does not**,
and it would be dishonest to show a column for them:

- **Lead source / surface.** Which page the CTA was clicked from travels as the
  `from` query param and is sent on the `directory_claim_interest`,
  `directory_featured_interest`, `directory_inquiry_start` and
  `directory_inquiry_submit` events as `surface`. It is **not** written into
  `sponsors` — putting it there would mean either a new column (a migration) or
  a third machine-written line in the business's own message, and neither is
  worth it for a field the analytics already carry.
- **Campaign attribution.** There is no campaign infrastructure for the
  directory: no UTM capture on `/sponsors`, no ad spend, no campaign table.
  `leads.utm` exists for the driver funnel and is unrelated. Until there is a
  campaign to attribute, there is nothing to record.

Both remain answerable by asking the prospect, which is what actually happens on
a first call. The single change that would put `surface` in the CRM is one
column on `sponsors` — that is a migration, and it is deliberately not part of
this work.

## Analytics status

Event wiring is complete (14 events, `src/lib/directory/funnel.ts`). The
receiving end is not: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset in Netlify and no
existing Plausible account covering the production domain could be proven, so
analytics was **not** enabled and no account was created and no charge incurred.
`trackEvent` no-ops safely when the script is absent, so the wiring is inert
until someone sets that one variable. See `docs/directory/funnel-capability-map.md`.

Until then, every offer surface says the measurement is still being set up
rather than quoting numbers we cannot stand behind.

## Claims stay manual

See `docs/directory/claim-verification.md` for the review procedure. In short: a
claim is free, is reviewed by a person, and never modifies or transfers a
listing on its own.

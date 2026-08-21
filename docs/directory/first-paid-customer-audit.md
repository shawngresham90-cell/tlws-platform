# First paid customer — funnel audit

Every step between "a business sees the offer" and "a paid placement expires",
traced against `main` at `6cefd6d` (PR #352 merged) and the live schema on
2026-08-21, with what this milestone changed.

Status vocabulary:

| | |
| --- | --- |
| **complete** | works, no human workaround needed |
| **manual but workable** | needs a human, and that is the right design |
| **incomplete** | a gap that blocked the first sale — closed here |
| **unsafe** | worked, but could produce a wrong outcome — fixed here |
| **owner decision** | needs Shawn, not code |
| **migration required** | cannot be closed without a schema change |
| **no longer relevant** | the earlier analysis has been overtaken |

---

## Live state at audit time

Read-only aggregate counts from production. No production row was written by
this milestone.

| Metric | Count |
| --- | --- |
| `sponsors` (CRM) rows | 0 |
| `sponsor_touches` rows | 0 |
| `directory_sponsors` rows | 0 |
| Active, in-window directory sponsors | 0 |
| Expired directory sponsors | 0 |
| `locations` with `is_featured` | 0 |
| Published, non-deleted listings | 2,454 |
| Published listings on a corridor | 2,145 |
| Published listings with a public phone or website | 1,171 |
| Distinct corridors | 80 |
| Distinct categories | 9 |

Migration 024 **is applied** — `directory_sponsors` exists in production and is
empty. Every count above is zero on the revenue side, which is the single most
important fact in this document: there is no first customer yet, so every empty
state in the admin is the state the owner will actually see, and a dashboard
that renders a fabricated rate over zero data would be the first thing they
read.

---

## 1 · Public entry points

| Step | Status | Notes |
| --- | --- | --- |
| `/sponsors` front door | complete | Offer table, placement inventory, inquiry form, disclosure statement |
| `OfferTable` prices | complete | Derived from `offers.ts`; the component hard-codes no dollar figure |
| `GetFeaturedCta` on directory hub | complete | `surface=directory-hub` |
| …on category / state / corridor pages | complete | `surface=<category>` via the polymorphic `[category]` route |
| …on parking landing pages | complete | `surface=directory-parking` |
| …on listing detail pages | complete | `surface=directory-listing` |
| `ListingFunnelCtas` (claim + featured) | complete | Deep-links with the listing context attached |
| Offer preselection via `?interest=` | complete | Validated against the bounded option set; anything else is ignored |
| Source attribution via `?from=` | complete | `boundToken` to a 40-char slug; malformed values become `null` |
| Listing context via `?listing/lname/lcat/lstate/lcorr` | complete | Each re-bounded server-side; shown back before sending |
| Arbitrary pricing from a query parameter | complete | No price, amount or cents parameter is read anywhere. Now asserted by test |
| Mobile visibility of CTAs | complete | Verified at 360/390/430/1280 |
| Analytics on CTA view/click | complete | Bounded props only — no company, email, phone or message text |

**Finding, fixed:** `GetFeaturedCta`'s doc comment claimed the `from` surface
"is NOT persisted to the CRM … The inquiry form ignores it." That has been
untrue since the funnel shipped — `SponsorInquiryForm` appends
`sourceContextLine(from)` to the message and `parseDirectoryInquiry` reads it
back into a Source column. The behaviour was right and the comment was stale.

---

## 2 · Inquiry

| Step | Status | Notes |
| --- | --- | --- |
| Company required | complete | Client and `zod` |
| Contact name | complete | Optional by owner policy |
| Email required | complete | Normalised to lowercase server-side |
| Phone optional | complete | Regex-bounded |
| Message | complete | Capped at 2,000 chars |
| Offer selection | **was unsafe → complete** | `tier_interest` was `z.string().max(60)` — free text. Any 60 characters could be stored as the "tier" a CRM row bought, including an invented offer or a price. Now a `z.enum` over the approved option set |
| Turnstile | complete | Token required by the schema; verified server-side; refreshed on any failed submit |
| Honeypot | no longer relevant | Turnstile is the control; there is no honeypot field and adding one now would be belt-on-belt |
| Rate limiting | complete | 5/minute per IP per route via `guardedPost` |
| Double submit | complete | In-handler `if (submitting) return` plus `aria-disabled`; focus is not thrown off the button |
| Failed submit retryable | complete | Error surfaces, token is cleared and the widget remounts for a fresh challenge |
| Consent wording | complete | States plainly that a phone number is used only to reply, never for automated texts |
| Confirmation state | **was incomplete → complete** | Said only "Shawn will reach out". Now also states that placement is subject to review and availability, that no slot is held on an inquiry, and that nothing was charged |
| Error state | complete | `aria-live="assertive"` region |
| Database insert | complete | One `sponsors` row plus one inbound `sponsor_touches` row |
| Starting stage | **was unsafe → complete** | Inserted at `stage='contacted'`, so an inquiry nobody had answered was recorded as contacted. The owner could not tell "unanswered" from "I called them", and contact rate was meaningless. Now `prospect`, with `next_action` pre-set so it lands in the queue as work |
| Surface attribution | complete | Written as one labelled `Came from:` line, parsed back into a Source column |
| PII in analytics | complete | Event props carry slug, category, state, corridor, surface, interest, billing — never company, email, phone or message |
| PII in logs | complete | Only the row id and an error code |

---

## 3 · CRM

| Step | Status | Notes |
| --- | --- | --- |
| Row creation | complete | |
| Stage vocabulary | complete | `prospect → contacted → warm → committed → closed_won / closed_lost` |
| Stage transitions | **was incomplete → complete** | Nothing could change `stage` at all except a claim review. Now a gated machine: one step at a time, no jump from a new inquiry to closed-won, and a loss needs a written reason |
| Status vocabulary | complete | `new / contacted / paid / active`, tracked alongside stage |
| Priority | **was incomplete → complete** | Column existed; nothing wrote it |
| Next action + date | **was incomplete → complete** | Columns existed and were displayed; nothing wrote them |
| Touches | **was incomplete → complete** | Only the funnel and claim review wrote touches. The owner can now record a call, email, DM, meeting or video, in or out |
| Qualification result | **was incomplete → complete** | New labelled note line |
| Quoted / agreed amount | **was incomplete → complete** | `pledged_cents` existed and was never written by any code path |
| Paid amount | **was incomplete → complete** | `paid_cents` existed and was never written by any code path |
| Discount handling | **was incomplete → complete** | A quote away from the standard price requires a written reason and is recorded against that one deal; the published price never moves |
| Duplicate detection | **was incomplete → complete** | Matches on normalised company name, exact email, or last-10 phone digits. Flags for a human; never merges |
| Stale opportunities | **was incomplete → complete** | Open rows with no next action, or a next action whose date has passed, are counted and highlighted |
| Closed-lost reason | **was incomplete → complete** | Required by the transition rules |
| Audit trail | complete | Append-only labelled note lines plus mirrored `sponsor_touches`; a correction is a new line, never an edit |
| Contact data exposure | complete | Contact details stay on the sponsor inbox and are deliberately not repeated on the revenue console |

---

## 4A · Placement — featured listing (`locations.is_featured`)

| Step | Status | Notes |
| --- | --- | --- |
| Activation conditions | **was unsafe → complete** | The CRM row was an *optional* free-text box used only to file an audit note. A placement could be switched on with no opportunity, no offer, no term and no payment. Now required, and re-read from the database at the moment of the write |
| Payment gate | **was incomplete → complete** | No code anywhere read `paid_cents`. Now: committed-or-won stage, the right offer, an agreed term, and a confirmed payment covering the agreed amount |
| Placement target | complete | An exact listing, chosen by search |
| Listing must be published | complete | `promotionBlockers` |
| Deleted listing blocked | complete | `promotionBlockers` |
| Held brand blocked | complete | National chains are never promoted |
| Capacity rule | complete | ≤3 per category page **and** ≤3 per corridor page, checked against live data at the write |
| Start date | complete | Required |
| End date | complete | Required — recorded, not enforced (see below) |
| Term matches the sale | **was incomplete → complete** | A monthly deal given a twelve-month window is eleven months given away. The window is now checked against the recorded term |
| Public disclosure | complete | "Sponsored" badge on the card and the detail page |
| Preview before activation | **was incomplete → complete** | The admin now shows what the public will see before the confirmation |
| Explicit confirmation | complete | Type `ACTIVATE` |
| Audit trail | complete | Labelled note line plus a touch against the paying CRM row |
| **Automatic expiry** | **migration required** | A bare boolean cannot expire. See the limitation below |
| Overdue deactivation warning | **was incomplete → complete** | The renewal queue shows it in red and says the placement is *still showing* |
| Deactivation | complete | One control, no confirmation word — stopping is always safe |
| Deactivation scope | complete | Clears `is_featured` only; the listing stays published and unchanged |

## 4B · Placement — corridor sponsor (`directory_sponsors`)

| Step | Status | Notes |
| --- | --- | --- |
| Activation conditions | **was unsafe → complete** | Same missing payment gate as above; same fix |
| Placement target | complete | Exactly one corridor |
| Empty target = wildcard | complete | Refused. `canActivateCorridorSponsor` rejects a blank corridor rather than letting it silently mean *every* corridor page in the country |
| Capacity rule | complete | One primary sponsor per corridor, and the wildcard case is counted as a conflict — missing it is exactly how a page gets double-sold |
| Start / end dates | complete | Required, and `end > start` |
| Term matches the sale | **was incomplete → complete** | As above |
| Active state | complete | `active` boolean plus the window |
| **Automatic expiry** | complete | `activeSponsorsFor` filters the window on every render. No cron, no job |
| Renewal | complete | Renewal queue on the revenue console |
| Deactivation | complete | Instant; restarting re-runs the capacity check because the slot may have been filled |
| Public disclosure | complete | `aria-label="Sponsored"` region with a visible heading |
| Outbound link rel | complete | `rel="sponsored noopener noreferrer"` |
| URL validation | complete | `isSafeSponsorUrl` at render, a `CHECK` in the schema, and a regex at activation |
| Audit trail | complete | As above, plus `created_by` now carries the reviewer |
| Preview before activation | **was incomplete → complete** | |

---

## 5 · The known limitation

`locations.is_featured` is a bare boolean with no date column. A featured
listing therefore **cannot expire on its own**, and no amount of application
code changes that.

What this milestone does instead:

- records the agreed term on the CRM row (`next_action_date`),
- raises an **overdue** warning in the renewal queue the day it passes,
- states in that warning that the placement is *still showing*,
- distinguishes "term expired" from "placement hidden" everywhere both appear,
- provides a deliberate one-click deactivation.

**No migration was created.** `locations.featured_until timestamptz` would be
the smallest correct fix, and it is recommended as the next milestone — but the
brief for this one says not to introduce a migration automatically, and an
unapplied migration sitting in the tree is a schema/code divergence waiting to
be forgotten. The first sale can be operated safely without it, provided the
owner works the renewal queue, and the corridor sponsor — which does enforce its
own term — is the recommended first offer precisely because it removes this
failure mode from the first sale entirely.

---

## 6 · Capacity: what is and is not enforced

Both limits are enforced as **check-then-act inside an admin-gated server
action**, against live data read at the moment of the write:

- one active, in-window primary sponsor per corridor page (wildcards counted),
- ≤3 published, non-deleted featured listings per category page,
- ≤3 per corridor page, checked separately because a listing sits on both.

What is *not* enforced is a database invariant. Making the database refuse an
overrun needs a partial unique index — a migration. With a single administrator
the application check is sound. Two administrators activating the same page in
the same second could still overrun it, and both the placements console and the
revenue console say so rather than implying a guarantee that does not exist.

---

## 7 · Payment boundary

There is no payment processor, no checkout, no card field, no stored
instrument, and no automated invoice anywhere in this flow. Recording a payment
is a statement about money the owner has already seen arrive somewhere else.

Beyond simply not collecting card data, the recording form **actively refuses**
text that looks like a card number, a CVV, a routing or account number, an
expiry date, or a credential — in the reference, the reason, the qualification
note, the next action and the touch summary. It is refused rather than stored
and redacted later.

An active paid placement cannot exist with a zero paid amount, a missing term,
a missing target, or an unconfirmed payment. A free claim can never satisfy the
payment gate, because a claim has no payment — the quote and payment forms
refuse it explicitly rather than by accident.

---

## 8 · What still needs a migration

None of these blocks the first sale.

1. `locations.featured_until` — so a paid featured listing expires by itself.
2. A field separating an editorial pick from a paid slot on `is_featured`
   (today every featured listing is by definition paid; there are zero of them).
3. A partial unique index making capacity a database invariant.
4. A dedicated `source` column on `sponsors`, if campaign attribution should be
   structured rather than a parsed labelled line. The labelled line works and is
   already read back into its own column in the admin, so this is a nicety.

---

## 9 · Summary

| Capability | Before | After |
| --- | --- | --- |
| Receive an inquiry | yes | yes |
| Identify the offer requested | yes, but from free text | yes, from a bounded set |
| Identify the originating surface | yes | yes |
| Detect a duplicate inquiry | no | yes, flagged for a human |
| Qualify and record the outcome | no | yes |
| Record a contact attempt | no | yes |
| Move the pipeline stage | claim review only | yes, gated one step at a time |
| Quote an approved offer and term | no | yes |
| Record a discount with a reason | no | yes |
| Record a manual payment | no | yes, with instrument refusal |
| Refuse to activate an unpaid placement | **no** | **yes** |
| Refuse to activate the wrong offer | no | yes |
| Check capacity before activating | yes | yes |
| Preview the public result | no | yes |
| See the expiry / renewal date | no | yes |
| Warn when a term has lapsed | no | yes, and says the placement is still showing |
| Deactivate or renew | yes | yes |
| Preserve an audit trail | partial | yes, append-only |
| Find someone to call | no | yes, from public business data only |

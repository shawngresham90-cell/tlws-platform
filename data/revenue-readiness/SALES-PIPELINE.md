# Directory sales pipeline

Twelve stages, all of them recordable in fields that already exist. No new
table, no new column, no migration. **No CRM record has been created and nobody
has been contacted** — this is the operating manual, not a log.

## The twelve stages, mapped to real fields

| # | Stage | How it is recorded | Where |
| --: | --- | --- | --- |
| 1 | Prospect identified | row created, `stage='prospect'`, `priority` 1–5 | `sponsors` |
| 2 | Contact sourced | `email` / `phone` filled from an official source | `sponsors` |
| 3 | First contact | `stage='contacted'`, one outbound touch | `sponsors`, `sponsor_touches` |
| 4 | Follow-up | second outbound touch, `next_action_date` set | `sponsor_touches` |
| 5 | Claim requested | inbound inquiry, `tier_interest='listing-claim'` | `sponsors` (auto) |
| 6 | Claim verified | `stage='closed_won'` + review note + touch | claim review action |
| 7 | Sponsored inquiry | `tier_interest='featured-listing'` or `'corridor-sponsor'` | `sponsors` (auto) |
| 8 | Quote sent | `stage='warm'`, `pledged_cents` = the quoted amount, note | `sponsors` |
| 9 | Payment confirmed | `status='paid'`, `paid_cents` = amount received, note | `sponsors` |
| 10 | Placement activated | `status='active'` + placement note + touch | placements console |
| 11 | Renewal due | `next_action='renewal'`, `next_action_date` = 7 or 14 days before the end | `sponsors` |
| 12 | Closed / lost | `stage='closed_lost'` with a reason in the note | `sponsors` |

Two things worth being precise about, because they are easy to get wrong:

- **Stage 6 is not stage 10.** A verified claim is free and changes nothing on
  the site. Only stage 10 turns on a paid placement, and only on the placements
  console, after stage 9.
- **`stage` and `status` are different axes.** `stage` is where the conversation
  is (`prospect → contacted → warm → committed → closed_won/closed_lost`).
  `status` is the commercial state (`new → contacted → paid → active`). A free
  claim ends at `closed_won` and never touches `status='paid'`.

A row moving from 5 → 6 and stopping there is a **success**, not a lost deal. Do
not mark a free claim `closed_lost` because they did not buy anything.

## Daily target

**8 attempts a day, five days a week.** Split: 5 calls, 3 emails. That is one
full pass through the top 25 in three days with room to breathe, and it is a
number one person can actually hit alongside everything else.

Do not raise it to look busy. Twenty-five prospects contacted properly beats a
hundred contacted badly, and the second one burns the list.

## Seven-day contact cadence (per prospect)

| Day | Action | Recorded as |
| --: | --- | --- |
| 0 | Claim email (personalized opening line from the top-25 CSV) | outbound `email` touch |
| 1 | Phone call if a number is on the listing; voicemail if no answer | outbound `call` touch |
| 3 | Nothing. Give them room. | — |
| 4 | Follow-up email — one, and it offers corrections whether or not they buy | outbound `email` touch |
| 7 | Stop. `stage='closed_lost'`, note "no reply after two emails and a call". | — |

Two contacts by email, one by phone, then stop. Anyone who asks not to be
contacted is marked immediately and never contacted again — that outranks the
cadence and every sales target on this page.

## Thirty-day follow-up cadence (after the first week)

| Day | Action |
| --- | --- |
| 14 | Anyone who **claimed** but did not discuss placement: send the featured email. They already trust you enough to correct a listing. |
| 21 | Anyone who said "not yet, show me numbers": nothing unless there is something to show. If analytics is on by then and the figures are real, send them. If not, say nothing. |
| 30 | Review the whole list. What did the objections actually turn out to be? Change the pitch, the price, or the target before the next 25 — not all three. |
| 30 | Re-approach `closed_lost` rows **only** if something material changed (real numbers, a new corridor page, a nearby competitor sponsored). Never "just checking in". |

## Metrics

All of these come from the CRM, which is why they can be counted from day one —
unlike anything that needs analytics.

| Metric | How it is counted |
| --- | --- |
| Contacts attempted | `sponsor_touches` rows, `direction='outbound'` |
| Replies | `sponsor_touches` rows, `direction='inbound'` |
| Qualified inquiries | `sponsors` rows with a directory `tier_interest` |
| Claims | `tier_interest='listing-claim'`; verified = those at `stage='closed_won'` |
| Quotes | rows at `stage='warm'` with `pledged_cents` set |
| Paid placements | rows at `status='active'` |
| Monthly recurring revenue | sum of `paid_cents` for active monthly placements |
| Annual cash collected | sum of `paid_cents` for active annual placements, counted in the month received |
| Churn / cancellations | rows that were `status='active'` and are no longer, with a cancellation note |
| Source / campaign | the `Came from:` line the funnel writes, shown as the Source column in the inbox |

Two rules about these numbers:

1. **MRR counts money received, not money agreed.** A signed yes with no payment
   is stage 8, not stage 9, and contributes nothing.
2. **Do not annualise.** One $99 placement is one $99 placement, not "$1,188
   ARR". At this size that framing only misleads the person reading it.

## What is not measurable yet, and why

- **Which page a lead saw before inquiring.** Analytics is off. The Source
  column tells you which *post or CTA* they came through, which is the useful
  half; it cannot tell you what else they browsed.
- **Whether a sponsored placement performs.** That needs listing-view events,
  which need analytics. Until then, do not tell a sponsor their placement is
  working — you do not know.
- **Cost per acquisition.** There is no spend. When there is, this table needs a
  spend row.

Setting `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` in Netlify closes the first two. It is
the one remaining setup step and it costs nothing to decide.

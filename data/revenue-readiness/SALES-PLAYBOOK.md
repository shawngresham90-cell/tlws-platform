# Directory sales playbook

Approved prices, approved capacity, and the exact words to use. Supersedes the
templates in `LAUNCH-TOP-25.md`, which were written before pricing existed.

| Offer | Price | Capacity |
| --- | --- | --- |
| Listing claim | **Free** | no limit |
| Featured listing | **$99/month or $999/year** | up to **three** per category or corridor page |
| Corridor sponsor | **$299/month or $2,999/year** | **one** primary sponsor per corridor page |

Annual is $189/yr cheaper than twelve monthly on featured, $589/yr cheaper on
corridor. Those figures are derived in `src/lib/directory/offers.ts`; if a price
ever changes, change it there and everything else follows.

**Nothing has been sent. No outreach may go out without separate approval.**

## The three rules

1. **No numbers we cannot show.** No traffic, leads, ranking, conversion, or
   revenue figures. Measurement is wired but not switched on (see below). Saying
   "I would rather show you real numbers than sell you a guess" is a better
   pitch than a made-up one, and it is true.
2. **No guarantees.** Not of customers, calls, position, or results.
3. **Claim first.** The free ask is the opener with every prospect. Placement is
   the second conversation, after they have seen the listing is real.

---

## Email — claim (the opener for all 25)

> **Subject:** Your listing on the Trucking Life truck stop directory
>
> Hi — I run Trucking Life with Shawn. We publish a directory drivers use to
> find truck stops, repair, washes, parking and scales along the interstates.
>
> **[BUSINESS]** is on it: **[DIRECTORY URL]**
>
> I built that listing from public information, so I would rather you check it
> than have me guess. Hours, services, phone, anything wrong — tell me and I
> will fix it.
>
> Claiming it is free. There is a button on the page, or just reply. Nothing
> changes until I have reviewed it, and claiming does not commit you to
> anything.
>
> — Shawn

## Email — featured listing

> **Subject:** Featured placement on the **[CATEGORY]** page
>
> Hi — **[BUSINESS]** is listed at **[DIRECTORY URL]**, on our
> **[CATEGORY PAGE]** page.
>
> I have opened featured placement on category and corridor pages: a featured
> business sits above the standard results and is labelled Sponsored. It is
> **$99 a month, or $999 a year**. I run up to three featured businesses per
> page, so it does not turn into a wall of ads.
>
> Straight answer on the part you will ask about: I am not going to quote you
> traffic. The directory's measurement is still being set up and I would rather
> show you real numbers once they exist than sell you a guess. If that means you
> want to wait, that is a fair call and I will come back to you when I have
> something to show.
>
> Month to month is fine — start, see nothing you like, stop.
>
> — Shawn

## Email — corridor sponsor

> **Subject:** Sponsoring the **[CORRIDOR]** pages
>
> Hi — **[BUSINESS]** shows up at **[DIRECTORY URL]**, on our **[CORRIDOR]**
> corridor pages.
>
> I keep **one** primary sponsor per corridor. For **[CORRIDOR]** that slot is
> **$299 a month, or $2,999 a year**, and it covers the corridor pages a driver
> browses when they are planning that run — not a single listing.
>
> [For a multi-site operator:] You have more than one location on
> **[CORRIDOR]** with us, so this is one sponsorship covering all of them rather
> than separate placements.
>
> Same honesty as always: no traffic numbers yet, no promises about calls. If
> you want it, I will send an invoice and turn it on; if you want to wait until
> I can show you figures, say so and I will hold the conversation, not the slot.
>
> — Shawn

## Follow-up — one, then stop

> **Subject:** Re: your directory listing
>
> Hi — following up once on **[BUSINESS]**'s listing at **[DIRECTORY URL]**.
>
> Whether or not you ever want placement, I would still like the details right.
> Reply with any corrections and I will take care of them.
>
> If you would rather not hear from me again, say so and I will not write again.
>
> — Shawn

## Facebook / Instagram DM (short)

> Hi — I run the Trucking Life truck stop directory. **[BUSINESS]** is listed on
> it: **[DIRECTORY URL]**. I built the listing from public info — can you check
> the hours and services are right? Claiming it is free and takes a minute.
> Happy to fix anything that's wrong either way.

Second DM only if they reply. Never a third.

## Phone script

> "Hi — is the owner or the manager around?
>
> My name's Shawn. I run a truck stop directory that drivers use to find repair
> and parking along **[CORRIDOR]**. **[BUSINESS]** is listed on it — I built the
> listing from public information, so I'd rather have you check it than have me
> guess. Are your hours and services right?
>
> [Listen. Take corrections. That is the whole first call.]
>
> I'll send you the link so you can see it. Claiming it is free and nothing
> changes until I've reviewed it.
>
> [Only if they ask about placement:] There is a paid option — featured on your
> category page is $99 a month or $999 a year, and I keep it to three per page.
> Sponsoring the whole **[CORRIDOR]** is $299 a month or $2,999 a year, one
> sponsor per corridor. But I'm not going to quote you traffic numbers I can't
> back up yet, so if you'd rather wait until I can show you real figures, that's
> the sensible call."

On the call: never state a number you cannot show, never promise placement,
ranking, or leads, never say the listing is verified, and never take payment
details over the phone.

---

## Objection responses

**"How much traffic do you get?"**
> "I'm not going to give you a number I can't back up. Measurement went in
> recently and there's no meaningful history yet. When there is, I'll show you
> the actual figures — including if they're small. If you want to wait for that,
> wait. I'd rather you buy the second conversation than the first."

**"Can you guarantee customers?"**
> "No, and anyone who does is selling you something. What I can tell you is
> exactly what you get: your listing above the standard results on
> **[PAGE]**, labelled Sponsored, and no more than three businesses in that
> position. Whether drivers call you is between you and them."

**"Why should I pay when I'm already listed?"**
> "You don't have to. The listing stays, free, whether you pay or not — and
> claiming it and correcting it is free too. What $99 buys is position on the
> page a driver is actually looking at when they're picking someone. If that's
> not worth $99 to you, keep the free listing; I'd rather have you listed and
> accurate than annoyed."

**"Can I cancel?"**
> "Monthly, yes — tell me and I stop it at the end of the month you've paid for.
> No notice period and no cancellation fee. Annual is a year up front; if you
> want out partway I'll refund the unused whole months. That's a promise about
> money, which I can keep — unlike a promise about results."

**"Can I claim it without paying?"**
> "Yes. Claiming is free and always will be, and I don't put claims behind
> payment or move paying businesses up the queue. Send it in, I'll check it's
> really your business, and I'll fix what's wrong."

---

## Manual invoice and activation checklist

There is **no checkout, no card capture, and no Stripe integration** in the
directory funnel — deliberately. Every sale is invoiced by hand.

**Before invoicing**
- [ ] Business confirmed the offer and the term in writing (email or a reply you
      can point at).
- [ ] Price matches the approved figures exactly.
- [ ] For a corridor sponsor: the corridor's one primary slot is genuinely free.
- [ ] For a featured listing: fewer than three featured businesses on that
      category/corridor page today.
- [ ] Listing is claimed and correct first. Do not sell placement on a listing
      the business has not confirmed is accurate.

**Invoice**
- [ ] Raise the invoice manually. Amount, term, start date, what it covers, and
      the cancellation terms above, in writing.
- [ ] Do not activate on a promise. Activate on payment.

**Activation — featured listing**
- [ ] `/admin/directory` → the listing → tick **Featured listing**
      (`locations.is_featured`). That is the whole switch.
- [ ] Verify on the live category and corridor page: the listing sits above the
      standard results and carries the **Sponsored** badge.
- [ ] Count the featured businesses on that page. If it is now four, you have
      oversold — remove one and refund.

**Activation — corridor sponsor**
- [ ] `/admin/directory/sponsors` → create a `directory_sponsors` row.
- [ ] Placement `interstate`; `interstates` set to the corridor (`I-95`);
      `starts_at` / `ends_at` set to the paid term.
- [ ] Outbound link is theirs and is `http(s)`. Every sponsor link is rendered
      with `rel="sponsored noopener noreferrer"` automatically.
- [ ] Verify on the live corridor page, and confirm there is exactly one primary
      sponsor on it.

**Renewal / cancellation**
- [ ] Diary the end date. A `directory_sponsors` row outside its window stops
      showing on its own; `is_featured` does **not** — untick it by hand.
- [ ] On cancellation: untick / deactivate, confirm the live page, and reply
      confirming it is off and what (if anything) is being refunded.

---

## Sales tracking — the fields, and where they live

No new table, no migration. Everything below is an existing column.

| Field | Column | Notes |
| --- | --- | --- |
| Business | `sponsors.company` | |
| Contact | `sponsors.contact_name`, `.email`, `.phone` | from their reply — never invented |
| Inquiry type | `sponsors.tier_interest` | `listing-claim` / `featured-listing` / `corridor-sponsor` |
| Which listing | `sponsors.notes` line 1 | written by the funnel, shown in the inbox as its own column |
| Billing preference | `sponsors.notes` line 2 | a preference, not a payment |
| Stage | `sponsors.stage` | prospect → contacted → warm → committed → closed_won/lost |
| Priority | `sponsors.priority` | 1–5 |
| Next action | `sponsors.next_action`, `.next_action_date` | now visible in the inbox |
| Every touch | `sponsor_touches` | type, direction, summary, timestamp |
| Status | `sponsors.status` | the inbox toggle |

Filter the inbox to directory leads at `/admin/sponsors?view=directory`.
Lead source and campaign attribution are **not** in the CRM — see
`docs/directory/crm-directory-inquiries.md` for why and where they do live.

## 30-day outreach cadence

One pass through the top 25, claim-first, then stop and look at what came back.

| Days | What |
| --- | --- |
| 1–3 | Claim email to ranks 1–10. Log each as a `sponsor_touches` outbound row. |
| 4–7 | Claim email to ranks 11–25. Phone the 13 high-confidence prospects — the phone is on their listing. |
| 8–10 | Process every reply: correct the listing, run the claim verification checklist, reply to all. |
| 11–14 | Placement conversation with anyone who claimed. Featured for 23, corridor for the two Snider sites (one sale, not two). |
| 15–18 | Single follow-up to non-responders. One, then stop. |
| 19–25 | Invoice and activate anyone who said yes. Verify each activation on the live page. |
| 26–30 | Review: claims received, placements sold, what the objections actually were. Decide whether the pitch or the price needs to change before the next 25. |

Hard rules for the month: one follow-up per prospect, never a second; anyone who
asks to be left alone is removed and never contacted again; anyone who asks for
their listing to come down gets it taken down, no negotiation, no upsell.

## Metrics dashboard — the spec

The events exist (`src/lib/directory/funnel.ts`, 14 of them). The receiver does
not: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset in Netlify and no existing Plausible
account covering the production domain could be proven, so analytics was **not**
enabled and no account was created and no charge was incurred. `trackEvent`
no-ops safely without it, so the wiring is inert until that one variable is set.
**That is the single remaining setup step.**

Once it is set, these are the panels worth building — and none of them can be
back-filled, so day one is the baseline:

| Panel | Metric | Events |
| --- | --- | --- |
| Are businesses seeing the CTA? | claim-interest clicks ÷ listing views | `directory_claim_interest` ÷ `directory_listing_view` |
| Does the form convert? | submits ÷ starts | `directory_inquiry_submit` ÷ `directory_inquiry_start` |
| Is the form broken? | fails ÷ (submits + fails) | `directory_inquiry_fail` |
| Which offer do they pick? | submits by `interest` | `directory_inquiry_submit` |
| Monthly or annual? | submits by `billing` | `directory_inquiry_submit` |
| Which categories respond? | submits by `category` | `directory_inquiry_submit` |
| Which corridors respond? | submits by `corridor` | `directory_inquiry_submit` |
| Do drivers use the directory at all? | searches, filters, map, directions, phone, website clicks | `directory_search`, `directory_filter`, `directory_map_interact`, `directory_directions_click`, `directory_phone_click`, `directory_website_click` |
| Does a sponsored page perform? | listing views on featured vs standard listings | `directory_listing_view` by `slug` |

**Do not set a target before there is data.** Two weeks of real numbers first,
then targets. And no number from this dashboard goes into a sales conversation
until it is large enough to mean something — a week of 40 pageviews is not a
pitch, it is a starting point.

# Revenue baseline — what it takes to get the first paid customer

Audited against `main` at `dc08202` (PR #191 merged) and the live database on
2026-07-26. Everything below is either read from the code, read from the
database, or read from the Netlify deploy API.

**What is not claimed:** this environment cannot reach the production domain
(the egress policy blocks it and that was not bypassed), so nothing here asserts
how a page actually renders to a visitor on `truckinglifewithshawn.com`. Where
production behaviour matters, it says so and names who can check it.

---

## 1. Ready to sell

| | State |
| --- | --- |
| Published listings | **1,165** live, of which 393 are the service categories worth selling (tire-repair 114, roadside-service 79, truck-washes 46, plus parking/hotels) |
| Public offer page | `/sponsors` — three offers, approved prices, capacity stated, framed as an inquiry |
| Listing-level CTAs | Claim + featured on every published, non-held detail page |
| Inquiry capture | `POST /api/sponsor-inquiry` — Turnstile-protected, rate-limited, writes `sponsors` + an inbound `sponsor_touches` row |
| Inquiry triage | `/admin/sponsors` with a directory filter, parsed type / listing / corridor / billing / **source** columns |
| Claim review | Five-item checklist, refuses to verify until all are ticked, records reviewer and date, never touches the listing |
| Paid activation | `/admin/directory/placements` — capacity-checked, end-date-required, typed confirmation |
| Disclosure | Every paid placement renders **Sponsored**; sponsor links carry `rel="sponsored noopener noreferrer"` |
| Campaign attribution | `?from=<token>` → a `Came from:` line on the inquiry → Source column |
| Pricing integrity | One module; a test fails the build if any surface shows an unapproved figure |

**The product can take a sale today.** Nothing in the path requires code.

## 2. What still prevents a real sale

Nothing in the software. Five things outside it:

| # | Blocker | Owner | Effort |
| --: | --- | --- | --- |
| 1 | **Nobody has been contacted.** Zero outreach sent; `sponsors` has 0 rows. | Shawn — approve and send | hours |
| 2 | **No way to take money.** No payment integration by design. An invoice has to be raised by hand and paid outside the platform. | Shawn — decide the method (invoice, transfer, Zelle) | one decision |
| 3 | **No measurement.** `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset, so nothing records a listing view. You can still sell — you just cannot report on it afterwards. | Shawn — set one variable, or accept the pilot scorecard | minutes |
| 4 | **The pitch has no numbers behind it.** That is a deliberate honesty choice, not a defect, but it makes the first sale harder and the fifth easier. | time | weeks |
| 5 | **Featured expiry is manual.** Accepted for the pilot. Every activation demands an end date, but the calendar reminder is a human step. | Shawn — put it in a calendar | per sale |

Not blockers, worth knowing:

- 12 of the 75 approved candidates have neither a phone nor a website on record.
  They are in `SOURCING-QUEUE.csv` and none of them is in the first ten.
- The capacity guard is check-then-act, sound for one administrator. Documented
  for correction before a second person uses the console.

## 3. Shawn versus an administrator

Today these are the same person, which is why the split is written down now
rather than after it stops being true.

| Step | Shawn only | Any administrator |
| --- | --- | --- |
| Approve outreach going out | ✅ | |
| Send an email, call, DM | ✅ | |
| Publish a social post | ✅ | |
| Agree a price or a discount | ✅ | |
| Raise an invoice | ✅ | |
| **Confirm payment received** | ✅ | |
| Approve a refund or an early cancellation | ✅ | |
| Verify a listing claim | | ✅ |
| Correct listing details after a claim | | ✅ |
| Activate a placement *after* payment is confirmed | | ✅ |
| Stop or expire a placement | | ✅ |
| Log a touch, update stage / next action | | ✅ |

The hard line: **an administrator never activates a placement without Shawn
confirming payment.** Nothing in the software enforces that — it cannot, because
there is no payment integration — so it is a procedural rule and the activation
checklist puts it first.

## 4. Manual versus automated

| Step | |
| --- | --- |
| Listing exists and is discoverable | **automated** |
| Business finds the claim/featured CTA | **automated** |
| Inquiry reaches the CRM with listing, billing and source attached | **automated** |
| Inbound touch logged | **automated** |
| Corridor sponsor stops at its end date | **automated** |
| Sponsored label and `rel="sponsored"` | **automated** |
| Capacity refusal at activation | **automated** |
| Everything else — outreach, verification, quoting, invoicing, payment, activation, renewal, expiry of a featured listing | **manual** |

That ratio is correct for a pilot. Automating any of the manual steps before
there is a paying customer would be building for a business that does not exist
yet.

## 5. The exact customer journey

**A. Inbound — the business finds it themselves**

1. Driver or owner lands on `/directory/location/<slug>`.
2. Owner sees **Own or manage this business?** → *Claim this listing* (free) or
   *Ask about featured placement* ($99/mo or $999/yr, up to three per page).
3. Click deep-links to `/sponsors?interest=…&listing=…&lcorr=…&from=directory-listing#inquire`.
4. The form shows them exactly what will be sent: the listing line, the billing
   line if they pick one, the source line. Nothing hidden.
5. Turnstile → `POST /api/sponsor-inquiry` → one `sponsors` row
   (`stage='contacted'`, `tier_interest` = the offer id) + one inbound touch.
6. It appears at `/admin/sponsors?view=directory` with type, listing, corridor,
   billing preference and source as columns.

**B. Outbound — Shawn goes to them** (steps 1–4 replaced)

1. Prospect from `FIRST-10-QUEUE.csv`.
2. Shawn sends the personalized **claim** email — free, no pitch.
3. They reply, or claim through the link carrying their `?from=pNN-…` token.
4. Joins the same pipeline at step 5 above.

**C. Claim → paid (both paths converge)**

7. Administrator runs the five-item checklist. Verify → `stage='closed_won'`,
   reviewer and date on the note, touch logged. **The listing does not change.**
8. Any correction they asked for is made afterwards as a normal listing edit,
   against the same evidence bar as any other edit.
9. Placement conversation. Featured for most; corridor sponsor only where one
   operator covers a corridor.
10. Shawn quotes in writing → `stage='warm'`, `pledged_cents`.
11. Shawn invoices by hand. **Outside the platform.**
12. Payment lands and clears → `status='paid'`, `paid_cents`.
13. Administrator opens `/admin/directory/placements`, confirms capacity is
    still free, sets billing + start + **required** end date + reviewer, types
    `ACTIVATE`.
14. Verify on the live category page and corridor page: above the standard
    results, badged **Sponsored**.
15. **Calendar reminder for the end date.** A featured listing will not expire
    on its own.
16. `status='active'`, `next_action='renewal'`, `next_action_date` = 7 days
    (featured) or 14 days (corridor) before the end.
17. Renewal or stop. A corridor sponsor stops itself; a featured listing has to
    be unticked.

**Shortest possible path to the first dollar:** step B1 → B2 → reply → 9 → 10 →
11 → 12 → 13. Seven human steps, no code, no new tooling.

---

## The finding that should change the plan

Corridor pages are **not** equally valuable, and the one most often named first
is our thinnest. Published listings per corridor, and how many are the service
businesses that make a page worth browsing:

| Corridor | Published | Service businesses |
| --- | --: | --: |
| **I-75** | 404 | 97 |
| **I-40** | 240 | 68 |
| **I-65** | 162 | 41 |
| I-95 | 65 | 26 |

I-95 has the strongest name recognition and the weakest page. A corridor
sponsorship on I-75 is a materially better product than the same sponsorship on
I-95, and the first-contact queue has been re-weighted accordingly — 6 of the
first 10 are on I-40 or I-75.

The two I-95 prospects that remain in the first ten are both Snider Fleet
Solutions, and they are **one sale**: one corridor page, one primary sponsor,
two of their branches covered.

## Pilot decisions recorded

Per Shawn's approval, and repeated here because they constrain everything above:

- `is_featured` means **paid placement only**. It is never an editorial pick.
- The visible `?from=` attribution tokens stay.
- Manual featured expiry is accepted for the pilot **on condition** that every
  activation requires an end date (enforced in code) and a calendar reminder
  (enforced by checklist).
- The single-admin capacity race is accepted for the pilot and must be fixed
  before a second administrator uses the console.
- Plausible stays disabled unless an existing authorized account can be proven.

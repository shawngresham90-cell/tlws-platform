# Pilot sales operating procedure

The complete manual workflow from "we picked a prospect" to "the placement
expired or renewed". Written for the pilot, where Shawn and the administrator
are the same person — which is exactly why the split is written down.

**Not legal advice.** The refund and cancellation wording below is a starting
point for Shawn to decide on, not a reviewed contract term.

---

## The thirteen steps

| # | Step | Who | Recorded as |
| --: | --- | --- | --- |
| 1 | Prospect identified | admin | `sponsors` row, `stage='prospect'`, `priority` |
| 2 | Contact verified from an official source | admin | `email` / `phone` filled |
| 3 | Outreach logged | Shawn sends, admin logs | outbound `sponsor_touches` row |
| 4 | Claim verified | admin | `stage='closed_won'` + note + touch |
| 5 | Offer selected | Shawn | `stage='warm'`, `pledged_cents` |
| 6 | **Payment confirmed manually, outside the app** | **Shawn only** | `status='paid'`, `paid_cents` |
| 7 | Placement capacity rechecked | admin | the console recounts live |
| 8 | Start and end dates recorded | admin | console form (end date required) |
| 9 | **Calendar expiration reminder created** | admin | outside the app + `next_action_date` |
| 10 | Placement activated | admin | typed `ACTIVATE` → note + touch |
| 11 | Sponsored disclosure verified on the live page | admin | eyes on the page |
| 12 | Attribution and inquiry results reviewed | Shawn | Source column + scorecard |
| 13 | Renewal or deactivation | Shawn decides, admin executes | console + CRM |

Step 6 is the hard line. **An administrator never activates a placement without
Shawn confirming payment.** No software enforces this — there is no payment
integration — so it is procedural, and step 10 refuses without step 8's end
date, which at least forces a pause.

---

## Capacity checklist (before quoting, and again before activating)

- [ ] Open `/admin/directory/placements` and read the **Capacity in use** panel.
- [ ] For a featured listing, check **both** pages it will appear on: its
      category page and its corridor page. Either at 3/3 blocks the sale.
- [ ] For a corridor sponsor, check the corridor has no primary sponsor — and
      no sponsor with **blank targeting**, which silently occupies every
      corridor. The console flags those as `EVERY CORRIDOR — check this`.
- [ ] Re-check at activation, not just at quote. Between the two, someone else
      may have taken the slot.
- [ ] If you oversell: remove the newest placement and refund it. Do not leave
      four on a page and hope.

## Held-brand checklist

Never promoted, no exceptions, no matter who asks or offers:

- [ ] Love's · Pilot · Flying J · Sapp Bros · Goasis · Thorntons
- [ ] TA / TA Express / Petro / TravelCenters of America, and the CAT scales
      colocated at them — correct listings, but nobody at the site can buy a
      placement, so selling one would misrepresent the relationship.
- [ ] Any national chain where the person you are talking to cannot authorise
      local marketing spend. Ask directly: *"can you sign off on this, or does
      it go to a group marketing budget?"*
- [ ] Any unpublished or deleted listing.

The console refuses the first two lists automatically. The third is a judgement
call you have to make on the call.

## Claim-verification checklist

Full procedure: `docs/directory/claim-verification.md`. The admin form refuses
to verify until all five are ticked.

- [ ] **Identity** — name, address and phone match the listing.
- [ ] **Authority** — they state their role; an agency names the business that
      authorised them and you confirm with the business, not the agency.
- [ ] **Two of three match** an official source: phone, domain, address. A free
      mailbox counts as zero for domain, so phone *and* address must match.
- [ ] **Requested changes** written down, each separately evidenced. Never
      change truck-parking status on a claimant's word alone.
- [ ] **No fraud signs** — urgency, refusal to take a call on the published
      number, competitor details, a removal request for a rival, or payment
      offered to speed it up.

Verifying a claim **does not change the listing**. Corrections are a separate,
deliberate edit afterwards.

## Manual invoice and payment-confirmation checklist

- [ ] Offer, price and term confirmed **in writing** — something you can point
      at later.
- [ ] Price matches the approved figures exactly: featured $99/mo or $999/yr,
      corridor $299/mo or $2,999/yr. No improvised discount.
- [ ] Capacity confirmed free today.
- [ ] Listing claimed and confirmed accurate first.
- [ ] Invoice states: amount, term, start and end date, what it covers, that it
      is labelled Sponsored, and the cancellation terms.
- [ ] **Payment received and cleared.** Not promised, not "sending it today".
- [ ] `status='paid'`, `paid_cents` set, note added with the date and method.

## Activation and rollback checklist

**Activate**
- [ ] Capacity rechecked (above).
- [ ] Billing, start date, **end date**, reviewer name entered.
- [ ] Typed `ACTIVATE`. The console does nothing until you do.
- [ ] Calendar reminder created for the end date, and one a week earlier.
- [ ] `next_action='renewal'`, `next_action_date` set.
- [ ] Live page checked: above the standard results, badged **Sponsored**.
- [ ] Count the sponsored listings on that page. Four means roll back.

**Roll back** — if anything above is wrong, or the payment reverses:
- [ ] Featured: untick on the console. Immediate.
- [ ] Corridor: Stop on the console. Immediate.
- [ ] Verify the live page no longer shows it.
- [ ] Note in the CRM: what happened, who decided, what was refunded.
- [ ] Tell the business the same day. A silent rollback is worse than the error.

Rollback needs no confirmation word by design. Stopping is always safe; starting
is the dangerous direction.

## Expiration procedure

The two offers behave differently and this is the most likely thing to go wrong.

**Corridor sponsor — automatic.** The block stops rendering the moment
`ends_at` passes. No action needed. Still contact them before the date so it is
a decision rather than a surprise.

**Featured listing — manual.** `locations.is_featured` is a boolean with no
expiry. It will keep running until someone unticks it.

- [ ] 7 days before the end date: contact them about renewal.
- [ ] On the end date: renew (re-invoice, extend the recorded term) **or**
      untick it on the console.
- [ ] Verify the live page no longer shows the Sponsored badge.
- [ ] Update the CRM. Free the capacity for the next sale.
- [ ] If you renew, set a new calendar reminder. Every time.

Running a paid placement past its term is giving away inventory and, worse,
means the page is not showing what the next buyer paid for. Once a month, open
the console and read every featured listing against its recorded end date.

## Refund and cancellation — decision points for Shawn

Not decided here. These are the calls to make once, in advance, so they are not
made under pressure:

| Situation | Suggested default | Shawn decides |
| --- | --- | --- |
| Monthly, cancels mid-month | Run to the end of the paid month, then stop | ☐ |
| Annual, cancels part way | Refund unused **whole** months | ☐ |
| Business closes | Stop immediately, refund pro-rata, take the listing down | ☐ |
| We oversold a page | Refund the newest in full, apologise, stop it same day | ☐ |
| They are unhappy but the placement ran correctly | Offer the remaining term as a refund once, not repeatedly | ☐ |
| Payment reverses / chargeback | Stop immediately, then talk | ☐ |
| We changed the product (removed a page) | Refund pro-rata, unprompted | ☐ |

Whatever is chosen must match what the invoice says. Do not invoice one thing
and decide another later.

## The never-promise list

Not because of policy — because these are things nobody can honestly promise.

- Any traffic, impression, view, click or reach number.
- Any number of leads, calls or customers.
- A search ranking, or "top of Google".
- Revenue, ROI, or a payback period.
- That a placement will be "worth it".
- That a claim will be approved before it is reviewed.
- That a listing is verified, when it is not.
- That we will remove or downrank a competitor. Ever, at any price.
- That paying moves them up the claim-review queue.
- That the directory has more users than it does. If asked and the number is
  small, **say the small number**.
- Exclusivity beyond what is sold: one corridor sponsor per corridor is not
  exclusivity across the site.
- Anything about another business's performance.

If a prospect needs one of these to say yes, they are not a pilot customer.
Leave the free listing accurate and move on — that is a good outcome, not a
lost one.

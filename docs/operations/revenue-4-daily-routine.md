# The daily revenue routine

What to do, in order, to move a business from a name on a list to a paid,
live placement — and how to know when to go back to them.

Written for the person doing the selling. One screen runs the whole thing:
**`/admin/directory/revenue`**.

**Nothing on that screen contacts anybody.** No email, no text, no invoice.
Every button records something that already happened.

---

## 1. Where do I start?

Open `/admin/directory/revenue` and read **Today's money**, top to bottom.

That list is ordered by how close each row is to money, not by when it arrived:

| Order | Pile | What it means |
| --- | --- | --- |
| 1 | **Paid — activate now** | They have paid. The only thing between that money and a live placement is you. |
| 2 | **Said yes — chase the payment** | Committed, nothing received. |
| 3 | **Follow-up overdue** | You said you'd get back to them and the date has passed. |
| 4 | **Follow up today** | Due today. |
| 5 | **Quoted — no answer yet** | They have the price and have gone quiet. |
| 6 | **New lead** | Nobody has worked it yet. |
| 7 | **Renewal coming up** | A live placement is inside 30 days of ending. |

Work down. If the list is empty, nothing needs you today — everything open is
scheduled for later, live, or closed.

Above it, the **Pipeline** tiles are counts of exactly the same rows, so a tile
and the list under it cannot disagree.

---

## 2. Who do I contact first?

Whoever is at the top. The order already is the answer.

Two tiles deserve a second look every morning:

- **No next step set** — a real opportunity with nothing scheduled is how a deal
  quietly dies. Open it and set a next step.
- **Renewals due** — money you already earned, about to stop.

### When the pipeline is empty

That is the normal starting state, and the page says so rather than looking
broken. Two steps:

1. **Pick someone to call.** The **Prospect shortlist** at the bottom of the
   page ranks businesses from the public directory by how complete their listing
   already is, whether they sit on a corridor, and whether the category has
   anyone to sell to. Held national chains are excluded — nobody at a Love's
   counter can sell you a placement. It contacts nobody; it is a list.
2. **Open the opportunity** the moment the call ends, using **Open an
   opportunity** on the same page.

Inbound inquiries through `/sponsors` land in the pipeline on their own, with
their first follow-up already scheduled.

---

## 3. How do I record what happened?

Open the opportunity (the **Open** button on any card), then use **1 · Record a
contact**: how you reached them, which direction, and one line about what
happened. It appends to the history and never overwrites an earlier entry.

Use plain outcomes — *"Left a voicemail"*, *"Wants to see the corridor page"*,
*"Not this year"*. What you type is the record you will read in three weeks.

**2 · Qualification** is for what you learned about the business: who decides,
how many locations, whether they buy advertising at all.

---

## 4. How do I schedule follow-up?

**Set what happens next** on the open opportunity: the action, and the date.

The queue is only honest if that date is kept. A row with no next step shows as
**No next step set** and is counted in its own tile — visibly incomplete rather
than quietly invisible.

Never guess a date to clear the warning. If you don't know when to call back,
that is a decision to make, not a field to fill.

---

## 5. What happens when somebody commits?

Two things, in order:

1. **Record the quote** — the offer, the term, and the amount actually agreed.
   Prices come from the offer list and are the only prices the platform knows:
   Featured listing $99/month or $999/year, Corridor sponsor $299/month or
   $2,999/year. A different price is allowed but never silent: it needs an
   explicit figure and a written reason, and it applies to that one deal only.
2. **Move the stage to Committed.** One step at a time — nothing jumps from a
   fresh inquiry to closed-won.

They now appear under **Said yes — chase the payment**.

---

## 6. What happens when somebody pays?

**Take the money outside the platform.** Bank transfer, cheque, invoice —
whatever you already do. This platform holds no card details anywhere and
refuses free text that looks like any.

Then, on the opportunity, **Record payment**: the amount, the day it arrived, a
reference you already hold (*"check 1042"*, *"bank transfer"*), and tick **I
have seen this money arrive**.

Nothing goes live on an unconfirmed payment, and a part payment is not a paid
deal — the row stays under *chase the payment* until the full agreed amount is
recorded.

They now appear at the very top, under **Paid — activate now**.

---

## 7. How do I activate them?

Press **Activate this placement** on the card.

That link carries the business, the opportunity and the term across to the
placements console for you — there is no id to copy and nothing to retype. The
link itself changes nothing.

On the other side you get the activation checklist: twelve lines covering
payment, term, the exact end date that will be written, listing eligibility and
capacity. **If any line reads NO there is no activate button on the page.** When
every line passes, type `ACTIVATE`.

That is the only place a placement is switched on, and it is deliberately a
separate, deliberate act.

---

## 8. How do I know when to renew them?

The **Renewals and expiry** section, which reads the placement itself — not the
CRM's copy of it. A placement you stopped by hand stops appearing here even if
the opportunity row still looks live.

| Standing | Meaning |
| --- | --- |
| **Renewal approaching** | Inside 30 days of the end. |
| **Renewal due** | Inside 7 days. |
| **Ended — needs contact** | The term has passed. The placement is already off the public pages. |

Nothing renews itself, nothing charges anything, and no term is ever extended
automatically. A renewal is a second sale: quote, payment, then activate — the
same steps in the same order.

### The one thing to know about timing

**A renewal starts the day you press it, not when the old term ends.**

So renewing a live placement with 12 days left gives them one month from today
and those 12 paid days are gone. The card tells you the exact number before you
commit:

> Renewing today replaces the 12 paid days still left on this term rather than
> adding to them. Renew on the last day to give none of it away.

**Renew on the last day of the term.** Set a next step for that date the moment
you activate, and the queue will bring it back to you.

---

## What this screen will not do

- It will not contact anybody — no email, no text, no automated anything.
- It will not take a payment or store a card.
- It will not activate, renew, extend or stop a placement. Those live on the
  placements console, behind the checklist.
- It will not invent a date, an amount, or a conversion rate. Where there is no
  data it says so.

---

## If something looks wrong

**A business appears twice.** The console flags near-matches on the opportunity
you have open. Two rows for one relationship is how a placement gets sold twice
— work the older one and close the other as lost with a reason.

**A row says live but the placement is off.** Liveness is read from the
placement, so this should not happen. If it does, the opportunity's `status`
column has drifted from reality; the queue ignores that column deliberately, and
the row's live state on this page is the one to trust.

**A price here disagrees with something you sent.** The offer list in the code is
the only place a price exists. If a document disagrees with the screen, the
screen is right and the document is stale.

# First paid Directory sponsor — the owner's kit

Everything Shawn needs to take one business from "never heard of us" to a live,
labelled, paid placement — and to stop or renew it when the term ends.

**Nothing in this document has been sent.** No message here was delivered to any
business, no address was collected, and the platform contacts nobody. These are
templates for a human to send by hand.

Prices come from `src/lib/directory/offers.ts`, which is the only place in the
codebase a price exists. If a figure here ever disagrees with that file, the
file is right and this document is stale.

---

## The offers, exactly as approved

| Offer | Price | Capacity | Expires by itself? | Public label |
| --- | --- | --- | --- | --- |
| Listing claim | Free | — | n/a | none — a claim changes nothing publicly |
| Featured listing | $99/month or $999/year | up to 3 per category or corridor page | **No** — stopped by hand | Sponsored |
| Corridor sponsor | $299/month or $2,999/year | 1 primary per corridor page | **Yes** — the window is enforced on every render | Sponsored |

Paying annually costs $189 less than twelve monthly payments on a featured
listing, and $589 less on a corridor sponsorship. Both figures are derived from
the two prices, never written by hand.

### What no paid placement ever buys

Say these out loud in the first conversation, not the last:

- No guaranteed traffic, leads, calls or sales.
- No guaranteed search ranking.
- Paid placement never changes a listing's facts, parking truth, hours or reviews.
- Every paid placement is labelled **Sponsored** and carries `rel="sponsored"`.
- A claim never gives the claimant permission to edit their listing directly.

---

## A. Initial email (75 words)

> **Subject: Your [BUSINESS] listing on Trucking Life with Shawn**
>
> Hi [NAME] — I'm Shawn. I run a truck stop and parking directory drivers use to
> plan where they'll sit for the night, and [BUSINESS] is already listed on it,
> free and accurate.
>
> I'm opening a small number of sponsored placements on the [I-XX] corridor page.
> One primary sponsor per corridor, $299 a month or $2,999 a year, labelled
> Sponsored.
>
> Worth ten minutes? I'll show you the page either way.

---

## B. 30-second phone opener

> "Hi, is [NAME] around? — [NAME], my name's Shawn, I run Trucking Life with
> Shawn. We've got a truck stop and parking directory drivers use to plan their
> night, and you're already on it — free, and I'd like it to be accurate whether
> or not we ever do business.
>
> The reason I'm calling: I'm opening one sponsor slot on the [I-XX] page. One
> per corridor. I'm not going to promise you traffic numbers because I don't
> have any I'd stand behind yet. What I can tell you is exactly where it shows
> and what it costs. Have you got two minutes, or should I call back?"

---

## C. Voicemail

> "Hi [NAME], Shawn here from Trucking Life with Shawn — we run the truck stop
> and parking directory. [BUSINESS] is already listed, free. I'm calling about
> one sponsor slot on the [I-XX] corridor page, and I wanted you to hear it from
> me rather than find it. No rush — [PHONE]. Thanks."

---

## D. Text / DM opener

> Hi [NAME] — Shawn from Trucking Life with Shawn. [BUSINESS] is already on our
> truck stop directory (free, and staying free). I've got one sponsored slot open
> on the [I-XX] corridor page and thought of you. Want me to send the page and
> the price?

---

## E. First follow-up (3–5 days later)

> **Subject: Re: Your [BUSINESS] listing**
>
> Hi [NAME] — following up once on the [I-XX] sponsor slot.
>
> Here's the page: [LINK]. Your listing is the free one, and it stays free and
> accurate either way. The sponsored block sits above it, labelled Sponsored, and
> it's $299 a month or $2,999 a year for the one primary slot on that corridor.
>
> If it's not for you, say so and I'll leave it — no hard feelings.

---

## F. Final follow-up

> **Subject: Closing the loop**
>
> Hi [NAME] — last note from me on this. I'm going to offer the [I-XX] slot
> elsewhere at the end of the week.
>
> Your listing stays exactly as it is either way: free, accurate, and corrected
> whenever you tell me something's changed. That part was never conditional.
>
> If you want it, reply and I'll send the details. Otherwise I'll get out of your
> inbox.

---

## G. Qualification-call checklist

Work down this list on the call, then record the outcome on
`/admin/directory/revenue` → **2 · Qualification**.

- [ ] Am I talking to someone who can actually say yes? (owner, GM, marketing)
- [ ] Is this the business on the listing, or a different location of it?
- [ ] Which corridor and category page do they actually appear on?
- [ ] Do they understand the listing is free and stays free?
- [ ] Have I said out loud that I do not guarantee traffic, leads or ranking?
- [ ] Have I said the placement is labelled Sponsored?
- [ ] Featured listing or corridor sponsor — which page do they want to be on?
- [ ] Monthly or annual?
- [ ] Is the corridor slot / category capacity actually free right now?
- [ ] How do they want to pay, given we take no cards on the site?
- [ ] What's the next action and the date?

---

## H. Proposal email

> **Subject: [BUSINESS] — [I-XX] corridor sponsorship**
>
> Hi [NAME], as discussed.
>
> **What it is:** the primary sponsor block on the [I-XX] corridor page —
> [LINK]. One per corridor. Your name, one line, and a link to your site.
>
> **What it costs:** $299 a month, or $2,999 a year (the year works out $589
> less than twelve months).
>
> **Term:** [START] to [END]. The block appears on [START] and stops on its own
> on [END] — there's nothing to cancel.
>
> **What it is labelled:** Sponsored. It sits apart from the listings and is
> never mixed in with them.
>
> **What it does not do:** it doesn't guarantee traffic, leads, calls or search
> ranking, and it doesn't change your listing or anyone's reviews. Your listing
> is free and accurate regardless.
>
> **How to pay:** [METHOD AGREED ON THE CALL]. We don't take card details on the
> site and never will.
>
> Say the word and I'll get it scheduled.

---

## I. Payment-confirmation message

> Hi [NAME] — got it, thank you. [AMOUNT] received [DATE], recorded against
> [I-XX], [MONTHLY/ANNUAL].
>
> I'll set it live on [START] and it runs to [END]. I'll send you the link the
> moment it's up so you can see exactly what a driver sees.

Then on `/admin/directory/revenue` → **5 · Record payment**: amount, date,
reference, and tick the confirmation box. Never type a card number, a bank
account or a password into any field — the form refuses text that looks like one.

---

## J. Placement-live message

> Hi [NAME] — you're live: [LINK].
>
> It's the block at the top marked Sponsored. It runs to [END].
>
> One thing worth repeating: your listing itself hasn't changed. Hours, parking,
> everything a driver reads is the same as it was, and it'll get corrected the
> same way it always would if something's wrong. Just tell me.

---

## K. Renewal reminder (send ~2 weeks out)

> **Subject: [I-XX] sponsorship — [END]**
>
> Hi [NAME] — your sponsorship on [I-XX] runs to [END].
>
> [FOR A CORRIDOR SPONSOR:] It stops on its own that day; there's nothing to
> cancel and nothing continues without you saying so.
>
> [FOR A FEATURED LISTING:] I'll take it down that day unless you tell me
> otherwise.
>
> Another [MONTH/YEAR] is [AMOUNT]. Want to keep it?

---

## L. Expiration / deactivation message

> Hi [NAME] — the [I-XX] sponsorship ended [END], so the block is off the page.
>
> Your listing is still there, still free, still accurate. Nothing about it
> changed when the sponsorship stopped, and nothing about it will.
>
> The slot's open if you want it again — same price, same terms.

---

## M. Objection handling

**"How much traffic do you get?"**

> I'm not going to give you a number I can't back up. The directory's
> measurement is still being set up, and I'd rather show you a real figure in
> three months than a flattering one today. What I can tell you exactly is where
> your name shows, on which page, and for how long. If traffic numbers are what
> the decision hangs on, wait — I'll come back when I have them.

**"Can you guarantee leads?"**

> No. Nobody honestly can, and I won't. What you're buying is a position on a
> page, labelled Sponsored, for a fixed term at a fixed price. That's the whole
> offer.

**"Why should I pay when the listing is free?"**

> You shouldn't, if all you want is to be listed accurately — that's free and
> it's staying free. Paying gets you the sponsored position at the top of the
> page. It doesn't make your listing more accurate, more trusted, or ranked
> higher. Those are different things and I keep them separate on purpose.

**"Can I edit my own listing?"**

> Not directly, no. Everything on the directory is checked by a human before it
> goes up, which is the reason drivers trust it. Tell me what's wrong or what's
> changed and I'll fix it — that's free too, and it's free whether or not you
> ever sponsor anything.

**"Can I be the only sponsor?"**

> On a corridor page, yes — there's one primary sponsor per corridor and that's
> a real limit, not a sales line. On a category page, no: up to three businesses
> can be featured. I'll tell you which one you're buying and I won't call it
> exclusive if it isn't.

**"Can you lower the price?"**

> I can talk about it, but I'll write down what we agreed and why, and the
> published price doesn't move. If annual works better for cash, that's already
> $589 less than paying monthly for a year.

**"Do you take credit cards?"**

> Not today. There's no payment processor on the site and no card details are
> collected anywhere — I'd rather not hold that than hold it badly. It's
> [METHOD] and I record it by hand.

**"Can you keep it live forever?"**

> No, and you wouldn't want that. It runs for the term we agree and then stops.
> For a corridor sponsorship it stops automatically on the end date. If you want
> another term, we do another term deliberately.

---

## The sequence, end to end

Every step maps to a control that exists. Nothing here needs a database edit.

1. **Find someone to call** — `/admin/directory/revenue` → *Who to call first*.
   Public business phone and website only.
2. **Call or email** — templates A–D above. Send them yourself.
3. **They inquire** — they submit `/sponsors`, or you record the conversation
   yourself. Either way a CRM row exists.
4. **Record the contact** — revenue console → *1 · Record a contact*.
5. **Move to Contacted** — → *3 · Move the stage*. One step at a time.
6. **Qualify** — checklist G, then → *2 · Qualification*.
7. **Move to Warm.**
8. **Send the proposal** — template H, with the price from the offer table.
9. **They say yes** — → *3 · Move the stage* → **Committed**.
10. **Record the offer** — → *4 · Record the offer*: offer, term, amount. Blank
    amount means the standard price. A different figure needs a reason.
11. **They pay** — outside the platform, however you agreed.
12. **Record the payment** — → *5 · Record payment*, tick the confirmation box.
    Template I.
13. **Record the term** — → *6 · Record the term*. The end date is derived.
14. **Activate** — `/admin/directory/placements`. Paste the CRM row id, pick the
    exact target, check the preview, type ACTIVATE. It refuses if the deal is
    not committed-or-won with a confirmed payment for the right offer.
15. **Confirm it live** — open the public page yourself and read the word
    Sponsored. Template J.
16. **Watch the renewal queue** — revenue console → *Renewals and expiry*.
17. **Renew or stop** — templates K and L. A corridor sponsor stops itself; a
    featured listing does not and the queue says so in red.

---

## The one limitation to say out loud

A **featured listing** is stored as a bare boolean (`locations.is_featured`)
with no end date. It cannot expire on its own. The term is recorded on the CRM
row and the revenue console raises an overdue warning the day it passes, but the
placement keeps showing until a human stops it.

So for a featured listing, "the term expired" and "the placement is hidden" are
two different events, and only the second one is visible to drivers.

A corridor sponsor has real `starts_at` / `ends_at` columns that are filtered on
every render, so it appears and disappears on its own with no action at all.

**This is why the corridor sponsor is the safer first sale.** It enforces its own
term, it is the higher-value offer, and it cannot be left running by accident.

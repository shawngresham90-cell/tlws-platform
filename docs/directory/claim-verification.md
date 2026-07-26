# Directory listing claim — verification checklist

A claim is **free** and **always reviewed by a person**. Nothing in the platform
approves a claim, transfers a listing, or changes a directory record
automatically, and there is no code path that could: the claim funnel writes one
row into `sponsors` and nothing else. Every change to a listing is still made by
Shawn, by hand, after the checks below.

This document is the procedure. It does not describe a feature.

---

## Where a claim arrives

| Step | Where |
| --- | --- |
| Business clicks **Claim this listing** | `/directory/location/<slug>` |
| Lands on the inquiry form, interest preselected | `/sponsors?interest=listing-claim&listing=…#inquire` |
| Submits | `POST /api/sponsor-inquiry` (Turnstile + rate limited) |
| Lands in the CRM | `sponsors` row, `tier_interest = 'listing-claim'` |
| Reviewer sees it | `/admin/sponsors?view=directory` |

The admin row shows the derived inquiry type, the listing it refers to (with a
link), category / state / corridor, and the billing preference if one was given.
Those are parsed out of the two labelled lines the form appends to the message —
no new column, no migration.

---

## Before approving anything

Work top to bottom. **Any single unresolved item means the claim is not
approved** — reply and ask for what is missing rather than approving partially.

### 1. Business identity

- [ ] The business named in the inquiry is the business in the listing — same
      trading name, same physical address, same phone.
- [ ] The listing is the right *site*. Chains and multi-yard operators have
      several; confirm which one is being claimed by address, not by brand.
- [ ] The business is still trading. A claim on a closed site is a closure
      report, not a claim — handle it as a correction.
- [ ] The listing is not part of a **held brand** (Love's, Pilot/Flying J, Sapp
      Bros, Goasis/Thorntons). Those are excluded from the funnel upstream; if
      one reaches you, do not process it — route it to the brand's own contacts.

### 2. Authority to represent the business

- [ ] The claimant states their role (owner, manager, marketing agency).
- [ ] For an agency or third party, they name the business that authorised them
      and you confirm it with the business directly, not with the agency.
- [ ] The contact reaching you is a person at the business, not an anonymous
      form-filler with a free mailbox and no other match.

### 3. Matching official phone / domain / address

At least **two** of these three must match an official source (the business's
own website, its own social profile, or a call to the number already published
on the listing):

- [ ] **Phone** — the inquiry phone matches the business's published number, or
      a call to the published number confirms the claimant.
- [ ] **Domain** — the inquiry email is at the business's own domain
      (`name@joestire.com`), or the claimant sends from an address the business
      publishes.
- [ ] **Address** — the address in the inquiry matches the listing's address and
      the business's own published address.

A free mailbox (`gmail`, `outlook`, `yahoo`, etc.) is not disqualifying on its
own — many small operators use one — but it counts as **zero** matches for the
domain check, so phone *and* address must both match, and a phone call to the
published number is the cheapest way to close the gap.

### 4. Requested changes

- [ ] Write down exactly what they want changed: hours, amenities, phone,
      website, parking, name, closure.
- [ ] Each requested change is checked against an authoritative source the same
      way any other directory edit is — a claim does not lower the evidence bar.
- [ ] Anything you cannot verify stays unchanged, and you say so in the reply.
- [ ] Truck-parking claims specifically: do not add or change parking status on
      a claimant's word alone. It is the field drivers rely on most.

### 5. Reviewer and approval date

- [ ] Reviewer name recorded.
- [ ] Date the checks were completed recorded.
- [ ] Both written into the CRM row (`notes`, appended below the inquiry) plus
      the evidence used, so a future reader can audit the decision.
- [ ] Any listing edit that follows is made through the normal guarded process
      and is traceable to this claim.

### 6. Fraud warning signs

Treat any of these as a stop, not a hurdle to work around:

- Pressure or urgency ("do it today", "we're launching tomorrow").
- Refusal to take or make a phone call on the published number.
- Free mailbox **and** a phone that does not match **and** no other evidence.
- A competitor's details: the claimant asks to change the phone or website to a
  number/domain belonging to a different business.
- A request to **remove** a rival's listing, or to mark a trading site closed.
- A request to change the address to a different site.
- The claimed business does not exist at that address in any official source.
- Payment offered "to speed up" the claim. Claims are free and are not queued by
  payment. If someone offers, the answer is no, and the claim is reviewed on the
  same schedule as everyone else's.
- Any suggestion that approving the claim is conditional on buying a featured
  listing or a sponsorship. It never is.

---

## Recording the outcome

Use the existing fields. No schema change is needed:

| Field | Use |
| --- | --- |
| `status` | `new` → `contacted` as you work it |
| `stage` | pipeline position |
| `next_action`, `next_action_date` | the follow-up you owe them |
| `notes` | reviewer, date, evidence, and what you changed or declined |
| `sponsor_touches` | one row per call/email, inbound or outbound |

Reply to every claim either way. An approved claim gets a note of what changed;
a declined claim gets a plain reason and what would resolve it. Neither reply
promises traffic, leads, ranking, or sales.

---

## What a claim is **not**

- Not ownership of the listing. The directory entry remains ours to correct.
- Not verification for the public. There is no "verified" badge, and no page
  states a listing is claimed or verified.
- Not a purchase, and not a route to one. Claiming is free and stays free.
- Not automatic. Nothing changes until a human changes it.

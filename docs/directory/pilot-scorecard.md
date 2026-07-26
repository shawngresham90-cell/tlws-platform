# Pilot scorecard — measurement before analytics exists

Plausible is disabled: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset in Netlify, no
authorized account could be proven, and none was created. `trackEvent` no-ops
safely, so all fourteen directory events are wired and firing into nothing.

That is a real constraint, not a temporary inconvenience to work around. This
document does two things: it maps every event to the funnel stage it measures so
the day analytics is switched on nothing has to be rebuilt, and it defines a
scorecard that works **today**, from the CRM, with no vendor.

**No historical number is fabricated anywhere in this document.** Every count
below starts at zero on the day the pilot starts, because that is when
measurement starts.

---

## Event → funnel map

| Funnel stage | Event | Fires when | Recorded today? |
| --- | --- | --- | --- |
| Reach the directory | `directory_view` | the hub renders | ❌ analytics only |
| Browse a category | `directory_category_view` | a category page renders | ❌ analytics only |
| **Listing view** | `directory_listing_view` | a detail page mounts, once | ❌ analytics only |
| Search | `directory_search` | a settled query, 700ms debounce; **length and result count only, never the text** | ❌ analytics only |
| Filter | `directory_filter` | state / city / sort / clear | ❌ analytics only |
| Map use | `directory_map_interact` | map interaction | ❌ analytics only |
| Intent to visit | `directory_directions_click` | directions link | ❌ analytics only |
| Intent to contact | `directory_phone_click`, `directory_website_click` | the listing's own phone / site | ❌ analytics only |
| **Claim interest** | `directory_claim_interest` | "Claim this listing" clicked | ⚠️ partly — see below |
| **Featured interest** | `directory_featured_interest` | "Ask about featured placement" clicked | ⚠️ partly |
| Inquiry start | `directory_inquiry_start` | first real interaction with the form | ❌ analytics only |
| **Inquiry submit** | `directory_inquiry_submit` | the API accepted it | ✅ **a `sponsors` row exists** |
| Inquiry fail | `directory_inquiry_fail` | rejected or network error | ❌ analytics only |
| Sponsor activation | *(no event)* | — | ✅ CRM note + `sponsor_touches` |
| Renewal / deactivation | *(no event)* | — | ✅ CRM note + `sponsor_touches` |

Two things worth being precise about:

- **Activation and renewal have no analytics event, and should not.** They are
  business facts, not browser behaviour. The CRM is the correct record and it is
  already the one being written.
- **Claim and featured interest are "partly" recorded** because a click fires an
  event that goes nowhere — but if the person then submits, the `sponsors` row
  exists and its Source column tells you which surface or campaign they came
  through. You lose the clicks that did not convert. That is the single biggest
  blind spot in the pilot: **you cannot compute a conversion rate**, only a
  count of conversions.

## What the pilot can actually measure, from day one

Everything here is a `SELECT` against `sponsors` and `sponsor_touches`. No
vendor, no script, no cookie.

| Metric | Source | Why it is trustworthy |
| --- | --- | --- |
| Outreach attempted | `sponsor_touches` where `direction='outbound'` | you wrote it |
| Replies | `sponsor_touches` where `direction='inbound'` | you logged it |
| Reply rate | replies ÷ attempts | both sides are yours |
| Inquiries received | `sponsors` rows with a directory `tier_interest` | the row exists or it does not |
| By offer | grouped by `tier_interest` | |
| By source / campaign | the `Came from:` line → Source column | **this is the campaign measurement** |
| Claims requested | `tier_interest='listing-claim'` | |
| Claims verified | those at `stage='closed_won'` | |
| Quotes out | `stage='warm'` with `pledged_cents` | |
| Payments confirmed | `status='paid'`, sum of `paid_cents` | money actually received |
| Placements live | `status='active'` | |
| MRR | sum of `paid_cents` for active monthly placements | received, not agreed |
| Annual cash | sum of `paid_cents` for active annual placements, in the month received | |
| Cancellations | was `active`, no longer, with a note | |
| Listings corrected | count of claim reviews with changes made | the product improving |

## The weekly scorecard

Fifteen minutes, once a week. Fill it in by hand from the admin inbox.

```
Week ending: ____________

OUTREACH
  Emails sent .............. ___    Calls made ............... ___
  Voicemails ............... ___    DMs sent ................. ___
  Replies .................. ___    Reply rate ............... ___%
  Asked not to be contacted  ___    (removed from the list: yes / no)

INBOUND
  Inquiries ................ ___    of which claims .......... ___
  Featured interest ........ ___    Corridor interest ........ ___
  Top source token ......... ____________________

PIPELINE
  Claims verified .......... ___    Listings corrected ....... ___
  Quotes sent .............. ___    Verbal yes ............... ___
  Payments confirmed ....... ___    Placements activated ..... ___

MONEY (received, not agreed)
  New monthly .............. $___   New annual ............... $___
  Active monthly total ..... $___   Cancellations ............ ___

HEALTH
  Featured listings past their end date ......... ___   (must be 0)
  Pages over capacity ........................... ___   (must be 0)
  Claims waiting more than 3 days ............... ___
  Analytics enabled yet? ........................ yes / no
```

The two "must be 0" lines are the ones that matter. A featured listing running
past its term means a customer is getting free inventory and the next buyer
cannot have the slot. Check them every week without exception.

## What cannot be measured, stated plainly

Do not report these, estimate these, or imply these in a sales conversation:

- How many people saw a listing.
- How many people clicked a sponsored placement.
- Whether a sponsored placement outperformed a standard one.
- Click-through or conversion rate of anything.
- Whether a social post drove traffic — only whether it drove an *inquiry*,
  via its source token.
- Cost per acquisition. There is no spend.

If a prospect asks for any of these, the honest answer is in the objection
script: *"I don't have a number I'd stand behind yet, and I'd rather say that
than make one up."*

## The single step that changes this

Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` in Netlify (Builds scope, correct deploy
context) and redeploy. The fourteen events start recording immediately; nothing
in the code changes. It costs nothing to decide and it cannot be back-filled —
every day it stays off is a day of baseline that does not exist.

Until then this scorecard is not a stopgap, it is the measurement. It is also
the more honest half: it counts money and conversations, which is what a pilot
actually turns on.

# Top 25 prospects — ranked, with a recommended offer

Companion to `TOP-25-PROSPECTS.csv`. Prices here are the approved ones:
claim **free**, featured listing **$99/month or $999/year**, corridor sponsor
**$299/month or $2,999/year**.

**Nothing has been sent.** No email, no call, no DM, no form submission. This is
a list and a recommendation; contacting anyone needs separate approval.

## What is in the CSV and what deliberately is not

| Field | Value |
| --- | --- |
| `official_website`, `public_phone` | `on listing` or `to source` — **never the value itself** |
| `public_email` | `to source (we hold none)` for every row |
| `evidence_source` | the in-repo directory record + the live listing page |
| everything else | derived from data already in the repo or the directory |

This repository is **public**. A business's phone number and website are on its
own listing page already; copying them into a public git history adds nothing
and is exactly what the milestone forbids. So the CSV records *whether* we hold
each one and where to find it. Open the `directory_url` and the phone and site
are right there.

No contact detail was researched, guessed, or inferred. Nothing was taken from a
search-result snippet, and no blocked site was fetched.

## How the ranking was computed

Deterministic, reproducible: `python3 data/revenue-readiness/build-top-25.py`.

Score = category intent + corridor + exit + reachability + evidence:

| Term | Points | Why |
| --- | --: | --- |
| tire-repair, roadside-service | 5 | bought at the moment of a breakdown |
| truck-washes, truck-stops | 3 | planned or destination spend |
| cdl-schools, parking | 2 | real budget, slower or absentee buyer |
| cat-scales | 1 | colocated at a host site; the host is the advertiser |
| on an interstate corridor | +2 | there is a corridor page to sponsor |
| exit number known | +1 | exit-level pages are the sharpest hook |
| we hold a phone or a website | +2 | outreach can start today |
| we hold a phone | +1 | the phone script is the best channel for small operators |
| ≥ 1 amenity on the listing | +1 | the page already looks like a real listing |
| more than one site in our data | +1 | one conversation, several listings |

Ties break by category, then state, then name. The top 25 span scores 10–13.

Nothing in the score is a guess about the business — every term is a fact we
already hold about our own record of it.

## Excluded, not discarded

14 of the 75 candidates are corporate travel-center brands (TA, TA Express,
Petro, TravelCenters of America) and the CAT scales colocated at them. They are
correctly published listings; they are not prospects, because nobody at the site
can buy a $99 placement. They are listed in `EXCLUDED-FROM-OUTREACH.csv` with the
reason, not silently dropped.

12 more have neither a phone nor a website in our data. They are in
`SOURCING-QUEUE.csv` — a human sourcing task, not something to generate. None of
them reaches the top 25 on score anyway.

## The list

| # | Business | Category | City, ST | Corridor | Paid offer | Billing | Contact |
|--:|---|---|---|---|---|---|---|
| 1 | Snider Fleet Solutions - Florence | tire-repair | Florence, SC | I-95 | corridor sponsor | annual | phone |
| 2 | Diesel Truck Repairs | roadside-service | Brinkley, AR | I-40 | featured | monthly | phone |
| 3 | All Hooked Up Towing & Recovery | roadside-service | Jupiter, FL | I-95 | featured | monthly | phone |
| 4 | Snider Fleet Solutions - Savannah | tire-repair | Savannah, GA | I-95 | corridor sponsor | annual | phone |
| 5 | Colony Tire Corporation - Rocky Mount | tire-repair | Rocky Mount, NC | I-95 | featured | monthly | phone |
| 6 | Colony Tire & Service | tire-repair | Emporia, VA | I-95 | featured | monthly | phone |
| 7 | Gary Mobile On-Site Truck & Trailer Repair | roadside-service | Gary, IN | I-65 | featured | monthly | phone |
| 8 | Impact Truck and Trailer | roadside-service | Cookeville, TN | I-40 | featured | monthly | website |
| 9 | Thompson Truck Group - Cookeville | roadside-service | Cookeville, TN | I-40 | featured | monthly | website |
| 10 | Martino Commercial Tire | tire-repair | West Palm Beach, FL | I-95 | featured | monthly | phone |
| 11 | Pat's Tire | tire-repair | West Palm Beach, FL | I-95 | featured | monthly | phone |
| 12 | Southern Tire & Fleet Service | tire-repair | Jacksonville, FL | I-95 | featured | monthly | phone |
| 13 | Kenly 95 Truck Service Center | tire-repair | Kenly, NC | I-95 | featured | monthly | website |
| 14 | Walker Tire (Bill Walker Tire Centers) | tire-repair | Asheville, NC | I-40 | featured | monthly | website |
| 15 | Hamilton Truck and Tire Service | tire-repair | Cincinnati, OH | I-75 | featured | monthly | phone |
| 16 | Ziegler Tire | tire-repair | Walbridge, OH | I-75 | featured | monthly | phone |
| 17 | Service Tire Truck Center (STTC) Fredericksburg | tire-repair | Fredericksburg, VA | I-95 | featured | monthly | website |
| 18 | Southern Tire Mart #165 | tire-repair | Atlanta, GA | — | featured | annual | phone |
| 19 | McGee Commercial Tire & Service - Hickory | tire-repair | Hickory, NC | I-40 | featured | monthly | website |
| 20 | Southern Tire Mart #230 - Knoxville | tire-repair | Knoxville, TN | — | featured | annual | phone |
| 21 | Jack's Truck Stop | truck-stops | Cullman, AL | I-65 | featured | monthly | phone |
| 22 | A-1 Truck Stop | truck-stops | Ashburn, GA | I-75 | featured | monthly | phone |
| 23 | El Cheapo #50 | truck-stops | Midway, GA | I-95 | featured | monthly | phone |
| 24 | Oasis Travel Center (Lakewood Landing) | truck-stops | Halifax, NC | I-95 | featured | monthly | phone |
| 25 | Barney's Convenience Mart | truck-stops | Rossford, OH | I-75 | featured | monthly | phone |

**Coverage:** tire-repair 15 · roadside-service 5 · truck-stops 5 ·
I-95 12, I-40 5, I-75 4, I-65 2, none 2 ·
NC 5, FL 4, GA 4, OH 3, TN 3, VA 2, AL 1, AR 1, IN 1, SC 1.

**Reachability:** 13 high confidence (we hold both a phone and a website),
12 medium (one of the two), 0 needing sourcing.

**Every one of the 25 listing pages passes the indexability gate** — street
address plus at least two substance signals, 3–5 signals each. (`is_indexable`
on the row is `false` for all 75, but that column is an unused manual override;
`isDetailIndexable` is what actually decides, and all 75 pass it.)

## Why these offers

**Claim first, always.** Free, costs them nothing, and gives Shawn a real
relationship and a corrected listing whether or not they ever buy. Placement is
the second conversation.

**Featured listing ($99/mo or $999/yr)** for 23 of the 25 — a business that wants
to be picked from *its own category or corridor page*. Up to three per page, so
there is genuine room without inventing scarcity.

**Corridor sponsor ($299/mo or $2,999/yr)** for 2 — both Snider Fleet Solutions
sites, on I-95. One primary sponsor per corridor page means these two are one
sale, not two: a single I-95 sponsorship covering both branches. That is worth
saying out loud on the call rather than pitching the same page twice.

**Monthly vs annual.** Annual is recommended for the 4 multi-site operators —
they have a planning budget and annual is genuinely cheaper ($189/yr less on
featured, $589/yr less on corridor). Monthly is recommended for the other 21:
this directory has no track record yet, and a month-to-month offer they can stop
is the honest one. Do not push annual on a single-site operator.

## Rules that apply to all 25

- Nothing may be sent without separate approval.
- Never quote a traffic, lead, ranking, or revenue figure. There is none yet.
- Never say a listing is verified, claimed, or featured when it is not.
- Never source a contact detail from a scraped aggregator — the business's own
  site or its own verified profile only.
- If a business asks to be removed, remove the listing and stop. That outranks
  every sale on this page.

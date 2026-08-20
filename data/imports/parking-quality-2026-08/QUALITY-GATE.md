# Parking publication gate — what a row must prove

Rule version 1 · classifier `src/lib/directory/parking-quality.ts` ·
tests `scripts/test-parking-quality.ts`

A row reaches `ready-for-owner-review` only when **every** mandatory gate
below passes. That verdict is a queue position, not a decision: publication
is executed by the owner from a reviewed package, never by this system.

## The five axes

The result is deliberately not a score. A single number cannot distinguish a
verified truck stop whose overnight policy is unsourced from a rest area that
nobody has checked at all, and those two rows need opposite work.

| Axis | Question | States |
|---|---|---|
| Publication | May this be queued for owner review? | 11 verdicts |
| Overnight | What can honestly be said about overnight use? | confirmed / prohibited / unknown |
| Coordinate | Can a driver be routed here? | 8 verdicts |
| Facility | What kind of place is this? | 8 verdicts |
| Provenance | Where did the row come from? | 8 classes |

## Mandatory gates

**Identity.** Non-empty name; a valid two-letter state; and a locating
identity (address, city, or corridor). Category must be `parking`.

**Truck-parking evidence.** An evidence record from an authoritative agency
or operator must state that trucks may park here. Explicitly insufficient,
per the repository's standing rules:

- the words "rest area", "welcome center", "service plaza" or "weigh station"
- a business name containing "truck"
- a third-party directory listing or a search snippet
- car parking
- a populated row, a high completeness score, or a space count
- any number of driver reports

**Coordinate.** Finite, in range, not `0,0`, inside the row's own state
bounds and corridor — *and* carrying recorded provenance (`geocode_source`,
`coord_verification_status = verified`, or `manually_verified_at`). A
coordinate with no provenance is `unverifiable`, because a rooftop fix and a
city-centre guess are indistinguishable once the origin is lost.

**Duplicate / identity collision.** Detail slug, normalised name + state, and
150 m proximity against every published row. A hit is a review, not a merge.

**Direction.** Opposite carriageways are separate legitimate facilities. They
are never merged, and never share one coordinate.

**Claims.** A stored space count, amenity list, hours value, free/paid flag or
reservation link that no source states is reported (`*_UNSOURCED`). Unknown is
an acceptable published state; invented certainty is not.

## What the completeness score is for

`scoreCompleteness` measures **field presence**, not evidence. Every one of its
18 parts asks "is this populated?" — a third-party CSV row with an address, a
phone, a description and two amenities scores *Excellent* while nothing on
record says a truck may park there. Two of its parts are structurally
unearnable as evidence: `spaces` scores an unsourced import value identically
to an operator-published count, and `amenities` counts the overnight chip that
`toEntry` appends to every row automatically.

It is therefore carried through this system as a **secondary worklist signal**
— useful for ordering "cheapest to finish" — and is never an input to the
publication verdict. Two tests pin this: a high-completeness row with no
evidence stays blocked, and a sparse row with evidence stays eligible.

## What driver reports are for

Report volume is an **attention signal**. It orders triage and nothing else.
Ten identical reports with no official source produce no confirmation, no
coordinate confidence and no publication verdict — asserted directly by
`PQ62`.

## Sources

Authoritative: state DOT, toll/turnpike authority, federal (USDOT/BTS/FHWA),
the facility operator, or an owner-reviewed dataset.

Not authoritative on their own: state tourism boards (`visit*`, `explore*`),
general map services, crowdsourced pins, review sites, generic truck-stop
directories, SEO pages, AI summaries, search snippets, or an unsourced CSV
value.

Additionally recorded against any supplied source: non-HTTPS
(`SOURCE_NOT_HTTPS`), an agency index or search page rather than a page about
this facility (`SOURCE_IS_INDEX_PAGE`), a missing retrieval date
(`SOURCE_RETRIEVAL_DATE_MISSING`), and a carriageway that does not match the
row (`SOURCE_DIRECTION_MISMATCH`).

## Why there is no CANDIDATE-PUBLISH.sql in this package

Zero of the 96 rows reach a publishable stage, so no publication SQL is
generated. Writing one anyway would mean either weakening a gate or
hand-picking rows the gate rejected — both are the failure this milestone
exists to prevent. The package ships the audit and the fingerprint; the SQL
follows the evidence, not the other way round.

## Public confidence label — decision: NO

Audited, and declined. The milestone's name contains "confidence", which is
not a reason to ship one.

**What a public label would add today: nothing true.** All 96 unpublished rows
and all 76 published parking rows carry `overnight_status` unknown with no
source, and none of the unpublished rows is publishable. A confidence label
would therefore say "unknown" on every single parking listing a driver can
currently see — a second chip repeating what "Overnight unknown" already says,
in a vocabulary nobody has been taught.

**What it would risk.** A per-listing confidence indicator on a parking card is
read at 2 a.m. by someone deciding whether to commit to an exit. Three failure
modes, none hypothetical:

- it reads as *availability* ("high confidence" → "there will be a space"),
  which is the one thing this system must never imply and explicitly does not
  model;
- it reads as a *guarantee*, which a directory entry cannot be;
- it competes with `overnight_status`, giving two answers to one question and
  creating a second public authority — the exact defect M3 closed.

**The condition for revisiting.** A public label becomes worth its risk when
parking rows carry *differentiated* evidence — i.e. when a meaningful number of
published parking listings have a recorded source and the label would separate
them from those that do not. That is not a matter of design taste; it is
`count(*) filter (where overnight_status_source is not null) > 0`, currently
zero.

Until then the confidence system stays admin-only, and the public honesty
signal remains the three-way overnight status that already ships on every
card, detail page and map result.

# Pilot / Flying J / ONE9 export — findings

Source: `all_locations.csv`, sha256
`d39ab57d51999f2468ff2f32790f8ab43a20b859559b0052e353272c9d1e330a`.
Read-only reconciliation, 2026-07-27. No production write was performed.

---

## 1. Every reported figure reproduces exactly

| Claim | Reproduced |
|---|---|
| 875 total official-network locations | ✅ |
| 820 U.S. | ✅ |
| 55 Canadian | ✅ (AB 17, ON 16, BC 11, SK 6, MB 5) |
| 43 U.S. states | ✅ |
| 803 U.S. with `Parking Spaces Count > 0` | ✅ |
| 17 U.S. with zero parking spaces | ✅ |
| 72,189 stated U.S. parking spaces | ✅ |
| Zero duplicate store numbers | ✅ |
| Zero duplicate coordinates | ✅ |
| Zero duplicate name/address/state | ✅ |
| SHA-256 | ✅ exact match |

All 820 U.S. rows carry a usable coordinate inside the continental envelope.
Seven rows have no `Interstate` value and 108 more give a non-Interstate route,
so 115 of the 803 parking locations do not land on a corridor page.

## 2. What the export does not contain

- **No status column.** Closure is detectable only as absence from a later full
  export, so every dated export must be retained.
- **No overnight-permission field.** See §3.
- **No parking-duration or restriction field.**
- **No name column separate from brand** — `Name` *is* the brand string, and the
  display name is derived as `Name #StoreNumber`.

## 3. The overnight problem, and why nothing was invented

A positive `Parking Spaces Count` confirms truck parking for directory and map
purposes. It says nothing about whether a driver may sleep there.

`locations.overnight_parking` is `boolean NOT NULL DEFAULT false`. It cannot
represent "unknown". Every row this import touches therefore lands at `false`,
which here means **not confirmed** — not "prohibited".

That is the safe direction: the directory under-claims rather than promising
rest that may not be permitted. No statement in the package writes that column,
and `VERIFY.sql` §4 fails if any imported row ever claims overnight parking.

**Recommended later, not built here:** a three-valued `overnight_status`
(`confirmed` / `prohibited` / `unknown`) so the directory can say "we don't
know" instead of implying "no". Love's states overnight explicitly and would
map to `confirmed`/`prohibited`; Pilot would map to `unknown` until a second
source arrives.

## 4. Brand identity is preserved, including two ONE9 casings

Twenty-one distinct official `Name` values across the 875 rows, all stored
verbatim. Nothing is flattened to "Pilot".

The export contains **both** `ONE9 Travel Center` (38) and `One9 Travel Center`
(2). Both are preserved as published rather than normalised, because the brief
is to retain the official value. `VERIFY.sql` §5 lists them separately, so the
variance stays visible instead of being silently merged.

Dealer, licensed and cardlock formats are distinct products and are kept
distinct: ONE9 Dealer (66), Pilot Dealer (65), Pilot Licensed Location (17),
Flying J Dealer (17), Flying J Cardlock (10), Flying J Licensed Location (6),
Shell Cardlock (5), Shell Flying J Dealer (3), Pilot Express (3), Pilot Licensee
(1), plus independents in the network: Mr. Fuel (17), EZ Trip (5+1),
Xpress Fuel (4), Pride (2), Stamart (1), Arco (1).

## 5. Five conflicting records — held, not changed

| # | Directory row | Directory says | Export says |
|---|---|---|---|
| 231 | `88da4d5c` CAT Scale #231, Monroe | **OH** | Corbin, **KY** |
| 284 | `c318488f` CAT Scale #284, West Chester | **OH** | Monroe, **MI** |
| 24 | `4b60c1b7` CAT Scale #24, Sharonville | **OH** | Monroe, **MI** |
| 24 | `a458560a` Pilot Travel Center #24 | **OH**, city "(I-75 Exit 15 area)" | Monroe, **MI** |
| 749 | `9b0bb934` Flying J #749 (Carmel Church) | 23866 Rogers Clark Blvd, VA | #749 is **24279** Rogers Clark Blvd |

The first four are Ohio rows carrying Michigan and Kentucky store numbers. All
four are unpublished; the correct MI/KY rows exist separately and are matched
normally.

**The fifth is the sharp one.** The directory row labelled #749 sits at 23866
Rogers Clark Blvd — but the export gives that address to **#876**, and puts #749
at 24279. A store-number match with a contradicting street number would have
written #749's coordinate onto a row describing #876's site, ~850 m away. The
reconciler now treats a positive street-number disagreement as a **conflict**
and refuses the enrichment. #876 is imported as net-new on its own coordinate;
`9b0bb934` is untouched and flagged.

Nothing here is deleted, unpublished or renamed. All five need exact-ID
verification.

## 6. Twelve probable-closure candidates — review only

Store numbers present in the directory and **absent from this export**:

| # | Row | State | Published |
|---|---|---|:--:|
| 149 | Pilot Travel Center #149 (Flagship) | TN Stanton | **yes** |
| 15 | Pilot Travel Center #15 | OH Toledo | **yes** |
| 15 | CAT Scale — Pilot #15, Toledo | OH Toledo | **yes** |
| 352 | Pilot Travel Center #352 | FL Fort Myers | **yes** |
| 352 | CAT Scale - Pilot #352, Fort Myers | FL Fort Myers | **yes** |
| 962 | Pro Stop (Pilot Flying J Dealer #962) | IN Sellersburg | **yes** |
| 187 | Pilot Travel Center #187 | TN Knoxville | no |
| 290 | Pilot Travel Center #290 | MD Perryville | no |
| 24 | Pilot Travel Center #24 | OH | no |
| 231 | CAT Scale #231, Monroe | OH | no |
| 284 | CAT Scale #284, West Chester | OH | no |
| 24 | CAT Scale #24, Sharonville | OH | no |

Six are **published today**. That is worth knowing, and it is still not grounds
for action: **absence from a single export is not proof of closure.** No row is
deleted or unpublished by this package. Closure review is a separate exercise
needing its own authorization and, ideally, a second dated export to compare
against.

## 7. Three rows cannot be resolved at all

- `c05b09af` CAT Scale - Flying J, Miami — no address, no store number
- `a2881397` CAT Scale at Pilot Perryville — companion to #290, itself a closure
  candidate
- `ad3e43c4` Pilot Flying J Truck Care Service Center, Waynesville NC — no
  address

They stay in the directory, unchanged, recorded in `CLOSURE-REVIEW.csv`.

## 8. Fourteen third-party rows are not Pilot-network locations

Southern Tire Mart (12), Speedway (1) and Blue Beacon (1) sit at network sites
but are separate businesses with their own numbering — "Southern Tire Mart at
Pilot #297" is STM's shop number, not a Pilot store number. Joining on it would
have produced phantom matches. They are excluded from the store-number join and
from the brand-compatibility pass, and `FINGERPRINT.sql` §D asserts their rows
do not change.

One name carries a CAT Scale number rather than a store number — "CAT Scale at
ONE9 Travel Center (CAT #876)". It is excluded by the same rule, which matters
because **#876 is also a real Pilot store number** (Ruther Glen VA). Without the
exclusion the two would have collided.

## 9. Two matcher bugs found and fixed during this run

**Brand-regex ordering.** "Mr. Fuel Travel Center (One9 Fuel Network)" was
tested against the ONE9 pattern before the Mr. Fuel pattern, so it was branded
ONE9, failed brand compatibility, and was written off as unresolvable. It is
Mr. Fuel **#278**, Walton KY, and the export lists it. Network membership is not
the brand; Mr. Fuel is now tested first. Its colocated CAT scale had matched
correctly all along, which is what exposed the inconsistency.

**Store-number match with contradicted address.** See §5. Previously classified
as a benign blank-only enrichment; now a conflict with enrichment refused.

## 10. Reconciliation totals

Both directions are fully classified — nothing is discarded.

**820 official U.S. rows:** 705 net-new with parking · 87 exact authoritative
match · 14 net-new zero-space · 8 blank-only enrichment · 5 matched by
address+brand+state · 1 conflicting record.

**222 directory rows:** 193 matched · 29 in closure review (14 third-party, 12
probable closure, 3 unresolvable).

The 193 matched are **101 map-pin rows + 92 colocated service rows**. Of the 101
pins, 84 have at least one blank worth filling and form the enrichment plan; the
other 17 already hold everything the export could give them, including the one
conflicting record whose enrichment is deliberately refused.

**55 Canadian rows:** preserved in `CANADA-55.csv`, excluded from every U.S.
denominator, never imported.

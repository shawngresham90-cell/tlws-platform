# Founder Wall import — review checklist

Compare every row below against the owner-supplied roster. Names are imported
**verbatim** (no shortening, correcting, combining, or inventing). Source of
truth: `src/lib/road-ahead/founders-data.ts` (`FOUNDER_RECORDS`). The unit test
`scripts/test-road-ahead.ts` fails the build if the totals drift.

## Totals reconciliation

| Tier | Records | Each | Subtotal |
| --- | ---: | ---: | ---: |
| Iron | 3 | $1,000 | $3,000 |
| Steel | 8 | $500 | $4,000 |
| Brick | 16 | $100 | $1,600 |
| Final Founder | 13 | $35 | $455 |
| **Total raised** | **40** | | **$9,055** |
| Goal | | | $11,550 |
| To go | | | $2,495 |
| Funded | | | **78.4%** |

- **40** contribution records imported · **39** wall placements · **38** distinct
  name strings.
- Duplicate handling:
  - **Barry Van Hammee Jr** — two records, **same tier** (Final Founder) → **one
    plaque, "2 CONTRIBUTIONS"** (wall No. 38). Both $35 still summed.
  - **Jose Cotto** — two records, **different tiers** (Steel + Brick) → **two
    separate placements** (wall No. 05 and No. 19), as two distinct wall spots.

## Every placement (compare to your file)

### Iron Founders — forged-iron plates
| No. | Name | Amount |
| ---: | --- | ---: |
| 01 | David Gresham | $1,000 |
| 02 | Thomas Fields | $1,000 |
| 03 | Rosedale Transport | $1,000 |

### Steel Founders — brushed-steel plates
| No. | Name | Amount |
| ---: | --- | ---: |
| 04 | Gary Ford | $500 |
| 05 | Jose Cotto | $500 |
| 06 | Greg Walker | $500 |
| 07 | Mario Capston | $500 |
| 08 | Jon Blankenship | $500 |
| 09 | Rush Enterprises | $500 |
| 10 | Idle Demon Inc | $500 |
| 11 | Ricky M. Rosenbalm | $500 |

### Brick Founders — carved red clay
| No. | Name | Amount |
| ---: | --- | ---: |
| 12 | Sam Tusk | $100 |
| 13 | Chris Nalley | $100 |
| 14 | Terry Hostetler | $100 |
| 15 | Billy Joe Poole | $100 |
| 16 | J.A. Gresham | $100 |
| 17 | R.A. Harper | $100 |
| 18 | Steve Snyder | $100 |
| 19 | Jose Cotto | $100 |
| 20 | Sean Conway | $100 |
| 21 | David Chasteen | $100 |
| 22 | Clint E. Ingram | $100 |
| 23 | Bryce Jennex | $100 |
| 24 | Will Bethstern | $100 |
| 25 | Shell Fardods | $100 |
| 26 | Phil Tuts | $100 |
| 27 | Joe Wise | $100 |

### Final Founders — engraved concrete/granite pavers
| No. | Name | Amount |
| ---: | --- | ---: |
| 28 | James R. Shaw | $35 |
| 29 | Ernest Murry | $35 |
| 30 | Stacey Beavers | $35 |
| 31 | Chad Huckelby | $35 |
| 32 | Bear & Bug Logistics | $35 |
| 33 | Kyle Koerner | $35 |
| 34 | Deirdre Monice Sanders | $35 |
| 35 | Edward Colon | $35 |
| 36 | Zac Elrod | $35 |
| 37 | Matt Allgood | $35 |
| 38 | Barry Van Hammee Jr **(2 contributions)** | $35 × 2 = $70 |
| 39 | Jesus Chapa | $35 |

## Privacy note

Per-founder amounts live only in `founders-data.ts` and are used **only** to sum
the aggregate total. They are **never rendered per founder** — the wall shows a
name, founder number, tier, and (for a same-tier repeat) a contribution count.

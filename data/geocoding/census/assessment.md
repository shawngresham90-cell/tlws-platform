# Directory completion assessment — after Census processing

Snapshot 2026-07-21 · 1252 rows · checkpoint 965 results. All figures assume every valid Census match is APPROVED in the admin console (each row remains manual-review until then).

## Headline

| metric | value |
| --- | --- |
| Coverage now | 85 / 1252 (6.8%) |
| Census matches | 745 (high 0 · medium 745) |
| Census rejected | 220 |
| Not fetched (pending) | 2 |
| **Projected coverage after approvals** | **830 / 1252 (66.3%)** |

## State-by-state projected coverage

| state | rows | coords now | after Census | projected % |
| --- | --- | --- | --- | --- |
| AL | 64 | 0 | 32 | 50% |
| AR | 127 | 0 | 65 | 51.2% |
| DE | 10 | 0 | 9 | 90% |
| FL | 127 | 0 | 79 | 62.2% |
| GA | 123 | 55 | 96 | 78% |
| IL | 12 | 0 | 2 | 16.7% |
| IN | 99 | 0 | 72 | 72.7% |
| KY | 99 | 0 | 71 | 71.7% |
| MD | 38 | 0 | 24 | 63.2% |
| MI | 73 | 0 | 44 | 60.3% |
| NC | 89 | 0 | 57 | 64% |
| OH | 95 | 0 | 70 | 73.7% |
| SC | 47 | 0 | 22 | 46.8% |
| TN | 202 | 30 | 169 | 83.7% |
| VA | 47 | 0 | 18 | 38.3% |

## Unmatched after Census (still missing coordinates)

Total unmatched: **422** — of which **219 interpolation-eligible** (corridor + exit; coverable by corridor calibration) and **203 manual-investigation** (no exit path).

### By state

- AR: 62
- FL: 48
- TN: 33
- NC: 32
- AL: 32
- VA: 29
- MI: 29
- KY: 28
- GA: 27
- IN: 27
- OH: 25
- SC: 25
- MD: 14
- IL: 10
- DE: 1

### By corridor

- I-95: 132
- I-75: 115
- I-40: 95
- I-65: 66
- I-24: 14

### Interpolation-eligible remainder by corridor

- I-95: 62
- I-75: 59
- I-40: 53
- I-65: 41
- I-24: 4

## Minimum work to reach coverage thresholds

| target | rows needed | gap after Census | coverable by interpolation | manual research |
| --- | --- | --- | --- | --- |
| 75% | 939 | 109 | 109 | 0 |
| 85% | 1065 | 235 | 219 | 16 |
| 90% | 1127 | 297 | 219 | 78 |
| 95% | 1190 | 360 | 219 | 141 |

_Order of operations: approve Census matches (free, done) → corridor interpolation (engineering, needs calibration anchors) → manual research (human time)._

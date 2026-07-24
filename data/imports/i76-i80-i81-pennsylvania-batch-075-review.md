# Batch 75 — I-76/I-80/I-81 Pennsylvania: Review

**Status: SCAFFOLD / PENDING.** No listing rows were produced. This document
records the review posture so a future networked run — or a human reviewer —
can complete the batch without re-deciding the method.

## Decision log

- **Coverage gap confirmed.** Pennsylvania has **0** live listings (read-only,
  2026-07-24). It is the largest single-state gap on the eastern interstate
  spine and the correct M6 target.
- **Verification could not be performed to standard.** Outbound page fetching
  is policy-denied (WebFetch → 403 on operator, directory, and reference hosts
  alike). WebSearch returns only synthesized summaries, which are not an
  acceptable primary source under the batch method.
- **No rows were invented.** Rather than lower the verification bar (which the
  work order forbids), the batch ships as a validated template + method +
  blocker record. The method's "blank when unverifiable" rule is applied at the
  whole-batch level: nothing verifiable, nothing asserted.

## What a reviewer / networked run does next

1. Restore outbound fetch (or run where operator/gov locators are reachable).
2. Work the corridor plan in `…-batch-075-sources.md`, one exit node at a time.
3. For each candidate facility: open the operator/gov **primary** page, confirm
   with **≥2 corroborating** directories, and write only the fields the sources
   state. Stamp the per-row **verified date**. Leave everything else blank.
   **No coordinates** (separate geocoding workflow).
4. Append rows to `…-batch-075.csv` in the canonical 20-column order.
5. Re-run the harness (see `…-batch-075-validation.md` for the exact commands):
   the CSV must be 100% clean through `prepareImport`, in-batch dedup 0, and
   dedup-vs-live-PA 0 (re-checked at fill-in time, not assumed from today).
6. Only then is the batch review-ready for a draft import (unpublished).

## Guardrails carried over (must not be relaxed)

- Official operator/gov primary + ≥2 corroborating sources per listing.
- No invented fields; blank when a source is silent.
- No bulk scraping; no paid APIs; no coordinates.
- Describe the result as **verified major-corridor coverage**, never
  "statewide exhaustive."
- Every added row deduped vs live PA and within-batch before import.

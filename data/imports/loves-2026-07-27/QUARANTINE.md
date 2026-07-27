# Love's — quarantined rows

A quarantined row is one the authoritative export **contradicts**. It is not
deleted and not corrected in place, because we do not know the true fact — only
that the recorded one is wrong. It stays unpublished until an exact-ID
verification against Love's resolves it.

Source of record: `LovesSearchResults.xlsx`, sha256 `ec5146ee…a89ab2`, 731
records, confirmed against Love's own published count.

---

## D. Love's Travel Stop #420 — Florence, SC

| | |
|---|---|
| **id** | `beb05d53-db50-49cb-8790-ec01b45c8187` |
| Name | Love's Travel Stop #420 |
| State / city | SC / Florence |
| Category | `truck-stops` |
| Published | **false** — already, before this run |
| Deleted | no |
| Proposed change | **none** |

**The contradiction.** Store #420 in the authoritative export is **Flowood,
Mississippi**. South Carolina's fourteen Love's locations do not include
Florence.

**Disposition: leave unpublished, leave quarantined.** No SQL is proposed for
this row — it is deliberately absent from the transaction in `CORRECTIONS.sql`,
because the state it needs to be in is the state it is already in. Touching it
would only add risk.

It is also excluded from the import: `scripts/reconcile-loves.mjs` classifies
Love's #420 as `net-new-state-conflict`, so the real Flowood MS #420 is **not**
inserted while a Florence SC row bearing the same store number exists. Resolving
this quarantine is a precondition for importing MS #420.

**To resolve.** Verify store #420 directly with Love's. Then one of:

- the Florence row is a mis-keyed store number → correct the number, keep the
  location, and lift the import conflict;
- the Florence row is a closed or never-existent site → retire it permanently;
- the row is a different brand recorded wrongly → re-brand it.

Each of those asserts a new fact and therefore needs its own evidence. None can
be chosen from the export alone.

**Invariant.** `scripts/test-parking-expansion.ts` asserts this id is never
published and never deleted by any statement in this package.

---

## Rows proposed for unpublishing (not quarantine)

Three further rows contradict the export, but they are **published today**, so
leaving them alone is not neutral — it keeps a wrong claim in front of drivers.
They get a guarded unpublish in `CORRECTIONS.sql` rather than a quarantine
note:

| | id | Row | Contradiction |
|---|---|---|---|
| A | `c32686ff-6cf3-4422-af97-80b823e07eb9` | Love's Travel Stop #618 — Birch Run, MI | #618 is Sadieville, **KY** |
| B | `485085d9-98c6-4e88-9661-862c3bc0c514` | CAT Scale — #618, Birch Run, MI | colocated with A |
| C | `f6404302-7971-4884-8f37-82f098913d65` | Love's Travel Stop #306 — Dandridge, TN | #306 is absent from the export |

They become quarantine records once unpublished. Nothing is deleted.

The correct Kentucky #618 rows (`0c0c4cac`, `b67852b7`, `33c7ebe8`) are valid
and are explicitly guarded out of scope.

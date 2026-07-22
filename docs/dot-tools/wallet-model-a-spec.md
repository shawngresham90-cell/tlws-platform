# Document Wallet — Model A (Device-Local) Privacy & Security Specification

Owner Decision 4: the Document Wallet MVP is device-local only. **No cloud
uploads. No database storage of CDL, medical-card, permit, registration, or
any other document images. No account synchronization.** Models B/C (any
server-side storage) remain forbidden without a separately reviewed security
blueprint.

## 1. What it is

The platform successor to the standalone Vault: photos of driver documents
(CDL, med card, registration, insurance, annual inspection, permits,
IFTA/IRP, receipts, inspection reports) stored in the browser's IndexedDB on
the driver's own device, shown full-screen on demand, with expiration
warnings. Free — the legacy Pro gate does not carry over (Decision 2).

## 2. Storage schema (platform)

- IndexedDB database `tlws_wallet` v1, object store `docs`:
  `{ id (auto), type: string, exp: string|null, img: string (JPEG data-URL),
  added: string (ISO date) }`
- Images client-downscaled before storage (≤1600 px longest edge, JPEG
  q 0.82 — the legacy pipeline's parameters, kept).
- No document image, document metadata, filename, or expiration date ever
  leaves the device: not to Supabase, not to analytics, not to logs, not to
  error reporters. The only analytics allowed are count-free lifecycle
  events per `analytics-spec.md` (`wallet_opened`, `wallet_doc_added` with
  **no** type/date payload).

## 3. Export (required feature, two places)

1. **Platform wallet:** "Export all" produces a single user-controlled file
   (ZIP of JPEGs + a manifest.json of types/dates) via a client-side
   download. No server round-trip.
2. **Legacy app:** the old vault must receive the same export function
   **before any redirect or retirement** (owner-approved old-app change —
   not in this or any platform PR). IndexedDB is origin-bound; export is the
   only bridge. See `migration-and-redirects.md` for the 60-day rule.

Import on the platform wallet accepts that export file (client-side unzip →
re-store). Import is how a driver moves devices, too.

## 4. Threat model & honest disclosures (must render in the UI)

- **Shared/unlocked device risk:** images are not encrypted at rest beyond
  what the browser/OS provides. The UI must say documents are protected by
  the device's own lock, and recommend device passcode + not using shared
  or public computers.
- **Clearing site data deletes documents.** The legacy app discloses this
  plainly; the platform keeps that honesty, plus a nudge to export a backup
  after adding documents.
- **Browser eviction:** the implementation must request
  `navigator.storage.persist()` and surface whether persistence was granted.
- **Digital copies are not always sufficient:** keep the legacy footer's
  caveat that paper originals may still be required for some carry
  requirements (ledger R-CS-02 verifies the details).
- **Deletion:** per-item delete with confirm, plus "Delete everything"
  wiping the object store; both complete locally with no residue (data-URLs
  are not written anywhere else).

## 5. Security review scope (light, pre-implementation)

One reviewer pass over: the export file format (no path traversal on
import), data-URL handling (no injection into `innerHTML` without the
established escaping pattern), the persistence/eviction UX, and the
no-egress guarantee (a grep-able rule: no `fetch`/`XMLHttpRequest` in the
wallet module). Cloud storage is out of scope by decision, which removes
the heavy review burden.

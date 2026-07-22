# Roadside Mode — Sales-Free Policy

Owner Decision 7, binding on the future platform Roadside Mode
(`/dot-tools/roadside`) and any surface reachable from it during a roadside
flow.

## The rule

A driver who has just been pulled over is in a safety-critical, high-stress
moment. During the roadside flow, **no commercial content of any kind may
appear**:

- no product CTA (the legacy page ends with a $27 "Save Your CDL" CTA —
  that is removed, not restyled, not relocated above the footer, removed);
- no pop-up or interstitial;
- no email gate — and per `email-capture-spec.md`, not even *optional*
  email capture appears in Roadside Mode;
- no upsell strip, "Pro" badge, pricing mention, or store link;
- no advertisement or sponsor placement of any kind (this outranks any
  future sponsorship arrangement — Roadside Mode is permanently
  unsponsorable inventory).

## What is allowed

- The safety content itself: stay-calm guidance, documents-ready list, the
  cited-regulation cards, say/don't-say lists (post-attorney review, ledger
  R-RS-04), and links to **free** tools that serve the moment (Document
  Wallet to pull up a med card; the regulation browser to read a cite).
- Standard site navigation (header/footer) may exist, but the roadside page
  body adds no commercial links, and the page must not inject promos into
  shared components.
- "Powered by Trucking Life with Shawn" attribution.

## Design notes for the future build

- Steel & Sodium exception: Sodium Amber is the money/action color
  elsewhere; on Roadside Mode there is no money action, so amber is used
  (if at all) only for warning semantics, never for a purchase affordance.
- The tone of the legacy page (fast, imperative, calm) is right — keep it.
- Content changes on this page trip the same gates as everywhere else:
  regulatory rows (R-RS-01..03) and attorney review (R-RS-04) before launch.

## Enforcement

The implementation PR for Roadside Mode must include a review checklist item
("zero commercial elements, verified against this policy") and the page is
excluded from any future site-wide promo component by construction.

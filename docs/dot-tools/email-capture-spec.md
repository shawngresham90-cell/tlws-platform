# DOT Tools — Optional Email Capture Specification

Owner Decision 5. Email capture survives only as a **post-content
convenience** — the driver already has the content when they see the ask.

## Rules

**Allowed copy:** "Email me a copy and occasional rule updates." (or a
close variant approved by the owner). One email field, one un-checked
checkbox if marketing consent is bundled with the send — see below.

**It may not:**
- block the cheat sheet (or any content) — every tool and the printable
  sheet render fully with the field empty;
- claim an email was sent unless delivery actually succeeded (the send call
  returned success; on failure the UI says so honestly);
- pre-check marketing consent;
- combine SMS consent with email consent — no phone field, no SMS language,
  nothing that could contaminate the 10DLC consent trail established in
  `sms-10dlc-compliance.md`.

The legacy app's "a copy is also headed to your inbox" line is the
anti-pattern: it claimed delivery with no sender behind it. That claim is
banned.

## Consent model

The single sentence "Email me a copy and occasional rule updates" is the
consent, given by typing the address and pressing the button — transactional
copy + a lightweight updates opt-in in one action, disclosed in the button's
own copy. Unsubscribe honored on every send. Privacy Policy link adjacent.
If counsel later prefers separating "send the copy" from "updates", the
field gains one unchecked checkbox for updates; the doc anticipates both.

## Plumbing (documented now, activated later — NOT in PR 1)

- Submission goes to the existing guarded lead pipeline (`/api/lead`,
  Turnstile-protected, `leads` table) with a `source` marking DOT Tools.
  Netlify Forms is not used on the platform.
- Delivery uses the **existing dormant Resend infrastructure**
  (`RESEND_*` config already in the repo). PR 1 activates nothing: no key,
  no template, no send path. A future implementation PR wires the actual
  send + success/failure UI, with the "sent" claim keyed to the API result.
- Analytics: `dot_email_submitted` fires on accepted submission only; the
  address itself never enters analytics (see `analytics-spec.md`).

## Placement

- Cheat sheet page: below the sheet (post-content), mirroring the legacy
  position minus the gate framing.
- Nowhere in Roadside Mode (see `roadside-sales-free-policy.md` — the
  no-email-gate rule there covers even optional capture).
- No other DOT Tool carries email capture at MVP.

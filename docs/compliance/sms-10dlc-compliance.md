# SMS / 10DLC Compliance — Audit & Changes

Compliance groundwork for Text Request 10DLC registration and general web
privacy. Scope was limited to compliance changes only.

## What shipped in this PR

1. **Privacy Policy** — `/privacy` (`src/app/(marketing)/privacy/page.tsx`).
2. **SMS Terms & Conditions** — `/sms-terms`
   (`src/app/(marketing)/sms-terms/page.tsx`): program description, message
   frequency, "message and data rates may apply", STOP to opt out, HELP for
   help, carrier-liability and no-sale-of-numbers statements, Privacy Policy
   link, contact.
3. **Footer links** to both pages, in the trust block (`Footer.tsx`).
4. **Shared legal identity** — `src/lib/legal/company.ts` (entity, locale,
   website, support email, effective date, SMS program name) + a
   `LegalPage` shell and a `.legal-prose` style.
5. **On-form SMS consent (opt-in, unchecked by default):**
   - **ApplyForm** (already had consent) — enhanced the stored consent text
     to add message frequency and HELP, and added visible links to the SMS
     Terms and Privacy Policy. Storage path unchanged (`applications`:
     `sms_consent` / `sms_consent_at` / `sms_consent_text`).
   - **Become-a-Founder form** — added an optional SMS consent checkbox that
     flows through the existing `leadCaptureSchema.sms_consent` → `/api/lead`
     → `leads.sms_consent` column. **No migration required.**
6. **Callback-only phone clarifications** (no consent stored, no texts sent):
   the Sponsor inquiry form and the Directory submission form now state that
   a phone number is used only to reply, not for automated texts.

## Consent model (unchanged, verified compliant)

Every SMS opt-in is an explicit, **unchecked-by-default** checkbox at the
point of phone collection, with: who is texting (Trucking Life Academy),
message purpose, frequency, "message and data rates may apply", STOP/HELP
instructions, links to the SMS Terms and Privacy Policy, and "consent is not
a condition of enrollment." The application flow records the consent
timestamp and the exact consent text for the TCPA audit trail.

## Owner inputs required before public launch

1. **Support email — confirm or replace.** `LEGAL.contactEmail` in
   `src/lib/legal/company.ts` is currently `privacy@truckinglifewithshawn.com`
   (a role address on the owned domain). **Provision that mailbox, or change
   the constant** to the address you want published. It appears on both legal
   pages and as the SMS HELP/opt-out contact.
2. **Attorney review.** The Privacy Policy and SMS Terms are drafted to
   standard 10DLC/CTIA + general privacy practice, not as legal advice. Have
   counsel review the wording before public reliance (consistent with the
   platform's existing legal-review posture).
3. **Effective date** — set to the merge date; update if you prefer another.

## Provider note (informational)

The repo's SMS pipeline (`src/lib/api/sms.ts`) is **Twilio-direct and
dormant** (`SMS_SENDING_ENABLED=false`, never called; sending refuses
without recorded consent). Your 10DLC registration is with **Text Request**.
The legal pages are written provider-neutral ("our text-messaging
provider"), so no page change is needed if you send via Text Request. When
SMS is turned on, wire the actual send path (Text Request or Twilio) and
keep the consent gate. No SMS is sent today.

## Deferred (needs a decision — not in this PR)

- **Sponsor form SMS consent storage.** The `sponsors` table has no
  `sms_consent` column, so capturing sponsor SMS opt-in would need a small
  migration (add `sms_consent` / `sms_consent_at` / `sms_consent_text`).
  Deferred because (a) it requires a production DB change and (b) sponsors
  are business inquiries we reply to directly, not an SMS marketing list.
  Recommend deferring until an SMS program actually targets sponsors.

## Nothing else changed

No new dependencies, no analytics changes, no live SMS enabled, no redesign.
The only DB-touching path is the Founders form writing the existing
`leads.sms_consent` boolean it already supports.

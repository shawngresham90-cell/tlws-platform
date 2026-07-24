'use client';

import Link from 'next/link';

/**
 * Optional SMS consent checkbox — Text Request / TCPA / 10DLC compliant.
 *
 * - Unchecked by default (the parent initializes its state to `false`).
 * - Never required; the form submits normally whether or not it is checked.
 * - Not bundled with email consent, Privacy Policy acceptance, or general
 *   submission — it is its own explicit affirmative action.
 * - The disclosure paragraph is the EXACT provider-approved wording
 *   (`SMS_CONSENT_DISCLOSURE`). The ONLY enhancement is that the words
 *   "Privacy Policy" are rendered as a link to /privacy — no words are added to
 *   or removed from the approved disclosure.
 * - A separate, clearly-distinct line links /sms-terms. It is deliberately kept
 *   OUT of the approved disclosure text (and out of the checkbox's
 *   `aria-describedby`) so nothing implies the SMS Terms link is part of the
 *   provider-approved disclosure.
 * - All links sit OUTSIDE the `<label>`, so clicking a link never toggles the
 *   checkbox. Focus-visible ring on the input; label click-associated via
 *   `htmlFor`.
 *
 * Merely entering a phone number is never consent; only checking this box is.
 */
export function SmsConsentField({
  id,
  checked,
  onChange,
  label = 'Yes, text me updates (optional)',
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  const descId = `${id}-disclosure`;
  return (
    <div className="rounded-card border border-line bg-asphalt p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={descId}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-line bg-asphalt-800 text-signal accent-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
      </div>

      {/* EXACT provider-approved disclosure. Only "Privacy Policy" is a link. */}
      <p id={descId} className="mt-2 text-xs leading-relaxed text-muted">
        By checking yes, you agree to receive SMS text messages (updates about your school
        application and enrollment, and occasional related information) from Trucking Life Academy
        at the number provided. Consent is not a condition of any purchase or service. Msg &amp;
        data rates may apply. Msg frequency varies. Reply STOP to opt out. Reply HELP for help. By
        submitting this form, you also agree to our{' '}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        .
      </p>

      {/* Separate reference — NOT part of the approved disclosure above. */}
      <p className="mt-2 text-xs text-muted">
        See our{' '}
        <Link
          href="/sms-terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal underline underline-offset-2"
        >
          SMS Terms
        </Link>
        .
      </p>
    </div>
  );
}

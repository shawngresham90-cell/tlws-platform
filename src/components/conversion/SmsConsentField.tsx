'use client';

import Link from 'next/link';
import { disclosureFor, type SmsConsentSource } from '@/lib/leads/sms-consent';

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
  source,
  showSmsTerms = true,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  /**
   * Which form's approved disclosure to render. The paragraph is built from
   * the SAME constant the server stores as evidence, so what the user reads
   * and what we keep on file can never drift apart. Omitted = the legacy
   * academy application wording, so existing callers are unaffected.
   */
  source?: SmsConsentSource;
  /** The SMS Terms line belongs to the primary box only, not to a second one. */
  showSmsTerms?: boolean;
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
          className="mt-0.5 h-6 w-6 shrink-0 rounded border-line bg-asphalt-800 text-signal accent-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
        <label htmlFor={id} className="min-h-[44px] py-2 text-sm font-semibold text-ink">
          {label}
        </label>
      </div>

      {/* EXACT approved disclosure, rendered from the shared constant so the
          displayed wording is byte-identical to the stored evidence. Only the
          words "Privacy Policy" become a link — nothing is added or removed. */}
      <p id={descId} className="mt-2 text-xs leading-relaxed text-muted">
        {(() => {
          const text = source
            ? disclosureFor(source).text
            : 'By checking yes, you agree to receive SMS text messages (updates about your school application and enrollment, and occasional related information) from Trucking Life Academy at the number provided. Consent is not a condition of any purchase or service. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out. Reply HELP for help. By submitting this form, you also agree to our Privacy Policy.';
          const marker = 'Privacy Policy';
          const at = text.indexOf(marker);
          if (at === -1) return text;
          return (
            <>
              {text.slice(0, at)}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal underline underline-offset-2"
              >
                {marker}
              </Link>
              {text.slice(at + marker.length)}
            </>
          );
        })()}
      </p>

      {/* Separate reference — NOT part of the approved disclosure above. */}
      {showSmsTerms && (
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
      )}
    </div>
  );
}

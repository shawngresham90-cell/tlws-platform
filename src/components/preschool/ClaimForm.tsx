'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { TextField, CheckboxField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { trackEvent } from '@/lib/analytics';
import { FOUNDING_WALL_PATH, PRESCHOOL_EVENTS } from '@/lib/preschool/constants';

/**
 * Founding Student claim form. Collects the purchaser's checkout email
 * (private, verification only) and their chosen public display. POSTs to
 * /api/preschool/claim — which can only create a PENDING claim. Publication
 * happens after manual purchase verification in the admin, never here.
 *
 * Analytics: `founding_student_claim_started` on first interaction and
 * `founding_student_claim_submitted` on success — event names only, no
 * personal data attached.
 */
export function ClaimForm({ siteKey }: { siteKey: string }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [confirmedCheckout, setConfirmedCheckout] = useState(false);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [token, setToken] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const markStarted = () => {
    if (!started.current) {
      started.current = true;
      trackEvent(PRESCHOOL_EVENTS.claimStarted);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(turnstileError || 'Complete the verification challenge first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/preschool/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaser_email: email,
          display_name: displayName,
          is_anonymous: anonymous,
          business_name: businessName,
          website_url: websiteUrl,
          confirmed_checkout: confirmedCheckout,
          consent_public_display: consent,
          company_website: honeypot,
          ...(token && token !== 'dev-no-turnstile' ? { turnstileToken: token } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        setDone(true);
        trackEvent(PRESCHOOL_EVENTS.claimSubmitted);
      } else {
        setError(body?.error ?? 'Could not submit your claim. Try again.');
      }
    } catch {
      setError('Network problem — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-signal/50 bg-signal/10 p-8" role="status">
        <h2 className="font-display text-2xl uppercase text-signal">Claim received</h2>
        <p className="mt-3 text-ink">
          Thanks, driver. We verify every Founding Student purchase by hand against Stan Store
          records, so your name won&apos;t appear instantly — once your purchase is confirmed, your
          spot goes up on the{' '}
          <Link
            href={FOUNDING_WALL_PATH}
            className="text-signal underline-offset-4 hover:underline"
          >
            Founding Student Wall
          </Link>
          . Your email stays private and is used only for verification.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onFocusCapture={markStarted} noValidate>
      <div className="space-y-6">
        <TextField
          id="claim-email"
          label="Email used at Stan Store checkout"
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <p className="-mt-4 text-xs text-muted">
          Private. Used only to verify your purchase — never displayed, never shared.
        </p>
        <TextField
          id="claim-display-name"
          label="Public display name for the wall"
          required
          value={displayName}
          onChange={setDisplayName}
          placeholder="e.g. Big Mike R."
        />
        <CheckboxField
          id="claim-anonymous"
          label="List me as “Anonymous Founding Student” instead of my name"
          checked={anonymous}
          onChange={setAnonymous}
        />
        <TextField
          id="claim-business"
          label="Business name (optional)"
          value={businessName}
          onChange={setBusinessName}
        />
        <TextField
          id="claim-website"
          label="Public website (optional, https://)"
          type="url"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          placeholder="https://example.com"
        />

        {/* Honeypot — hidden from humans; bots that fill it get a silent drop. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="company_website">Company website</label>
          <input
            id="company_website"
            name="company_website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <CheckboxField
          id="claim-confirmed"
          label="I completed checkout for CDL Pre-School on Stan Store"
          required
          checked={confirmedCheckout}
          onChange={setConfirmedCheckout}
        />
        <CheckboxField
          id="claim-consent"
          label="I consent to the public display of the information I chose above"
          required
          checked={consent}
          onChange={setConsent}
        />

        <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setTurnstileError} />

        {error && (
          <p
            role="alert"
            className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit my Founding Student claim'}
        </button>
        <p className="text-xs text-muted">
          Submitting does not publish anything. Every claim is verified against Stan Store records
          by hand before a name appears on the wall.
        </p>
      </div>
    </form>
  );
}

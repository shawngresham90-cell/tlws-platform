'use client';

import { useState } from 'react';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { trackEvent } from '@/lib/analytics';

/**
 * Newsletter capture island. Posts to the existing guarded lead pipeline
 * (`POST /api/lead`, source "newsletter") — no new email provider, no
 * campaign machinery. Repeat submits are safe (the API upserts by email).
 * UTM parameters present on the page URL ride along so the owner can see
 * which video/post produced each signup.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** utm_* params from the current URL, bounded to the schema's string map. */
export function collectUtm(): Record<string, string> {
  const utm: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of params) {
    if (/^utm_[a-z]+$/i.test(key) && value) utm[key.toLowerCase()] = value.slice(0, 200);
  }
  return utm;
}

export function NewsletterForm({ siteKey }: { siteKey: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!token) {
      setError(turnstileError || 'Please complete the verification challenge below.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source: 'newsletter',
          utm: collectUtm(),
          turnstileToken: token,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body.error ?? 'Something went wrong. Please try again.');
        return;
      }
      trackEvent('newsletter_lead_captured');
      setDone(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div aria-live="polite" className="max-w-md rounded-card border border-line bg-asphalt p-5">
        <p className="font-semibold text-ink">✓ You’re on the list.</p>
        <p className="mt-1 text-sm text-muted">
          Thanks — Shawn’s next driver briefing will land in your inbox. No spam, unsubscribe
          anytime.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md">
      <div aria-live="assertive">
        {error && (
          <p className="mb-3 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          aria-invalid={Boolean(error) || undefined}
          className="flex-1 rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
        />
        <button
          type="submit"
          disabled={submitting}
          aria-disabled={submitting}
          className="rounded-card bg-signal px-6 py-3 font-display text-lg uppercase text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send it'}
        </button>
      </div>
      <div className="mt-4">
        <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setTurnstileError} />
      </div>
    </form>
  );
}

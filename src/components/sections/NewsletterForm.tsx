'use client';

import { useEffect, useRef, useState } from 'react';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { trackEvent } from '@/lib/analytics';
import { NEWSLETTER_EVENTS } from '@/lib/leads/analytics';
import { leadAttribution } from '@/lib/attribution';

/**
 * Newsletter capture island. Posts to the existing guarded lead pipeline
 * (`POST /api/lead`, source "newsletter") — no new email provider, no
 * campaign machinery.
 *
 * Repeat submits are safe and write nothing: the API merges by email and only
 * touches columns the submitting form actually collected, so typing an address
 * in here can never overwrite a name, phone, first-touch campaign or consent
 * captured by some other form. It reports `created` so the two outcomes are
 * counted separately — see lib/leads/analytics.ts.
 *
 * Attribution comes from `leadAttribution()` — the session's FIRST-touch utm,
 * not just the current URL. A driver who arrives on a `/go/...` short link and
 * then browses to the page holding this form still carries the campaign that
 * sent them.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterForm({ siteKey }: { siteKey: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [token, setToken] = useState('');
  // Turnstile tokens are single-use and verified server-side before the
  // handler runs, so after ANY failed submit the held token is spent.
  // Bumping this key remounts the widget for a fresh challenge.
  const [challengeKey, setChallengeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const doneRef = useRef<HTMLDivElement>(null);

  // Move focus to the confirmation so it is announced (a live region that
  // mounts together with its content is not) and keyboard users aren't
  // stranded when the form unmounts.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;
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
          utm: leadAttribution(),
          turnstileToken: token,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body.error ?? 'Something went wrong. Please try again.');
        setToken('');
        setChallengeKey((k) => k + 1);
        return;
      }
      // A repeat signup and a genuine new subscriber both return 2xx, so
      // firing one event for both counted SUBMISSIONS, not subscribers — and
      // `done` is component state, so a reload or a return visit re-fires it.
      // The API now reports which happened; the two are reported separately so
      // the subscriber number stays a subscriber number. `created` is a fact
      // about the write, never about the person.
      trackEvent(
        body.data?.created ? NEWSLETTER_EVENTS.captured : NEWSLETTER_EVENTS.alreadySubscribed,
      );
      setDone(true);
    } catch {
      setError('Network error. Check your connection and try again.');
      setToken('');
      setChallengeKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        className="max-w-md rounded-card border border-line bg-asphalt p-5 outline-none"
      >
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
          <p
            id="newsletter-email-error"
            className="mb-3 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
          >
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
          aria-describedby={error ? 'newsletter-email-error' : undefined}
          className="flex-1 rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
        />
        {/* aria-disabled + in-handler guard instead of disabled, so keyboard
            focus isn't thrown off the button mid-submit. */}
        <button
          type="submit"
          aria-disabled={submitting}
          className="rounded-card bg-signal px-6 py-3 font-display text-lg uppercase text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt aria-disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send it'}
        </button>
      </div>
      <div className="mt-4">
        <TurnstileWidget
          key={challengeKey}
          siteKey={siteKey}
          onToken={setToken}
          onError={setTurnstileError}
        />
      </div>
    </form>
  );
}

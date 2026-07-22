'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { TextField, SelectField, CheckboxField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { FOUNDER_TIERS } from './tiers';

// Stored as leads.sms_consent when checked (opt-in only, unchecked by default).
const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Trucking Life Academy about founding the school. ' +
  'Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. ' +
  'Consent is not a condition.';

/**
 * "Become a founder" interest capture. No payment is processed here (payments
 * are a later milestone) — this records intent through the existing guarded,
 * Turnstile-protected lead pipeline (`POST /api/lead`, source "founder") so
 * Shawn can follow up personally to arrange the contribution. The selected tier
 * rides along in `utm.founder_tier` (no schema change). Email/SMS stay off.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

const TIER_OPTIONS = FOUNDER_TIERS.map((t) => ({ value: t.value, label: t.label }));

type Errors = Record<string, string>;

export function BecomeFounderForm({ siteKey }: { siteKey: string }) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [tier, setTier] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set<T>(setter: (v: T) => void, key: string) {
    return (v: T) => {
      setter(v);
      setErrors((p) => ({ ...p, [key]: '' }));
    };
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!firstName.trim()) e.first_name = 'Enter your name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email.';
    if (phone.trim() && !PHONE_RE.test(phone.trim())) e.phone = 'Enter a valid phone number.';
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (!token) {
      setFormError(
        turnstileError || 'Please complete the verification challenge before continuing.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          first_name: firstName.trim(),
          phone: phone.trim(),
          sms_consent: smsConsent,
          source: 'founder',
          utm: tier ? { founder_tier: tier } : {},
          turnstileToken: token,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFormError(body.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setFormError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal text-2xl text-asphalt">
          ✓
        </div>
        <h3 className="display-section mt-6 text-2xl">You’re on the list</h3>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Thanks, {firstName || 'friend'}. Shawn will reach out personally to walk you through
          becoming a founder — no payment was taken here.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-card border border-line bg-asphalt-800 p-8"
    >
      <div aria-live="assertive">
        {formError && (
          <p className="mb-5 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
            {formError}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="founder_first_name"
          label="Your name"
          required
          value={firstName}
          onChange={set(setFirstName, 'first_name')}
          autoComplete="name"
          error={errors.first_name}
        />
        <TextField
          id="founder_email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={set(setEmail, 'email')}
          autoComplete="email"
          inputMode="email"
          error={errors.email}
        />
        <TextField
          id="founder_phone"
          label="Phone (optional)"
          type="tel"
          value={phone}
          onChange={set(setPhone, 'phone')}
          autoComplete="tel"
          inputMode="tel"
          placeholder="(555) 555-5555"
          error={errors.phone}
        />
        <SelectField
          id="founder_tier"
          label="Interested tier (optional)"
          value={tier}
          onChange={set(setTier, 'tier')}
          options={TIER_OPTIONS}
          placeholder="No preference yet"
        />
      </div>

      {/* Optional SMS opt-in — only texts you if you check it (TCPA/10DLC). */}
      <div className="mt-5">
        <CheckboxField
          id="founder_sms_consent"
          label="SMS consent"
          checked={smsConsent}
          onChange={setSmsConsent}
        >
          {SMS_CONSENT_TEXT} See our{' '}
          <Link href="/sms-terms" target="_blank" className="text-signal underline">
            SMS Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" className="text-signal underline">
            Privacy Policy
          </Link>
          .
        </CheckboxField>
      </div>

      <div className="mt-6">
        <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setTurnstileError} />
      </div>

      <p className="mt-6 text-xs text-muted">
        No payment is collected here. This just tells us you’re interested — Shawn follows up to set
        up your contribution.
      </p>

      <div className="mt-6">
        <Button type="submit" aria-disabled={submitting} disabled={submitting}>
          {submitting ? 'Sending…' : 'Count me in'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { TextField, SelectField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';

/**
 * Sponsor inquiry form. Posts to the existing guarded, Turnstile-protected
 * pipeline (`POST /api/sponsor-inquiry`), which files the prospect into the
 * sponsor CRM and logs an inbound touch. No pricing is committed here —
 * every conversation starts with a reply from Shawn.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

const INTEREST_OPTIONS = [
  { value: 'founding-sponsor', label: 'Founding Sponsor' },
  { value: 'directory-placement', label: 'Directory placement' },
  { value: 'equipment-or-students', label: 'Equipment / sponsor a student' },
  { value: 'other', label: 'Something else' },
];

type Errors = Record<string, string>;

export function SponsorInquiryForm({ siteKey }: { siteKey: string }) {
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [interest, setInterest] = useState('');
  const [message, setMessage] = useState('');
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
    if (!company.trim()) e.company = 'Enter your company name.';
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
      const res = await fetch('/api/sponsor-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          contact_name: contactName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim(),
          tier_interest: interest || undefined,
          message: message.trim() || undefined,
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
      <div
        aria-live="polite"
        className="rounded-card border border-line bg-asphalt-800 p-8 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal text-2xl text-asphalt">
          ✓
        </div>
        <h3 className="display-section mt-6 text-2xl">Inquiry received</h3>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Thanks{contactName ? `, ${contactName}` : ''} — Shawn will reach out personally to talk
          placements, goals, and rates. Nothing is committed until you talk.
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
          <p className="mb-5 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
            {formError}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="sponsor_company"
          label="Company"
          required
          value={company}
          onChange={set(setCompany, 'company')}
          autoComplete="organization"
          error={errors.company}
        />
        <TextField
          id="sponsor_contact_name"
          label="Contact name (optional)"
          value={contactName}
          onChange={set(setContactName, 'contact_name')}
          autoComplete="name"
          error={errors.contact_name}
        />
        <TextField
          id="sponsor_email"
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
          id="sponsor_phone"
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
          id="sponsor_interest"
          label="What are you interested in? (optional)"
          value={interest}
          onChange={set(setInterest, 'interest')}
          options={INTEREST_OPTIONS}
          placeholder="Not sure yet"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="sponsor_message" className="mb-1.5 block text-sm font-semibold text-ink">
          Anything we should know? (optional)
        </label>
        <textarea
          id="sponsor_message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          rows={4}
          className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
          placeholder="Goals, audience, timing — whatever helps the first conversation."
        />
      </div>

      <div className="mt-6">
        <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setTurnstileError} />
      </div>

      <p className="mt-6 text-xs text-muted">
        No payment is collected and no rate is committed here. This starts a conversation — Shawn
        replies personally.
      </p>

      <div className="mt-6">
        <Button type="submit" aria-disabled={submitting} disabled={submitting}>
          {submitting ? 'Sending…' : 'Start the conversation'}
        </Button>
      </div>
    </form>
  );
}

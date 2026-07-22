'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { TextField, SelectField, CheckboxField } from './Fields';
import { TurnstileWidget } from './TurnstileWidget';
import { captureAttribution, readAttribution } from '@/lib/attribution';

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
].map((s) => ({ value: s, label: s }));

const TIMEFRAMES = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '30_days', label: 'Within 30 days' },
  { value: '60_days', label: 'Within 60 days' },
  { value: '90_plus', label: '90+ days out' },
  { value: 'researching', label: 'Just researching for now' },
];

const FUNDING = [
  { value: 'self', label: 'Paying myself' },
  { value: 'employer', label: 'Employer / company-sponsored' },
  { value: 'wioa', label: 'Workforce grant (WIOA)' },
  { value: 'va', label: 'VA / GI Bill benefits' },
  { value: 'sponsor', label: 'Sponsorship / community-funded' },
  { value: 'unsure', label: 'Not sure yet' },
];

const PERMIT = [
  { value: 'yes', label: 'Yes, I have my CLP' },
  { value: 'no', label: 'Not yet' },
];

// Stored verbatim as sms_consent_text for the TCPA audit trail. Keep it a
// plain string (no markup); the on-screen label appends the policy links.
const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Trucking Life Academy about my application and enrollment. ' +
  'Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. ' +
  'Consent is not a condition of enrollment.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

type Step1 = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
};
type Step2 = {
  has_permit: string;
  age_confirmed: boolean;
  start_timeframe: string;
  funding_type: string;
  sms_consent: boolean;
};
type Errors = Record<string, string>;

const EMPTY1: Step1 = { first_name: '', last_name: '', email: '', phone: '', city: '', state: '' };
const EMPTY2: Step2 = {
  has_permit: '',
  age_confirmed: false,
  start_timeframe: '',
  funding_type: '',
  sms_consent: false,
};

/**
 * Save-and-resume: a driver applying from the sleeper gets interrupted — a
 * dropped signal or a closed tab must never eat the application. The draft
 * lives only on this device (localStorage), expires after 7 days, and is
 * cleared the moment the application submits. No server writes involved.
 */
const DRAFT_KEY = 'tlws-apply-draft-v1';
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Draft = {
  s1: Step1;
  s2: Step2;
  step: 1 | 2;
  appId: string;
  savedAt: number;
  createdAt?: number;
};

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d?.savedAt || Date.now() - (d.createdAt ?? d.savedAt) > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function saveDraft(d: Omit<Draft, 'savedAt'>) {
  try {
    // createdAt is set once and preserved — expiry never rolls forward.
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    /* storage full/blocked — resume is best-effort */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function ApplyForm({ siteKey }: { siteKey: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [s1, setS1] = useState<Step1>(EMPTY1);
  const [s2, setS2] = useState<Step2>(EMPTY2);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [appId, setAppId] = useState('');
  const [resumed, setResumed] = useState(false);
  const utmRef = useRef<Record<string, string>>({});
  const draftCreatedAt = useRef<number | undefined>(undefined);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Mount: capture attribution (covers direct tagged entry; site-wide
  // capture in the layout handles every other page), then restore any
  // saved draft (client-only).
  useEffect(() => {
    captureAttribution();
    utmRef.current = readAttribution();
    const draft = loadDraft();
    if (draft) {
      draftCreatedAt.current = draft.createdAt ?? draft.savedAt;
      setS1(draft.s1);
      setS2(draft.s2);
      setAppId(draft.appId);
      setStep(draft.step);
      setResumed(true);
    }
    trackEvent('application_started');
  }, []);

  // Persist the draft whenever answers change (pre-submission steps only).
  useEffect(() => {
    if (step === 3) return;
    const empty =
      JSON.stringify(s1) === JSON.stringify(EMPTY1) &&
      JSON.stringify(s2) === JSON.stringify(EMPTY2);
    if (empty && !appId) return;
    saveDraft({ s1, s2, step, appId, createdAt: draftCreatedAt.current ?? Date.now() });
  }, [s1, s2, step, appId]);

  // Move focus to the step heading whenever the step changes (a11y).
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  /**
   * Escape hatch: discard the on-device draft and begin a fresh
   * application. Also the exit from a stale resumed draft whose
   * application row no longer exists server-side (step-2 update errors).
   */
  function startOver() {
    clearDraft();
    draftCreatedAt.current = undefined;
    setS1(EMPTY1);
    setS2(EMPTY2);
    setAppId('');
    setErrors({});
    setFormError('');
    setResumed(false);
    setStep(1);
    headingRef.current?.focus();
  }

  function set1<K extends keyof Step1>(k: K, v: Step1[K]) {
    setS1((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  }
  function set2<K extends keyof Step2>(k: K, v: Step2[K]) {
    setS2((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  }

  function validate1(): Errors {
    const e: Errors = {};
    if (!s1.first_name.trim()) e.first_name = 'Enter your first name.';
    if (!s1.last_name.trim()) e.last_name = 'Enter your last name.';
    if (!EMAIL_RE.test(s1.email.trim())) e.email = 'Enter a valid email.';
    if (!PHONE_RE.test(s1.phone.trim())) e.phone = 'Enter a valid phone number.';
    if (!s1.city.trim()) e.city = 'Enter your city.';
    if (!s1.state) e.state = 'Select your state.';
    return e;
  }

  function validate2(): Errors {
    const e: Errors = {};
    if (!s2.has_permit) e.has_permit = 'Let us know your permit status.';
    if (!s2.start_timeframe) e.start_timeframe = 'Pick a timeline.';
    if (!s2.funding_type) e.funding_type = 'Choose how you plan to pay.';
    if (!s2.age_confirmed) e.age_confirmed = 'Please confirm your age to continue.';
    return e;
  }

  async function submitStep1(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    const e = validate1();
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
      const res = await fetch('/api/application/step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: s1.first_name.trim(),
          last_name: s1.last_name.trim(),
          email: s1.email.trim(),
          phone: s1.phone.trim(),
          city: s1.city.trim(),
          state: s1.state,
          utm: utmRef.current,
          turnstileToken: token,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFormError(body.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setAppId(body.data.application_id);
      trackEvent('application_step1_completed');
      setStep(2);
    } catch {
      setFormError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStep2(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    const e = validate2();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/application/step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: appId,
          has_permit: s2.has_permit === 'yes',
          age_confirmed: s2.age_confirmed,
          start_timeframe: s2.start_timeframe,
          funding_type: s2.funding_type,
          sms_consent: s2.sms_consent,
          sms_consent_text: s2.sms_consent ? SMS_CONSENT_TEXT : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFormError(body.error ?? 'Something went wrong. Please try again.');
        return;
      }
      trackEvent('application_submitted');
      clearDraft();
      setStep(3);
    } catch {
      setFormError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Confirmation ---
  if (step === 3) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-center sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal text-2xl text-asphalt">
          ✓
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="display-section mt-6 outline-none">
          Application received
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Thanks, {s1.first_name || 'driver'}. Your application is in. A member of the Trucking Life
          Academy team will reach out about next steps — no runaround, just a straight conversation.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button href="/knowledge">Study while you wait</Button>
          <Button variant="ghost" href="/academy/curriculum">
            Review the curriculum
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Resume notice — a dropped signal never eats a driver's application.
          The live region is always present; only its TEXT appears on resume,
          so screen readers reliably announce the change. */}
      <p
        role="status"
        className={
          resumed
            ? 'mb-5 rounded-card border border-line bg-cab px-4 py-3 text-sm text-muted'
            : 'sr-only'
        }
      >
        {resumed && (
          <>
            <strong className="text-ink">Welcome back.</strong> We saved your progress on this
            device — pick up right where you left off.{' '}
            <button
              type="button"
              onClick={startOver}
              className="font-semibold text-signal underline underline-offset-4 hover:text-signal-600"
            >
              Clear saved answers and start over
            </button>
          </>
        )}
      </p>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span className={step >= 1 ? 'text-signal' : undefined}>1 · Your info</span>
          <span className={step >= 2 ? 'text-signal' : undefined}>2 · Your goals</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-asphalt-700">
          <div
            className="h-full rounded-full bg-signal transition-all"
            style={{ width: step === 1 ? '50%' : '100%' }}
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={2}
            aria-label={`Step ${step} of 2`}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Your answers save automatically on this device — lose signal, come back, keep going.
        </p>
      </div>

      {/* Form-level error (announced) */}
      <div aria-live="assertive">
        {formError && (
          <p className="mb-5 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
            {formError}
            {step === 2 && appId && (
              <>
                {' '}
                If this keeps happening,{' '}
                <button
                  type="button"
                  onClick={startOver}
                  className="font-semibold underline underline-offset-4"
                >
                  start over with a fresh application
                </button>{' '}
                — your saved answers will be cleared.
              </>
            )}
          </p>
        )}
      </div>

      {step === 1 && (
        <form onSubmit={submitStep1} noValidate>
          <h2 ref={headingRef} tabIndex={-1} className="display-section mb-1 text-2xl outline-none">
            Let’s start with you
          </h2>
          <p className="mb-6 text-sm text-muted">Step 1 of 2 — takes about a minute.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="first_name"
              label="First name"
              required
              value={s1.first_name}
              onChange={(v) => set1('first_name', v)}
              autoComplete="given-name"
              error={errors.first_name}
            />
            <TextField
              id="last_name"
              label="Last name"
              required
              value={s1.last_name}
              onChange={(v) => set1('last_name', v)}
              autoComplete="family-name"
              error={errors.last_name}
            />
            <TextField
              id="email"
              label="Email"
              type="email"
              required
              value={s1.email}
              onChange={(v) => set1('email', v)}
              autoComplete="email"
              inputMode="email"
              error={errors.email}
            />
            <TextField
              id="phone"
              label="Phone"
              type="tel"
              required
              value={s1.phone}
              onChange={(v) => set1('phone', v)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(555) 555-5555"
              error={errors.phone}
            />
            <TextField
              id="city"
              label="City"
              required
              value={s1.city}
              onChange={(v) => set1('city', v)}
              autoComplete="address-level2"
              error={errors.city}
            />
            <SelectField
              id="state"
              label="State"
              required
              value={s1.state}
              onChange={(v) => set1('state', v)}
              options={US_STATES}
              placeholder="Select state"
              error={errors.state}
            />
          </div>

          <div className="mt-6">
            <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setTurnstileError} />
          </div>

          <div className="mt-8">
            <Button
              type="submit"
              className="w-full sm:w-auto"
              aria-disabled={submitting}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Continue'}
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitStep2} noValidate>
          <h2 ref={headingRef} tabIndex={-1} className="display-section mb-1 text-2xl outline-none">
            A few quick questions
          </h2>
          <p className="mb-6 text-sm text-muted">
            Step 2 of 2 — this helps us point you the right way.
          </p>
          <div className="grid gap-5">
            <SelectField
              id="has_permit"
              label="Do you have your CLP (commercial learner’s permit)?"
              required
              value={s2.has_permit}
              onChange={(v) => set2('has_permit', v)}
              options={PERMIT}
              error={errors.has_permit}
            />
            <SelectField
              id="start_timeframe"
              label="When do you want to start?"
              required
              value={s2.start_timeframe}
              onChange={(v) => set2('start_timeframe', v)}
              options={TIMEFRAMES}
              error={errors.start_timeframe}
            />
            <SelectField
              id="funding_type"
              label="How do you plan to pay for training?"
              required
              value={s2.funding_type}
              onChange={(v) => set2('funding_type', v)}
              options={FUNDING}
              error={errors.funding_type}
            />

            <CheckboxField
              id="age_confirmed"
              label="Age confirmation"
              required
              checked={s2.age_confirmed}
              onChange={(v) => set2('age_confirmed', v)}
              error={errors.age_confirmed}
            >
              I confirm I am at least <strong className="text-ink">21 years old</strong> (or 18 for
              intrastate Georgia driving).
            </CheckboxField>

            <CheckboxField
              id="sms_consent"
              label="SMS consent"
              checked={s2.sms_consent}
              onChange={(v) => set2('sms_consent', v)}
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

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button type="submit" aria-disabled={submitting} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setStep(1);
              }}
              className="text-sm font-semibold text-muted underline-offset-4 hover:text-signal hover:underline"
            >
              ← Back
            </button>
          </div>

          <p className="mt-6 text-xs text-muted">
            By submitting, you agree to be contacted about enrollment. No payment is collected here
            — see{' '}
            <Link href="/academy/financing" className="text-signal hover:underline">
              financing options
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}

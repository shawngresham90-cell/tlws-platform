'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui';
import {
  CONSENT_COPY,
  normalizePhone,
  type AccountActionState,
} from '@/lib/navigator-account/signup-contract';
import { requestCodeAction, verifyCodeAction } from '@/app/(navigator)/navigator/account/actions';

/**
 * The account screen, mobile first, because the driver filling it in is
 * standing beside a truck holding a phone.
 *
 * TWO STAGES, ONE FORM. The fields a driver typed are still needed after the
 * code arrives — the profile is written at verification, not before, since
 * there is no user to own it until a code is verified. Rather than stash them
 * in a cookie or a server session, the code stage carries them as hidden
 * inputs on the same form. Nothing sensitive rides along: a first name, an
 * address they just typed, and two booleans.
 *
 * WHAT IS NOT HERE, deliberately: no password field, no username, no "confirm
 * email", no marketing checkbox that starts ticked, and no way to reach the
 * Navigator that requires agreeing to marketing. The required box is the
 * Privacy Policy and nothing else — this platform has no Terms page, and a
 * checkbox claiming acceptance of a document that does not exist would be
 * recording an agreement nobody could ever have read.
 */

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Working…' : children}
    </Button>
  );
}

const PROBLEM_TEXT: Record<string, string> = {
  'first-name-required': 'Enter your first name.',
  'first-name-too-long': 'That name is too long.',
  'email-required': 'Enter your email address.',
  'email-invalid': 'That email address does not look right.',
  'phone-invalid': 'That phone number does not look right. Leave it blank if you would rather.',
  'privacy-required': 'Please accept the Privacy Policy to continue.',
  'sms-consent-needs-phone': 'Add a phone number, or untick the text-message box.',
};

export function AccountForm({ next }: { next: string }) {
  const [returning, setReturning] = useState(false);
  const [phone, setPhone] = useState('');
  const [state, formAction] = useFormState<AccountActionState, FormData>(requestCodeAction, {
    stage: 'collect',
  });
  const [verifyState, verifyAction] = useFormState<AccountActionState, FormData>(verifyCodeAction, {
    stage: 'code',
  });

  // The SMS box is offered only once there is a number to text. Rendering it
  // disabled-but-visible would invite a driver to tick something inert.
  const phoneUsable = normalizePhone(phone) !== null;
  const active = state.stage === 'code' ? state : null;

  if (active) {
    return (
      <form action={verifyAction} className="space-y-5">
        <input type="hidden" name="next" value={active.next ?? next} />
        <input type="hidden" name="email" value={active.email ?? ''} />
        {/*
          The answers the driver already gave, carried to the step that can
          finally store them. A returning driver's `collected` is absent, so
          nothing is submitted and nothing overwrites the profile they have.
        */}
        {active.collected && (
          <>
            <input type="hidden" name="firstName" value={active.collected.firstName} />
            <input type="hidden" name="phone" value={active.collected.phone} />
            {active.collected.emailMarketing && (
              <input type="hidden" name="emailMarketing" value="on" />
            )}
            {active.collected.smsMarketing && (
              <input type="hidden" name="smsMarketing" value="on" />
            )}
          </>
        )}

        <p className="rounded-card border border-line bg-asphalt-800 px-4 py-3 text-sm text-ink/80">
          {active.message}
        </p>
        {verifyState.message && (
          <p
            role="alert"
            className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
          >
            {verifyState.message}
          </p>
        )}

        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-semibold text-ink">
            Six-digit code
          </label>
          <input
            id="code"
            name="code"
            /*
             * `inputMode` and `autoComplete` are what make this one tap on a
             * phone: a numeric keypad, and the OS offering the code straight
             * from the notification. `type="text"` rather than `number` on
             * purpose — a number input strips leading zeros, and a code can
             * start with one.
             */
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-center text-2xl tracking-[0.4em] text-ink outline-none focus:border-signal"
          />
        </div>

        <SubmitButton>Verify and enter Navigator</SubmitButton>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="returning" value={String(returning)} />

      {state.problems && state.problems.length > 0 && (
        <ul
          role="alert"
          className="space-y-1 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
        >
          {state.problems.map((p) => (
            <li key={p}>{PROBLEM_TEXT[p] ?? 'Please check that field.'}</li>
          ))}
        </ul>
      )}
      {state.message && (
        <p
          role="alert"
          className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
        >
          {state.message}
        </p>
      )}

      {!returning && (
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-sm font-semibold text-ink">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            maxLength={80}
            className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
        />
      </div>

      {!returning && (
        <>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-ink">
              Phone <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="acceptedPrivacy"
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-signal"
            />
            <span>
              I agree to the{' '}
              <Link href="/privacy" className="text-signal underline" target="_blank">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-ink">
            {/* Never `defaultChecked`. Consent that arrives pre-ticked is not consent. */}
            <input
              type="checkbox"
              name="emailMarketing"
              className="mt-0.5 h-5 w-5 shrink-0 accent-signal"
            />
            <span>{CONSENT_COPY.emailMarketing}</span>
          </label>

          {phoneUsable && (
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                name="smsMarketing"
                className="mt-0.5 h-5 w-5 shrink-0 accent-signal"
              />
              <span>{CONSENT_COPY.smsMarketing}</span>
            </label>
          )}
        </>
      )}

      <SubmitButton>Email My 6-Digit Code</SubmitButton>

      <p className="text-xs text-muted">{CONSENT_COPY.transactionalNote}</p>

      <button
        type="button"
        onClick={() => setReturning((v) => !v)}
        className="w-full text-sm text-signal underline"
      >
        {returning ? 'New here? Create an account' : 'Already have an account? Send me a code'}
      </button>
    </form>
  );
}

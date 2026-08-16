import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button, Container } from '@/components/ui';
import { AccountForm } from '@/components/navigator/AccountForm';
import { buildMetadata } from '@/lib/seo/metadata';
import { navigatorFlagEnabled, sanitizeNextPath } from '@/lib/navigator-api/pilot-access';
import { navigatorAccessMode } from '@/lib/navigator-api/access-policy';
import { createClient } from '@/lib/supabase/server';
import { CONSENT_COPY } from '@/lib/navigator-account/signup-contract';
import { deleteAccountAction, signOutAction, updateMarketingAction } from './actions';

/**
 * The Navigator account screen: sign in when signed out, manage the account
 * when signed in.
 *
 * OUTSIDE THE GATE, like the passcode screen and for the same reason —
 * `isProtectedNavigatorPath` excludes it, because gating the way in would
 * redirect to itself forever.
 *
 * NOT FLAG-GATED either, matching the passcode screen: it is a landing point
 * a driver may bookmark, and it holds no Navigator functionality. Every
 * surface that does keeps its own flag check and its own access check.
 *
 * ACCOUNT CONTROLS LIVE HERE AND NOWHERE ELSE. Sign out, marketing consent
 * and account deletion are all on this page, deliberately away from the
 * driving cockpit — a control that ends a session has no business being
 * reachable from a screen someone is looking at through a windscreen.
 *
 * force-dynamic because the answer depends on a session; a cached render
 * would hand one driver's account to the next.
 */

export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  title: 'Navigator Account | Trucking Life with Shawn',
  description: 'Sign in to the TLWS Navigator with a six-digit code sent to your email.',
  path: '/navigator/account',
  noindex: true,
});

export default async function NavigatorAccountPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const next = sanitizeNextPath(
    typeof searchParams?.next === 'string' ? searchParams.next : undefined,
  );
  const mode = navigatorAccessMode();

  /*
   * Modes other than `account` have their own front door, and this page is
   * not it. Forwarding rather than rendering keeps a stale bookmark from
   * showing a sign-in form on a deploy where signing in does nothing — and
   * mirrors what the passcode screen does for `public`.
   */
  if (mode !== 'account') {
    redirect(navigatorFlagEnabled() ? next : '/');
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Container className="py-12 sm:py-20">
        <div className="mx-auto max-w-sm rounded-card border border-line bg-asphalt-800 p-6 sm:p-8">
          <h1 className="display-section mb-1 text-2xl">
            Navigator Account<span className="text-signal">.</span>
          </h1>
          <p className="mb-6 text-sm text-muted">
            Free, and no password to remember — we email you a six-digit code.
          </p>
          <AccountForm next={next} />
        </div>
      </Container>
    );
  }

  const { data: profileRow } = await supabase
    .from('navigator_profiles')
    .select('first_name, email, phone')
    .eq('user_id', user.id)
    .maybeSingle();
  const profile = profileRow as { first_name: string; email: string; phone: string | null } | null;

  const saved = searchParams?.saved === '1';
  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;

  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="rounded-card border border-line bg-asphalt-800 p-6 sm:p-8">
          <h1 className="display-section mb-1 text-2xl">
            Your Account<span className="text-signal">.</span>
          </h1>
          <p className="text-sm text-muted">
            {profile?.first_name ? `Signed in as ${profile.first_name}` : 'Signed in'} ·{' '}
            {profile?.email ?? user.email}
          </p>

          {saved && (
            <p className="mt-4 rounded-card border border-line bg-asphalt px-4 py-3 text-sm text-ink">
              Saved.
            </p>
          )}
          {error === 'confirm' && (
            <p
              role="alert"
              className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300"
            >
              Type DELETE exactly to confirm.
            </p>
          )}
          {error === 'delete' && (
            <p
              role="alert"
              className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300"
            >
              That didn’t work. Try again, or email us and we’ll do it by hand.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link href="/drive" className="w-full">
              <Button className="w-full">Open Navigator</Button>
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full rounded-card border border-line px-4 py-3 text-sm font-semibold text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/*
          Marketing consent. Ticking appends an opt-in; unticking appends an
          unsubscribe. Neither edits anything — the derived view reads the
          latest instruction, so the export follows this control on the next
          read and the record of what was originally agreed survives.
        */}
        <form
          action={updateMarketingAction}
          className="rounded-card border border-line bg-asphalt-800 p-6"
        >
          <h2 className="font-display text-lg uppercase text-ink">Email</h2>
          <label className="mt-4 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="emailMarketing"
              className="mt-0.5 h-5 w-5 shrink-0 accent-signal"
            />
            <span>{CONSENT_COPY.emailMarketing}</span>
          </label>
          <p className="mt-3 text-xs text-muted">{CONSENT_COPY.transactionalNote}</p>
          <button
            type="submit"
            className="mt-4 w-full rounded-card border border-line px-4 py-3 text-sm font-semibold text-ink"
          >
            Save email preference
          </button>
        </form>

        <form
          action={deleteAccountAction}
          className="rounded-card border border-diesel/40 bg-asphalt-800 p-6"
        >
          <h2 className="font-display text-lg uppercase text-diesel-300">Delete account</h2>
          <p className="mt-2 text-sm text-muted">
            Removes your account, your saved truck and your preferences. Your record of what you
            agreed to receive is kept — that is the proof we had permission, and deleting it would
            leave us unable to show it.
          </p>
          <label htmlFor="confirm" className="mt-4 mb-1.5 block text-sm font-semibold text-ink">
            Type DELETE to confirm
          </label>
          <input
            id="confirm"
            name="confirm"
            type="text"
            autoComplete="off"
            className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-diesel"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-card border border-diesel px-4 py-3 text-sm font-semibold text-diesel-300"
          >
            Delete my account
          </button>
        </form>
      </div>
    </Container>
  );
}

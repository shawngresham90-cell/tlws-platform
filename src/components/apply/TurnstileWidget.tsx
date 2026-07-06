'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget. Renders the challenge and hands the resulting
 * token back via `onToken`.
 *
 * Missing-site-key behavior is environment-aware:
 *   - Local dev (`next dev`, NODE_ENV !== 'production'): renders nothing and
 *     supplies a dev sentinel token so the form isn't blocked before Cloudflare
 *     is wired. The server's verifyTurnstile() also skips verification when its
 *     secret is unset, so the flow works end-to-end locally.
 *   - Production builds (this includes Netlify deploy previews — `next build`
 *     sets NODE_ENV=production): a missing site key is a real misconfiguration.
 *     Emitting a sentinel here would send a fake token that siteverify rejects,
 *     surfacing as a bogus "Verification failed" that looks like a Cloudflare
 *     problem. Instead we render a clear configuration error, report it to the
 *     parent via `onError`, and keep the token empty so submission is blocked.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const CONFIG_ERROR_MESSAGE =
  'Verification is temporarily unavailable due to a configuration issue on our end. ' +
  'Please try again shortly, or contact us directly and we’ll get your application in.';

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // A missing site key in a production build is a real misconfiguration, not a
  // dev convenience — surface the error instead of faking a token.
  const misconfigured = !siteKey && process.env.NODE_ENV === 'production';

  useEffect(() => {
    if (!siteKey) {
      if (process.env.NODE_ENV === 'production') {
        // Fail closed: no sentinel. Keep the token empty so the form stays
        // blocked, and surface the real cause (to the user and the console).
        // eslint-disable-next-line no-console
        console.error(
          '[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set in this build. ' +
            'The verification widget cannot render and the application form is blocked. ' +
            'Set the env var (Builds scope + the correct deploy context) and rebuild.',
        );
        onToken('');
        onError?.(CONFIG_ERROR_MESSAGE);
        return;
      }
      // Local dev only: unblock the form with a sentinel token.
      onToken('dev-no-turnstile');
      return;
    }

    let cancelled = false;

    function renderWidget() {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (widgetId.current) return; // already rendered
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      // Script tag exists but not ready yet — poll briefly for the global.
      const t = setInterval(() => {
        if (window.turnstile) {
          clearInterval(t);
          renderWidget();
        }
      }, 200);
      return () => clearInterval(t);
    }

    return () => {
      cancelled = true;
    };
  }, [siteKey, onToken, onError]);

  if (misconfigured) {
    return (
      <div
        role="alert"
        className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel"
      >
        {CONFIG_ERROR_MESSAGE}
      </div>
    );
  }

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" aria-label="Verification challenge" />;
}

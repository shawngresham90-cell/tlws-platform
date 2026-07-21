'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget. Renders the challenge and hands the resulting
 * token back via `onToken`.
 *
 * Token lifecycle matters here: a solved Turnstile token is only valid for a
 * few minutes, and in "managed" mode the widget often solves automatically on
 * load. If the token then lapses while the user is still filling the form, the
 * widget must recover — otherwise the form is stuck on "please complete the
 * verification challenge" even though the widget visibly solved. So:
 *   - expired-callback: clear the token AND reset the widget so a fresh token
 *     arrives automatically (Cloudflare's recommended handling), instead of
 *     stranding the user as "unverified".
 *   - error-callback: clear the token and surface a clear message via `onError`
 *     so the failure is visible rather than looking like a silent no-op.
 * Callbacks are held in refs so the widget initializes exactly once per site
 * key and its long-lived Turnstile callbacks never capture stale state.
 *
 * Missing-site-key behavior is environment-aware:
 *   - Local dev (`next dev`, NODE_ENV !== 'production'): renders nothing and
 *     supplies a dev sentinel token so the form isn't blocked before Cloudflare
 *     is wired.
 *   - Production builds (incl. Netlify deploy previews): a missing site key is a
 *     real misconfiguration — render a clear config error, report it via
 *     `onError`, and keep the token empty so submission stays blocked.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: (errorCode?: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const CONFIG_ERROR_MESSAGE =
  'Verification is temporarily unavailable due to a configuration issue on our end. ' +
  'Please try again shortly.';

const CHALLENGE_ERROR_MESSAGE =
  'Verification couldn’t load. Reload the page — and if it keeps happening, turn off any ' +
  'ad or privacy blocker for this site, or try another browser.';

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

  // Hold the latest callbacks in refs so the render effect can run exactly once
  // per site key. The Turnstile widget outlives many parent re-renders; reading
  // callbacks through refs keeps them current without re-initializing the widget
  // and without capturing a stale `onToken`.
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

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
        onTokenRef.current('');
        onErrorRef.current?.(CONFIG_ERROR_MESSAGE);
        return;
      }
      // Local dev only: unblock the form with a sentinel token.
      onTokenRef.current('dev-no-turnstile');
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function renderWidget() {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => {
          // Token lapsed before submit — drop it and re-run the challenge so a
          // fresh token arrives automatically. Do NOT leave the form stuck.
          onTokenRef.current('');
          if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        },
        'error-callback': (errorCode?: string) => {
          // Make the failure visible (with Cloudflare's error code) and let the
          // user retry. Don't auto-reset here — a persistent error (e.g. blocked
          // network or a hostname not on the widget's allowlist) would loop.
          onTokenRef.current('');
          const host = typeof window !== 'undefined' ? window.location.hostname : '';
          // eslint-disable-next-line no-console
          console.error('[Turnstile] challenge error-callback', {
            errorCode: errorCode ?? '(no code)',
            hostname: host,
            sitekey: siteKey,
          });
          // 110200 = this hostname isn't on the widget's allowlist. Surface the
          // exact host so it can be copied straight into the Cloudflare Turnstile
          // domain list (Netlify mints a new deploy-preview-N host per PR).
          const message =
            errorCode === '110200'
              ? `This page’s domain “${host}” isn’t on the verification widget’s allowlist. ` +
                `Add it in Cloudflare Turnstile, or use the production URL. (error 110200)`
              : errorCode
                ? `${CHALLENGE_ERROR_MESSAGE} (error ${errorCode})`
                : CHALLENGE_ERROR_MESSAGE;
          onErrorRef.current?.(message);
        },
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
      // Blocked script (ad/privacy blocker, offline) must surface a real
      // message instead of leaving a blank widget the form then points at.
      script.onerror = () => {
        if (!cancelled) onErrorRef.current?.(CHALLENGE_ERROR_MESSAGE);
      };
      document.head.appendChild(script);
    } else {
      // Script tag exists but not ready yet — poll briefly for the global,
      // and give up loudly rather than spinning forever.
      let waited = 0;
      pollTimer = setInterval(() => {
        if (window.turnstile) {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          renderWidget();
        } else if ((waited += 200) >= 10_000) {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          if (!cancelled) onErrorRef.current?.(CHALLENGE_ERROR_MESSAGE);
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      // Tear down the widget on unmount so navigating away and back (e.g. the
      // apply form's step 1 → 2 → back) never strands a dead iframe or a token
      // tied to a widget that no longer exists.
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  if (misconfigured) {
    return (
      <div
        role="alert"
        className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
      >
        {CONFIG_ERROR_MESSAGE}
      </div>
    );
  }

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" aria-label="Verification challenge" />;
}

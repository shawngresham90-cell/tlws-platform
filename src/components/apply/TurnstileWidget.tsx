'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget. Renders the challenge and hands the resulting
 * token back via `onToken`. Progressive: if no site key is configured (local /
 * preview before Cloudflare is wired), it renders nothing and immediately
 * supplies a dev sentinel token — the server's verifyTurnstile() skips
 * verification when its secret is unset, so the flow still works, while
 * production (keys present) enforces a real challenge.
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

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    // No site key → dev/preview mode: unblock the form with a sentinel token.
    if (!siteKey) {
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
  }, [siteKey, onToken]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" aria-label="Verification challenge" />;
}

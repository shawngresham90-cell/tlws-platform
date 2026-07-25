'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';

/**
 * Route-segment error boundary. Without one, an uncaught render error anywhere
 * under the root layout shows Next's unstyled fallback ("Application error: a
 * client-side exception has occurred") with no way back into the site.
 *
 * The digest is the only thing shown — never the raw message, which can carry
 * internals. `reset()` re-renders the failed segment so a transient failure
 * (a dropped fetch, a cold database) recovers without a full reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side digest only; the message may contain internals.
    trackEvent('app_error', { digest: error.digest ?? 'none' });
  }, [error]);

  return (
    <Section>
      <div className="max-w-2xl">
        <Eyebrow>Something broke</Eyebrow>
        <h1 className="font-display text-section uppercase text-ink">
          We hit a pothole loading this page
        </h1>
        <p className="mt-4 text-lg text-muted">
          This one is on us, not on you. Try again — most of these clear on a second attempt. If it
          keeps happening, the links below still work.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button onClick={() => reset()}>Try again</Button>
          <Button href="/" variant="secondary">
            Back to the home page
          </Button>
        </div>
        <p className="mt-8 text-sm text-muted">
          Looking for something specific? Try the{' '}
          <Link href="/knowledge" className="text-signal underline-offset-4 hover:underline">
            Knowledge Center
          </Link>
          ,{' '}
          <Link href="/practice-tests" className="text-signal underline-offset-4 hover:underline">
            Practice Tests
          </Link>
          , or the{' '}
          <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
            Directory
          </Link>
          .
        </p>
        {error.digest ? <p className="mt-6 text-xs text-muted">Reference: {error.digest}</p> : null}
      </div>
    </Section>
  );
}

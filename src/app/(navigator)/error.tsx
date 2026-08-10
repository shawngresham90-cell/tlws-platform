'use client';

import { resolveBuildId } from '@/lib/navigator/build-id';

/**
 * The error boundary for every Navigator surface.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE SITE'S
 *
 * Without it, a render failure on the driving screen falls through to the
 * root boundary — which is written for a visitor reading an article. It
 * apologises for a "pothole loading this page", suggests trying again
 * because "most of these clear on a second attempt", and offers links to
 * the Knowledge Center, the Practice Tests and the Directory.
 *
 * That is the wrong screen for someone in a moving truck whose navigation
 * just stopped. It does not say navigation has stopped. It does not say
 * the route is gone. It does not show the build id, which is the one
 * thing a pilot report cannot be filed without. And it invites a driver
 * to browse practice tests.
 *
 * WHAT THIS ONE PROMISES
 *
 *   It never claims the route survived.  A reset re-mounts the driving
 *   screen with no route and no destination, and the copy says so
 *   plainly. A boundary that offered "Try again" while implying the trip
 *   continued would be the single most dangerous screen in the app.
 *
 *   It never fabricates guidance.  No route, no maneuver, no "continue
 *   on your current road" — this component knows nothing about where the
 *   truck is and does not pretend otherwise.
 *
 *   It never shows the raw error.  Only Next's digest, which is an
 *   opaque server-side identifier. An error message can carry internals,
 *   a URL, or a provider payload; the digest cannot.
 *
 *   It reports no telemetry.  The root boundary fires an analytics event.
 *   Navigator's posture is that a driving session emits nothing to a
 *   third party, and a crash is not the moment to make an exception. The
 *   digest is rendered for the driver to copy into a report instead.
 *
 *   It keeps the build id reachable.  Same three build variables as the
 *   pilot strip, through the same whitelist, so the identifier here and
 *   the one on the driving screen can never disagree.
 *
 * Styling is inline rather than Tailwind for the same reason the global
 * boundary does it: this must render even when something upstream is
 * broken. Contrast and target sizes are deliberate — this may be read at
 * arm's length, in daylight, by someone who should be looking at the road.
 */

const buildId = resolveBuildId({
  commitRef: process.env.NEXT_PUBLIC_BUILD_COMMIT,
  context: process.env.NEXT_PUBLIC_BUILD_CONTEXT,
  builtAtIso: process.env.NEXT_PUBLIC_BUILD_TIME,
});

const PAGE: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#141414',
  color: '#F2F0EB',
  padding: '1.5rem',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
};

const ACTION: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '64px',
  padding: '0 1.75rem',
  borderRadius: '10px',
  fontSize: '1.125rem',
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
  border: 0,
};

export default function NavigatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={PAGE}>
      <div style={{ maxWidth: '34rem', margin: '0 auto' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#F5A623',
            fontWeight: 700,
          }}
        >
          Navigator stopped
        </p>

        <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', lineHeight: 1.15 }}>
          Navigation has stopped. You are not being guided.
        </h1>

        <p style={{ margin: '1rem 0 0', fontSize: '1.125rem', lineHeight: 1.5 }}>
          Drive on your own knowledge or another device. When you are somewhere safe and stopped,
          you can start a new session below.
        </p>

        {/*
          The honest part. A reset re-mounts the screen from scratch: the
          route, the destination and the name are all gone. Saying "try
          again" without saying that would let a driver believe the trip
          resumed where it left off.
        */}
        <p
          style={{
            margin: '1.5rem 0 0',
            padding: '1rem',
            border: '1px solid #F5A623',
            borderRadius: '10px',
            fontSize: '1rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Your route is gone.</strong> Starting again gives you a fresh session — you will
          need to set the destination again. Nothing was saved, and nothing about the trip was sent
          anywhere.
        </p>

        <div style={{ marginTop: '1.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{ ...ACTION, backgroundColor: '#F5A623', color: '#141414' }}
          >
            Start a new session
          </button>
          <a href="/drive" style={{ ...ACTION, border: '1px solid #2A2A2E', color: '#F2F0EB' }}>
            Reload the driving screen
          </a>
        </div>

        <div
          style={{
            marginTop: '2.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #2A2A2E',
            fontSize: '0.875rem',
            color: '#A3A39B',
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#F2F0EB' }}>Please report this</p>
          <p style={{ margin: '0.5rem 0 0' }}>
            Send these two lines with a note about what you were doing when it stopped.
          </p>
          <p
            style={{ margin: '0.75rem 0 0', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          >
            build: {buildId.label}
            <br />
            reference: {error.digest ?? 'none'}
          </p>
        </div>
      </div>
    </div>
  );
}

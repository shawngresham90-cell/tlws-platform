'use client';

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, where
 * `error.tsx` cannot help because the layout (and therefore Header/Footer and
 * the stylesheet) never rendered. It must ship its own <html>/<body>, so the
 * styling here is inline rather than Tailwind — the CSS may not exist yet.
 *
 * Colors are the design-system tokens by value: asphalt #141414 page,
 * ink #F2F0EB text, signal #F5A623 action.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#141414',
          color: '#F2F0EB',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '36rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#F5A623',
            }}
          >
            Trucking Life
          </p>
          <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.75rem', lineHeight: 1.2 }}>
            The site hit an unexpected error
          </h1>
          <p style={{ margin: '1rem 0 0', color: '#A3A39B', lineHeight: 1.6 }}>
            This one is on us. Reload the page — if it keeps happening, come back in a few minutes.
          </p>
          <div style={{ marginTop: '1.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => reset()}
              style={{
                cursor: 'pointer',
                border: 0,
                borderRadius: '8px',
                backgroundColor: '#F5A623',
                color: '#141414',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: '8px',
                border: '1px solid #2A2A2E',
                color: '#F2F0EB',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                textDecoration: 'none',
              }}
            >
              Back to the home page
            </a>
          </div>
          {error.digest ? (
            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#A3A39B' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

'use client';

import { useState } from 'react';

/**
 * ⚠ TEMPORARY — PR #275 PHONE TEST ONLY. DELETE BEFORE MERGE. ⚠
 *
 * Throws an intentional render error — but only after a deliberate tap on
 * the button below, never on page load. The throw happens during a client
 * render inside the (navigator) route group, which is exactly the failure
 * mode the boundary exists for: a driving-screen component crashing while
 * it renders. The nearest boundary above this segment is
 * `src/app/(navigator)/error.tsx`, so the screen that appears after the
 * tap IS the screen under test.
 *
 * A client-side render error carries no Next digest, so the boundary's
 * reference line is expected to read `reference: none` in this test.
 */

const PAGE: React.CSSProperties = {
  minHeight: '60vh',
  padding: '1.5rem',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
};

export function CrashTestTrigger() {
  const [armed, setArmed] = useState(false);

  if (armed) {
    throw new Error('Intentional test crash: PR #275 Navigator crash-boundary phone test');
  }

  return (
    <div style={PAGE}>
      <div style={{ maxWidth: '34rem', margin: '0 auto' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#B45309',
            fontWeight: 700,
          }}
        >
          Temporary test page — PR #275
        </p>

        <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', lineHeight: 1.2 }}>
          Crash-boundary test
        </h1>

        <p style={{ margin: '1rem 0 0', fontSize: '1rem', lineHeight: 1.6 }}>
          The button below throws an intentional render error on the Navigator surface. The screen
          that replaces this page is the new crash boundary under review. Nothing is saved and
          nothing is sent anywhere; this page is removed before the change merges.
        </p>

        <p style={{ margin: '0.75rem 0 0', fontSize: '1rem', lineHeight: 1.6 }}>
          Use this only while parked. It is safe to tap — the crash is the point.
        </p>

        <button
          type="button"
          onClick={() => setArmed(true)}
          style={{
            marginTop: '1.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '64px',
            padding: '0 1.75rem',
            borderRadius: '10px',
            fontSize: '1.125rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 0,
            backgroundColor: '#B45309',
            color: '#FFFFFF',
          }}
        >
          Crash the Navigator screen now
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Client shell for the header's <details> menu. The menu itself is
 * server-rendered children; this wrapper adds the two behaviors native
 * <details> lacks in an App Router layout that persists across navigations:
 * close on route change, and close on Escape (returning focus to the
 * trigger). No other JavaScript — the menu still works with JS disabled.
 */
export function HeaderMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  // Close when the route changes — an open overlay must never follow the
  // user to the next page.
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <details ref={ref} className="relative">
      {children}
    </details>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Client shell for the header's zero-JS <details> mobile menu. The native
 * disclosure stays fully functional without JavaScript; this wrapper only
 * adds two progressive enhancements the pure-CSS version can't:
 *   - close the panel after a client-side navigation (App Router keeps the
 *     header mounted, so the open panel used to overlay the new page)
 *   - close on Escape, returning focus to the toggle
 */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.removeAttribute('open');
  }, [pathname]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape' && ref.current?.open) {
        ref.current.removeAttribute('open');
        ref.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <details ref={ref} className="relative xl:hidden">
      {children}
    </details>
  );
}

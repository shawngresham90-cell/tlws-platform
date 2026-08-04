import type { ReactNode } from 'react';

/**
 * Route-group shell for Navigator surfaces (architecture package milestone
 * N0). Deliberately minimal: the root layout already provides site chrome,
 * and the (navigator) group exists so later milestones have one place to
 * mount navigation-scoped providers without touching any other route group.
 */
export default function NavigatorLayout({ children }: { children: ReactNode }) {
  return children;
}

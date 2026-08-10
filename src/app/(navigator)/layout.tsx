import type { ReactNode } from 'react';
import './navigator-design.css';

/**
 * Route-group shell for Navigator surfaces (architecture package milestone
 * N0). Deliberately minimal: the root layout already provides site chrome,
 * and the (navigator) group exists so later milestones have one place to
 * mount navigation-scoped providers without touching any other route group.
 *
 * The design-token sheet loads here — one place, every Navigator surface —
 * so the blueprint tokens exist wherever a Navigator component renders and
 * nowhere else on the site pays for them.
 */
export default function NavigatorLayout({ children }: { children: ReactNode }) {
  return children;
}

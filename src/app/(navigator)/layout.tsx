import type { ReactNode } from 'react';
import './navigator-design.css';
import { DisplayModeProvider } from '@/components/navigator/DisplayModeProvider';

/**
 * Route-group shell for Navigator surfaces (architecture package milestone
 * N0). Deliberately minimal: the root layout already provides site chrome,
 * and the (navigator) group exists so later milestones have one place to
 * mount navigation-scoped providers without touching any other route group.
 *
 * The design-token sheet loads here — one place, every Navigator surface —
 * so the blueprint tokens exist wherever a Navigator component renders and
 * nowhere else on the site pays for them.
 *
 * The display-mode provider (NAV-ENTRY-1) mounts here for the same reason,
 * and for one more: a layout survives navigation between the launcher, the
 * driving screen and Settings, so the driver's palette is decided ONCE per
 * Navigator session by ONE `matchMedia` subscription. Mounted per page it
 * would tear that listener down and rebuild it on every tap.
 */
export default function NavigatorLayout({ children }: { children: ReactNode }) {
  return <DisplayModeProvider>{children}</DisplayModeProvider>;
}

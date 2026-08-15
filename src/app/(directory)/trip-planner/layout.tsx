import '../../(navigator)/navigator-design.css';

/**
 * Plan My Day and the classic planner share the Navigator's design tokens.
 *
 * WHY THIS FILE EXISTS. `navigator-design.css` defines `--nav-bg`,
 * `--nav-surface`, `--nav-good` and the rest on `:root`, and it was
 * imported by the `(navigator)` layout ONLY. Plan My Day lives in the
 * `(directory)` group, so every one of those variables resolved to
 * nothing on `/trip-planner` — and Tailwind classes like `bg-nav-good`
 * compile to `background-color: var(--nav-good)`, which with no value is
 * simply transparent.
 *
 * The measured result was not subtle: the primary "Plan My Day" button
 * rendered `rgb(20,20,20)` text on a `rgb(20,20,20)` page with no fill —
 * black on black — and every selected chip (buffer, units, search
 * country) lost the only thing that marked it as chosen. The screen was
 * fully functional and almost unreadable, which is the worst combination
 * for a bench to miss: nothing throws, every assertion about text and
 * size passes, and a driver cannot find the button.
 *
 * IMPORTING THE SAME FILE, rather than copying its token block, is the
 * point. A second copy would drift the first time the palette moved, and
 * the Navigator's night palette is a safety decision (colour = meaning,
 * never decoration) that must not fork. The rest of that stylesheet is
 * inert here: `.nav-imminent` and `.nav-map` are scoped classes these
 * screens never use, and the reduced-motion block is worth having.
 */
export default function TripPlannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

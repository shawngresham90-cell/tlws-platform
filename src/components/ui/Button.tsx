import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'tertiary';

const base =
  'inline-flex items-center justify-center font-display uppercase tracking-wide rounded-card ' +
  'px-6 py-3 text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt';

/**
 * CTA hierarchy (blueprint §2.8): primary = the money action, amber solid,
 * one per screen. Secondary = the learn-more action, reflective-white
 * outline. Ghost = quiet outlined utility action. Tertiary = amber text link
 * (kept ≥48px tall for glove-thumb tap targets).
 */
const variants: Record<Variant, string> = {
  primary: 'bg-signal text-asphalt hover:bg-signal-600',
  secondary: 'border border-ink/60 text-ink hover:border-signal hover:text-signal',
  ghost: 'border border-line text-ink hover:border-signal hover:text-signal',
  tertiary:
    'px-2 font-body normal-case font-semibold text-signal underline-offset-4 hover:underline',
};

type Props = {
  variant?: Variant;
  href?: string;
  /** Off-site destination: renders a plain anchor, new tab, safe rel. */
  external?: boolean;
  /** Extra rel tokens for external links (e.g. "sponsored"); noopener is always added. */
  rel?: string;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/** Primary conversion primitive. A control says what happens: "Apply now," not "Submit." */
export function Button({
  variant = 'primary',
  href,
  external,
  rel,
  className,
  children,
  ...rest
}: Props) {
  const classes = cn(base, variants[variant], className);
  if (href && external) {
    return (
      // Custom rel intentionally omits noreferrer (affiliate links need the
      // referrer for attribution); noopener is always enforced.
      <a
        href={href}
        target="_blank"
        rel={rel ? `${rel} noopener` : 'noopener noreferrer'}
        className={classes}
      >
        {children}
        <span className="sr-only"> (opens in new tab)</span>
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}

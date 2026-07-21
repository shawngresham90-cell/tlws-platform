import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost';

const base =
  'inline-flex items-center justify-center font-display uppercase tracking-wide rounded-card ' +
  'px-6 py-3 text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt';

const variants: Record<Variant, string> = {
  primary: 'bg-signal text-asphalt hover:bg-signal-600',
  secondary: 'bg-diesel text-ink hover:bg-diesel-700',
  ghost: 'border border-line text-ink hover:border-signal hover:text-signal',
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
      <a
        href={href}
        target="_blank"
        rel={rel ? `${rel} noopener` : 'noopener noreferrer'}
        className={classes}
      >
        {children}
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

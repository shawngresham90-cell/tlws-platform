/**
 * Factual trust signals only — every line is verifiable (Stan Store handles
 * checkout; Shawn's 17-year/zero-violation record is published site-wide; the
 * course is phone-friendly; wall spots are hand-verified). No invented
 * reviews, ratings, or promises — house rule.
 */
const BADGES = [
  { icon: '🔒', label: 'Secure checkout — powered by Stan Store' },
  { icon: '🚛', label: 'Created by a veteran truck driver — 17 years, zero violations' },
  { icon: '🎓', label: 'Built by a working CDL instructor' },
  { icon: '📱', label: 'Mobile friendly — study from anywhere' },
] as const;

export function TrustBadges({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-6 gap-y-2 ${className}`}>
      {BADGES.map((b) => (
        <li key={b.label} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span aria-hidden="true">{b.icon}</span>
          {b.label}
        </li>
      ))}
    </ul>
  );
}

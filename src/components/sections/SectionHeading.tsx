import { Eyebrow } from '@/components/ui';

/** Shared section header so every block reads with the same rhythm. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      {/* Editorial tick — ink hairline, never amber (amber = money/action) */}
      <div aria-hidden="true" className="mb-4 h-0.5 w-10 bg-ink/30" />
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="display-section">{title}</h2>
      {intro && <p className="mt-4 text-muted">{intro}</p>}
    </div>
  );
}

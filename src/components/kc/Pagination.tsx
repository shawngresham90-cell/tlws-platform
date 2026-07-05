import Link from 'next/link';

/** Numbered pagination for category landings. SEO-friendly (real links). */
export function Pagination({
  basePath,
  page,
  total,
  pageSize,
}: {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1);
  const href = (p: number) => (p === 1 ? basePath : `${basePath}?page=${p}`);

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={href(page - 1)}
          className="rounded-card border border-line px-3 py-2 text-sm text-muted hover:border-signal hover:text-signal"
        >
          ← Prev
        </Link>
      )}
      {nums.map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`rounded-card border px-3 py-2 text-sm ${n === page ? 'border-signal bg-signal text-asphalt' : 'border-line text-muted hover:border-signal hover:text-signal'}`}
        >
          {n}
        </Link>
      ))}
      {page < pages && (
        <Link
          href={href(page + 1)}
          className="rounded-card border border-line px-3 py-2 text-sm text-muted hover:border-signal hover:text-signal"
        >
          Next →
        </Link>
      )}
    </nav>
  );
}

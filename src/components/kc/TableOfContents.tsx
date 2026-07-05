import type { TocItem } from '@/lib/kc/mdx';

/** In-article table of contents. Anchor links to heading IDs. */
export function TableOfContents({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null; // not worth a TOC for one heading
  return (
    <nav
      aria-label="Table of contents"
      className="rounded-card border border-line bg-asphalt-800 p-5"
    >
      <p className="eyebrow mb-3">On this page</p>
      <ol className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
            <a href={`#${item.id}`} className="text-sm text-muted hover:text-signal">
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

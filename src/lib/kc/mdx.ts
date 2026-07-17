/**
 * Lightweight markdown renderer for article bodies. Deliberately dependency-free
 * and server-only: handles headings (with slug anchors for the TOC), paragraphs,
 * bold, links, and lists. For richer MDX later, swap in next-mdx-remote — the
 * TOC extraction + component API stay the same.
 */
export type TocItem = { id: string; text: string; level: 2 | 3 };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, href) => {
    // External links open in a new tab; root-relative links stay same-tab
    // internal navigation (the internal-linking backbone between articles).
    // A leading double slash would be protocol-relative (external in
    // disguise), so it is rejected; escapeHtml already ran, so test the
    // pre-escape form of & when checking query strings.
    const isExternal = /^https?:\/\//.test(href);
    const isInternal = /^\/(?!\/)[\w\-/#?=&.]*$/.test(href.replace(/&amp;/g, '&'));
    const safe = isExternal || isInternal ? href : '#';
    const ext = isExternal ? ' rel="noopener" target="_blank"' : '';
    return `<a class="text-signal underline hover:no-underline"${ext} href="${safe}">${t}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return out;
}

export function renderMarkdown(md: string): { html: string; toc: TocItem[] } {
  const lines = md.split('\n');
  const toc: TocItem[] = [];
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      closeList();
      const level = (h[1].length === 2 ? 2 : 3) as 2 | 3;
      const text = h[2];
      const id = slugify(text);
      toc.push({ id, text, level });
      const cls =
        level === 2
          ? 'display-section text-2xl mt-10 mb-4'
          : 'font-display text-xl uppercase text-ink mt-8 mb-3';
      html.push(`<h${level} id="${id}" class="${cls}">${inline(text)}</h${level}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html.push('<ul class="my-4 list-disc space-y-2 pl-6 text-muted">');
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    closeList();
    if (line.trim() === '') continue;
    html.push(`<p class="my-4 leading-relaxed text-muted">${inline(line)}</p>`);
  }
  closeList();
  return { html: html.join('\n'), toc };
}

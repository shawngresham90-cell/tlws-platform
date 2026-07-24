import { NextResponse } from 'next/server';
import { resolveGoLink } from '@/lib/go-links';

/**
 * /go/<slug> — tracked short links for YouTube descriptions. 302 (temporary)
 * so destinations can be re-pointed without stale browser caches; unknown or
 * malformed slugs land on the homepage rather than a 404 a viewer typed from
 * a video. Internal, allowlisted destinations only (see resolveGoLink).
 */
export function GET(request: Request, { params }: { params: { slug: string } }) {
  const raw = typeof params.slug === 'string' ? params.slug : '';
  // Decode a single layer defensively; a malformed escape sequence just
  // misses the allowlist and falls back to the homepage.
  let slug = raw;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    slug = raw;
  }
  const target = resolveGoLink(slug.toLowerCase());
  return NextResponse.redirect(new URL(target ?? '/', request.url), 302);
}

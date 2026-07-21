import { NextResponse } from 'next/server';
import { resolveGoLink } from '@/lib/go-links';

/**
 * /go/<slug> — tracked short links for YouTube descriptions. 302 (temporary)
 * so destinations can be re-pointed without stale browser caches; unknown
 * slugs land on the homepage rather than a 404 a viewer typed from a video.
 */
export function GET(request: Request, { params }: { params: { slug: string } }) {
  const target = resolveGoLink(params.slug.toLowerCase());
  return NextResponse.redirect(new URL(target ?? '/', request.url), 302);
}

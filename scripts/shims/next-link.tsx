import type { ReactNode } from 'react';

/**
 * Test-only shim for `next/link`. Renders a plain anchor with the same href, so
 * a client component can be server-rendered outside a Next request. Aliased in
 * via esbuild:  --alias:next/link=./scripts/shims/next-link.tsx
 */
export default function Link({
  href,
  children,
  ...rest
}: { href: string; children?: ReactNode } & Record<string, unknown>) {
  return (
    <a href={href} {...(rest as object)}>
      {children}
    </a>
  );
}

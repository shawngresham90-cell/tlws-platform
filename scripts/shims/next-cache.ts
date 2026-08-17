/**
 * next/cache shim for offline harnesses.
 *
 * Server-action modules import { revalidatePath } from 'next/cache' at module
 * scope, so any harness that imports a page whose route also defines actions
 * pulls Next's server tracer (and its optional @opentelemetry/api require)
 * into the bundle. Harnesses never execute a revalidation — outside a running
 * Next server it has nothing to act on — so the calls become no-ops, exactly
 * like the empty cookie jar in next-headers.ts.
 */
export function revalidatePath(): void {}
export function revalidateTag(): void {}

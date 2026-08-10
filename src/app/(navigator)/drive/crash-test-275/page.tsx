import { notFound } from 'next/navigation';
import { buildChannel } from '@/lib/navigator/build-id';
import { buildMetadata } from '@/lib/seo/metadata';
import { requirePilotAccess } from '@/lib/navigator-api/pilot-session';
import { CrashTestTrigger } from './CrashTestTrigger';

/**
 * ⚠ TEMPORARY — PR #275 PHONE TEST ONLY. DELETE BEFORE MERGE. ⚠
 *
 * This route exists so the owner can trigger the Navigator crash boundary
 * (`src/app/(navigator)/error.tsx`) once, on a phone, from this PR's deploy
 * preview — the boundary is a real UI change on the Navigator surface and
 * should be seen at arm's length before it merges.
 *
 * Why it cannot fire during ordinary navigation, and cannot reach anyone:
 *
 *   1. Nothing links here. The only way in is typing this exact URL.
 *   2. Landing on the page does nothing. The crash requires a deliberate
 *      tap on a clearly labelled button (see CrashTestTrigger).
 *   3. It refuses production builds: on a `production` deploy context the
 *      route is a 404, same whitelist mapping the pilot strip uses.
 *   4. Same two gates as /drive, in the same order: the build-time flag
 *      decides whether the route exists, the pilot password decides who
 *      may see it. The middleware covers /drive/* a step earlier.
 *   5. This file lives only on the PR #275 branch and is removed before
 *      the branch becomes merge-ready. It never enters main's history.
 */

export const dynamic = 'force-dynamic';

const ENABLED = process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';

export const metadata = buildMetadata({
  title: 'Crash-boundary test (temporary) | Trucking Life with Shawn',
  description: 'Temporary pilot-only page for testing the Navigator crash boundary.',
  path: '/drive/crash-test-275',
  noindex: true,
});

export default async function CrashTestPage() {
  if (!ENABLED) notFound();
  if (buildChannel(process.env.NEXT_PUBLIC_BUILD_CONTEXT) === 'production') notFound();
  await requirePilotAccess('/drive/crash-test-275');
  return <CrashTestTrigger />;
}

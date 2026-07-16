import { Container, Eyebrow } from '@/components/ui';
import { SavedBrowser } from '@/components/test/SavedBrowser';
import { getPublishedBanks } from '@/lib/tests/queries';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Bookmarked questions (Milestone 4). Deliberately NOINDEX: the content is
 * personalized (device-local localStorage) and thin from a crawler's view.
 * Every published bank is fetched server-side (shared getPublishedBanks) so
 * the client island can prune saved ids against live questions and start
 * drills with zero extra requests.
 */
export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Your bookmarked questions — CDL Practice Tests',
  path: '/practice-tests/bookmarks',
  noindex: true,
});

export default async function BookmarksPage() {
  const banks = await getPublishedBanks();

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-3xl">
        <Eyebrow>Practice Tests</Eyebrow>
        <h1 className="font-display text-3xl uppercase text-ink sm:text-4xl">
          Your bookmarked questions
        </h1>
        <p className="mt-4 text-muted">
          Questions you saved for later, grouped by test. Bookmarks live on this device — no
          account, no sign-in.
        </p>
        <div className="mt-8">
          <SavedBrowser
            kind="bookmarks"
            banks={banks}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
          />
        </div>
      </Container>
    </div>
  );
}

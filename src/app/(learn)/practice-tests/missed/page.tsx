import { Container, Eyebrow } from '@/components/ui';
import { SavedBrowser } from '@/components/test/SavedBrowser';
import { getPublishedBanks } from '@/lib/tests/queries';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Missed-question drilling (Milestone 4). Deliberately NOINDEX: personalized,
 * device-local content. Same server-side bank fetch as the bookmarks page
 * (shared getPublishedBanks) — the client island prunes miss history against
 * live questions and runs drills through the existing Study runner.
 */
export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Your missed questions — CDL Practice Tests',
  path: '/practice-tests/missed',
  noindex: true,
});

export default async function MissedQuestionsPage() {
  const banks = await getPublishedBanks();

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-3xl">
        <Eyebrow>Practice Tests</Eyebrow>
        <h1 className="font-display text-3xl uppercase text-ink sm:text-4xl">
          Your missed questions
        </h1>
        <p className="mt-4 text-muted">
          Every question you have answered wrong in Study Mode or a Timed Test, grouped by test and
          ordered by how often you miss it. History lives on this device — no account, no sign-in.
        </p>
        <div className="mt-8">
          <SavedBrowser
            kind="misses"
            banks={banks}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
          />
        </div>
      </Container>
    </div>
  );
}

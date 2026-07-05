import { Container, Section, Eyebrow } from '@/components/ui';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import { ArticleCard } from '@/components/kc/ArticleCard';
import { SearchBox } from '@/components/kc/SearchBox';
import { getCategories, searchArticles } from '@/lib/kc/queries';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic'; // results depend on the query string

export function generateMetadata({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  return buildMetadata({
    title: q ? `Search: ${q} — Knowledge Center` : 'Search — Knowledge Center',
    description: 'Search trucking, DOT, and CDL guides in the Trucking Life Knowledge Center.',
    path: '/knowledge/search',
    noindex: true, // search result pages shouldn't be indexed
  });
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();
  const [results, categories] = await Promise.all([searchArticles(q), getCategories()]);
  const slugById = Object.fromEntries(categories.map((c) => [c.id, c.slug]));

  return (
    <>
      <div className="border-b border-line bg-asphalt py-14 sm:py-16">
        <Container>
          <Breadcrumbs
            crumbs={[
              { name: 'Home', href: '/' },
              { name: 'Knowledge Center', href: '/knowledge' },
              { name: 'Search' },
            ]}
          />
          <Eyebrow>Search</Eyebrow>
          <h1 className="display-hero text-4xl sm:text-5xl">
            {q ? <>Results for &ldquo;{q}&rdquo;</> : 'Search the Knowledge Center'}
          </h1>
          <div className="mt-8">
            <SearchBox defaultValue={q} />
          </div>
        </Container>
      </div>

      <Section>
        {!q ? (
          <p className="text-muted">Type a search above to find guides.</p>
        ) : results.length === 0 ? (
          <p className="text-muted">
            No matches for &ldquo;{q}&rdquo;. Try a broader term like &ldquo;DOT&rdquo; or
            &ldquo;hours of service.&rdquo;
          </p>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              {results.length} result{results.length === 1 ? '' : 's'}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((a) => (
                <ArticleCard key={a.id} article={a} categorySlug={slugById[a.category_id] ?? ''} />
              ))}
            </div>
          </>
        )}
      </Section>
    </>
  );
}

import { createClient } from '@/lib/supabase/server';
import { createStaticClient } from '@/lib/supabase/static';
import { PAGE_SIZE, type KcArticle, type KcArticleCard, type KcCategory } from './types';

const CAT_COLS =
  'id, slug, name, description, intro_md, icon, sort_order, meta_title, meta_description';
const ART_CARD_COLS = 'id, slug, title, excerpt, category_id, reading_time_min, published_at';
const ART_FULL_COLS =
  'id, slug, category_id, title, excerpt, body_mdx, meta_title, meta_description, hero_image_url, author_name, author_bio, sources, faqs, tags, reading_time_min, featured, reg_verified, reg_verified_date, published_at, updated_at';

/** All active categories, ordered. */
export async function getCategories(): Promise<KcCategory[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('kc_categories')
    .select(CAT_COLS)
    .order('sort_order', { ascending: true });
  return (data as KcCategory[]) ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<KcCategory | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('kc_categories')
    .select(CAT_COLS)
    .eq('slug', slug)
    .maybeSingle();
  return (data as KcCategory) ?? null;
}

/** Featured articles for the KC homepage. */
export async function getFeaturedArticles(limit = 3): Promise<KcArticleCard[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('kc_articles')
    .select(ART_CARD_COLS)
    .eq('featured', true)
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data as KcArticleCard[]) ?? [];
}

/** Latest articles across all categories. */
export async function getLatestArticles(limit = 6): Promise<KcArticleCard[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('kc_articles')
    .select(ART_CARD_COLS)
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data as KcArticleCard[]) ?? [];
}

/** Paginated articles in a category. Returns rows + total for pagination. */
export async function getCategoryArticles(
  categoryId: string,
  page = 1,
): Promise<{ articles: KcArticleCard[]; total: number }> {
  const supabase = createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await supabase
    .from('kc_articles')
    .select(ART_CARD_COLS, { count: 'exact' })
    .eq('category_id', categoryId)
    .order('published_at', { ascending: false })
    .range(from, to);
  return { articles: (data as KcArticleCard[]) ?? [], total: count ?? 0 };
}

export async function getArticle(categorySlug: string, slug: string): Promise<KcArticle | null> {
  const supabase = createClient();
  const cat = await getCategoryBySlug(categorySlug);
  if (!cat) return null;
  const { data } = await supabase
    .from('kc_articles')
    .select(ART_FULL_COLS)
    .eq('category_id', cat.id)
    .eq('slug', slug)
    .maybeSingle();
  return (data as KcArticle) ?? null;
}

/**
 * Related articles: manual curation first (kc_related), then auto-fill by shared
 * tags from the same category, so an article always has "related" even with no
 * manual links — critical for internal linking at scale.
 */
export async function getRelated(article: KcArticle, limit = 3): Promise<KcArticleCard[]> {
  const supabase = createClient();

  const { data: manual } = await supabase
    .from('kc_related')
    .select('related_id, sort_order, kc_articles!kc_related_related_id_fkey(' + ART_CARD_COLS + ')')
    .eq('article_id', article.id)
    .order('sort_order', { ascending: true })
    .limit(limit);

  const manualCards = (manual
    ?.map((r) => (r as unknown as { kc_articles: KcArticleCard }).kc_articles)
    .filter(Boolean) ?? []) as KcArticleCard[];

  if (manualCards.length >= limit) return manualCards.slice(0, limit);

  // Auto-fill by shared tags in the same category, excluding self + already-picked.
  const excludeIds = [article.id, ...manualCards.map((c) => c.id)];
  const { data: auto } = await supabase
    .from('kc_articles')
    .select(ART_CARD_COLS)
    .eq('category_id', article.category_id)
    .overlaps('tags', article.tags.length ? article.tags : ['__none__'])
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .order('published_at', { ascending: false })
    .limit(limit - manualCards.length);

  return [...manualCards, ...((auto as KcArticleCard[]) ?? [])].slice(0, limit);
}

/** Ranked full-text search via the kc_search RPC. */
export async function searchArticles(q: string): Promise<KcArticleCard[]> {
  if (!q.trim()) return [];
  const supabase = createClient();
  const { data } = await supabase.rpc('kc_search', { q, max_results: 20 });
  return (data as KcArticleCard[]) ?? [];
}

/** All published article slugs — for sitemap + static params generation. */
export async function getAllArticleRefs(): Promise<{ category: string; slug: string }[]> {
  // Resilient: if the DB is unreachable at build time, return [] so the build
  // still succeeds (pages render on demand). Netlify has DB access at build.
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('kc_articles')
      .select('slug, kc_categories!inner(slug)')
      .order('published_at', { ascending: false });
    return (
      (data?.map((r) => ({
        slug: (r as { slug: string }).slug,
        category: (r as unknown as { kc_categories: { slug: string } }).kc_categories.slug,
      })) as { category: string; slug: string }[]) ?? []
    );
  } catch {
    return [];
  }
}

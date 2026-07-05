export type KcCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  intro_md: string | null;
  icon: string | null;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
};

export type KcSource = { label: string; url: string };
export type KcFaq = { q: string; a: string };

export type KcArticle = {
  id: string;
  slug: string;
  category_id: string;
  title: string;
  excerpt: string | null;
  body_mdx: string | null;
  meta_title: string | null;
  meta_description: string | null;
  hero_image_url: string | null;
  author_name: string;
  author_bio: string | null;
  sources: KcSource[];
  faqs: KcFaq[];
  tags: string[];
  reading_time_min: number | null;
  featured: boolean;
  reg_verified: boolean;
  reg_verified_date: string | null;
  published_at: string | null;
  updated_at: string;
};

export type KcArticleCard = Pick<
  KcArticle,
  'id' | 'slug' | 'title' | 'excerpt' | 'category_id' | 'reading_time_min' | 'published_at'
>;

export const PAGE_SIZE = 12;

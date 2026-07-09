export type Product = {
  title: string;
  description: string;
  /** Absolute URL (Amazon / Stan Store). Omit when the link isn't live yet. */
  href?: string;
  cta: string;
  /** Small label rendered above the title, e.g. "Free" or "Bundle". */
  badge?: string;
  /** Only set when the price is actually known — never invented. */
  price?: string;
  wasPrice?: string;
};

/**
 * Product card for the Books and Apps/PDF pages. External links open in a new
 * tab with rel="sponsored" (affiliate/storefront links). A product without an
 * href renders a non-clickable "coming soon" state instead of a dead link.
 */
export function ProductCard({ product }: { product: Product }) {
  const { title, description, href, cta, badge, price, wasPrice } = product;

  const body = (
    <>
      {badge && (
        <span className="mb-3 self-start rounded-card bg-signal px-2 py-0.5 font-body text-xs font-bold uppercase tracking-wide text-asphalt">
          {badge}
        </span>
      )}
      <h3 className="font-display text-xl uppercase text-signal">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted">{description}</p>
      {price && (
        <p className="mt-4 font-display text-2xl uppercase text-ink">
          {wasPrice && <s className="mr-2 font-body text-base text-muted">{wasPrice}</s>}
          {price}
        </p>
      )}
      {href ? (
        <span className="mt-4 text-sm font-semibold text-ink transition-transform group-hover:translate-x-1">
          {cta} →
        </span>
      ) : (
        <span className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Link coming soon
        </span>
      )}
    </>
  );

  const cardClasses =
    'group flex flex-col rounded-card border border-line bg-asphalt-800 p-6 transition-colors';

  if (!href) {
    return <div className={cardClasses}>{body}</div>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener sponsored"
      className={`${cardClasses} hover:border-signal`}
    >
      {body}
    </a>
  );
}

export function ProductGrid({
  products,
  columns = 3,
}: {
  products: Product[];
  columns?: 2 | 3;
}) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid gap-5 ${cols}`}>
      {products.map((p) => (
        <ProductCard key={p.title} product={p} />
      ))}
    </div>
  );
}

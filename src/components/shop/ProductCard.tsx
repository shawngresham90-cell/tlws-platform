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
  /** Short benefit bullets shown under the description. */
  benefits?: string[];
  /** Emoji rendered in the card's image panel (until real product art exists). */
  icon?: string;
};

/**
 * Product card for the Books and Apps/PDF pages. External links open in a new
 * tab with rel="sponsored" (affiliate/storefront links). A product without an
 * href renders a non-clickable "coming soon" state instead of a dead link.
 */
export function ProductCard({ product }: { product: Product }) {
  const { title, description, href, cta, badge, price, wasPrice, benefits, icon } = product;

  const body = (
    <>
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 flex aspect-[5/2] items-center justify-center rounded-card border border-line bg-asphalt-700 text-5xl"
        >
          {icon}
        </div>
      )}
      {badge && (
        <span className="mb-3 self-start rounded-card bg-signal px-2 py-0.5 font-body text-xs font-bold uppercase tracking-wide text-asphalt">
          {badge}
        </span>
      )}
      <h3 className="font-display text-xl uppercase text-signal">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {benefits && benefits.length > 0 && (
        <ul className="mt-3 flex-1 space-y-1.5">
          {benefits.map((b) => (
            <li key={b} className="flex gap-2 text-sm text-ink">
              <span aria-hidden="true" className="text-signal">
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      )}
      {(!benefits || benefits.length === 0) && <span className="flex-1" />}
      {price && (
        <p className="mt-4 font-display text-2xl uppercase text-ink">
          {wasPrice && <s className="mr-2 font-body text-base text-muted">{wasPrice}</s>}
          {price}
        </p>
      )}
      {href ? (
        <span className="mt-4 inline-flex self-start rounded-card bg-signal px-4 py-2 font-display text-sm uppercase text-asphalt transition-colors group-hover:bg-signal-600">
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

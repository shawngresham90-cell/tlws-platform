import { OFFERS, annualSavingsCents, formatPrice, priceLabel } from '@/lib/directory/offers';

/**
 * The three directory offers, exactly as approved. Every one is an **inquiry**
 * — this component collects nothing, charges nothing, and activates nothing.
 *
 * Capacity lines state a real operating limit ("up to three per page"). They
 * are deliberately NOT live availability: no "1 spot left", no countdown, no
 * manufactured scarcity. Nothing here promises traffic, leads, ranking, or
 * sales, and the annual saving is derived from the two prices rather than
 * written by hand, so the figures can never disagree.
 */
export function OfferTable({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ul className="grid gap-5 lg:grid-cols-3">
        {OFFERS.map((offer) => {
          const saving = annualSavingsCents(offer);
          const free = offer.monthlyCents === null && offer.annualCents === null;
          return (
            <li
              key={offer.id}
              className="flex flex-col rounded-card border border-line bg-asphalt p-6"
            >
              <h3 className="font-display text-xl uppercase text-signal">{offer.name}</h3>

              <p className="mt-3 font-display text-2xl text-ink">{priceLabel(offer)}</p>
              {saving !== null && saving > 0 && (
                <p className="mt-1 text-xs text-muted">
                  Paying yearly works out {formatPrice(saving)} less than twelve monthly payments.
                </p>
              )}
              {free && <p className="mt-1 text-xs text-muted">There is nothing to pay.</p>}

              <p className="mt-3 text-sm text-muted">{offer.summary}</p>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted">
                {offer.includes.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="text-signal">
                      •
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {offer.capacity && (
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                  <span className="font-semibold text-ink">Capacity:</span> {offer.capacity}. That
                  is the limit we operate to — we do not publish live spot counts.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-sm text-muted">
        Prices are what a placement costs if we agree one. Sending the form below is an{' '}
        <span className="font-semibold text-ink">inquiry</span> — it does not take payment, start a
        subscription, approve a claim, or turn on featured placement. Shawn reads every one and
        replies personally.
      </p>
      <p className="mt-2 text-sm text-muted">
        We do not promise traffic, leads, ranking, or sales. The directory&apos;s measurement is
        still being set up, so rather than quote numbers we cannot yet stand behind, we would rather
        show you real ones once they exist.
      </p>
    </div>
  );
}

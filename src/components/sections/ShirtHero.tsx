import Image from 'next/image';
import { Section, Eyebrow } from '@/components/ui';

/**
 * Founding Member Shirt — a limited-run merch drop that funds the school.
 * A prominent, high-contrast band placed right under the hero (above the four
 * paths). The CTA is an external link to the Stan store and opens a new tab.
 * The shirt photo lives in /public and is optimized/resized by next/image.
 */
const SHIRT_URL = 'https://stan.store/TRUCKINGLIFEWITHSHAWN/p/founding-member-shirt--only-100-made';

export function ShirtHero() {
  return (
    <Section
      id="founding-shirt"
      aria-labelledby="founding-shirt-heading"
      className="border-b border-line bg-asphalt-800"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <Image
          src="/images/store/founding-member-shirt.jpg"
          alt="Trucking Life Founding Member shirt — limited run, only 100 made"
          width={1086}
          height={1448}
          sizes="(max-width: 640px) 80vw, 320px"
          className="h-auto w-full max-w-[20rem] rounded-card object-contain"
        />

        <div>
          <Eyebrow>Limited drop · Funds the school</Eyebrow>
          <h2 id="founding-shirt-heading" className="display-section mt-2">
            Founding Member Shirt — <span className="text-signal">only 100 made</span>
          </h2>
          <p className="mt-4 text-lg text-muted">Wear the mission. Fund the school.</p>
        </div>

        <a
          href={SHIRT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-card bg-signal px-10 py-4 font-display text-xl uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
        >
          Get the shirt
        </a>
      </div>
    </Section>
  );
}

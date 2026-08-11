import { getImageProps } from 'next/image';
import { Button, Container, Eyebrow } from '@/components/ui';
import { HeroShirtPromo } from './HeroShirtPromo';
import { TruckParkingMarquee } from './TruckParkingMarquee';
import { NavigatorMarquee } from './NavigatorMarquee';

/**
 * Hero — THE CALL (cinematic flow beat 1), image-led since 2026-08-11:
 * Night Haul master blueprint shot #1 landed. Shawn, Mossy Oak cap, arms
 * crossed, ProStar + 53' trailer angled behind, golden hour, camera low —
 * REAL photography supplied by the owner, exactly the frame
 * docs/design/owner-assets-needed.md §1 was waiting for. Two approved
 * frames, one per orientation, mapped from the owner's original files:
 *
 *   "shawn-prostar-hero-mobile (1).webp"  (1080×1350, 4:5)
 *     → /images/home/shawn-prostar-hero-mobile.webp — phones, below 768px
 *   "shawn-prostar-hero-desktop.webp"     (1664×936, 16:9)
 *     → /images/home/shawn-prostar-hero-desktop.webp — md and up
 *
 * Art direction is one real <picture> built from getImageProps — not two
 * stacked next/image instances — so the browser downloads only the frame
 * that matches the viewport. Each frame gets an explicit aspect box
 * (4:5 phone, 16:9 from md, both exact) so reserved space is right at
 * every width: no CLS, no stretch, no crop. priority on the img carries
 * the LCP hint (fetchPriority + eager) because the art-directed <picture>
 * path bypasses next/image's automatic preload injection.
 *
 * The photograph wears the CinematicStill house grade — 7% sodium wash,
 * bottom-third caption scrim, film grain — treatment layers OVER the
 * frame, never edits to it. The caption absorbs the old standalone byline
 * (same verified credential, now stated once, on the photo). Layout keeps
 * the blueprint's graduation plan: the frame fills the right plane on
 * desktop while the headline keeps the dark left; on phones the portrait
 * leads full-bleed. CTA hierarchy unchanged: ONE amber action (the school
 * application), one outlined learn-more. Copy unchanged. No opening date
 * is displayed until the owner confirms one.
 */

const HERO_ALT =
  'Shawn standing in front of a white International ProStar tractor-trailer at sunset.';

const HERO_MOBILE = '/images/home/shawn-prostar-hero-mobile.webp';
const HERO_DESKTOP = '/images/home/shawn-prostar-hero-desktop.webp';

/*
 * quality 90: the owner frames are already display-sized, hand-approved
 * WebP under the §1 200 KB budget. The optimizer only derives DPR
 * downscales; a default-quality second encode would visibly soften an
 * already-compressed photograph.
 */
function heroPicture() {
  const { props: desktop } = getImageProps({
    alt: HERO_ALT,
    src: HERO_DESKTOP,
    width: 1664,
    height: 936,
    quality: 90,
    sizes: '(min-width: 1280px) 600px, (min-width: 1024px) 55vw, 100vw',
  });
  const { props: mobile } = getImageProps({
    alt: HERO_ALT,
    src: HERO_MOBILE,
    width: 1080,
    height: 1350,
    quality: 90,
    sizes: '100vw',
    priority: true,
  });
  return { desktop, mobile };
}

export function Hero() {
  const { desktop, mobile } = heroPicture();
  /*
   * React 18's HTML serializer drops the camelCase fetchPriority prop that
   * getImageProps returns (the next/image component lowercases it itself;
   * a raw <img> spread does not) — dev happened to emit it, the production
   * render did not. Re-applying it as the lowercase HTML attribute survives
   * both renderers; attribute names are case-insensitive to the browser.
   */
  const { fetchPriority, ...mobileImg } = mobile;
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-line bg-asphalt py-10 sm:py-14 lg:py-24"
    >
      {/* Sodium light wash — ambient, top-right, like a yard lamp off-frame.
          Decorative layers sit above the section background and below the
          relatively-positioned content (negative z-index would paint them
          behind the section's own background and hide them entirely). */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(110% 90% at 82% -10%, rgba(245,166,35,0.09) 0%, rgba(245,166,35,0) 55%), linear-gradient(180deg, #1A1A1C 0%, #141414 72%)',
        }}
      />
      <div aria-hidden="true" className="film-grain absolute inset-0" />

      {/* The one hero-level motion moment; killed under reduced motion.
          Template areas run the page's two reading orders from one DOM:
          phones open on the portrait photograph, then the call, support
          copy, and tiles; from lg the headline spans the top, support copy
          sits on the dark left, the landscape frame fills the right plane,
          and the three tiles form a row beneath — nothing ever overlaps
          Shawn or the truck. */}
      <Container className="relative motion-safe:animate-fade-up">
        <div className="grid gap-y-10 [grid-template-areas:'photo'_'intro'_'support'_'tiles'] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-x-12 lg:gap-y-12 lg:[grid-template-areas:'intro_intro'_'support_photo'_'tiles_tiles']">
          {/* The photograph. Full-bleed on phones (negative margins undo the
              Container padding), framed like every CinematicStill from md. */}
          <figure className="relative -mx-5 overflow-hidden [grid-area:photo] sm:-mx-8 md:mx-0 md:rounded-card md:border md:border-line">
            <div className="relative aspect-[4/5] md:aspect-video">
              <picture>
                <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes={desktop.sizes} />
                <img
                  {...mobileImg}
                  {...({ fetchpriority: fetchPriority ?? 'high' } as Record<string, string>)}
                  alt={HERO_ALT}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </picture>
            </div>
            {/* CinematicStill house grade: sodium wash + bottom-third scrim
                (≥ .78 at the caption baseline — the house contrast floor). */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(20,20,20,0.10) 0%, rgba(20,20,20,0) 40%, rgba(20,20,20,0.88) 100%), linear-gradient(0deg, rgba(245,166,35,0.07), rgba(245,166,35,0.07))',
              }}
            />
            <div aria-hidden="true" className="film-grain absolute inset-0" />
            {/* Explicit utilities, not .doc-caption: that class carries
                text-muted, which would fail contrast over bright frames. */}
            <figcaption className="absolute inset-x-0 bottom-0 p-4 text-[11px] font-semibold uppercase tracking-wider text-ink/90">
              <span className="text-signal">Shawn Gresham · </span>
              CDL instructor &amp; driver trainer
            </figcaption>
          </figure>

          <div className="[grid-area:intro]">
            <Eyebrow>Trucking Life · Dalton, GA · off I-75</Eyebrow>
            <h1 id="hero-heading" className="display-hero max-w-4xl">
              17 years. Zero violations.{' '}
              <span className="text-signal">Now I&apos;m training the next generation.</span>
            </h1>
          </div>

          <div className="[grid-area:support] lg:self-center">
            <p className="max-w-2xl text-lg text-muted">
              A CDL school in Dalton, GA — built by a driver, funded by drivers, no games.
              ELDT-compliant CDL-A training on real trucks and real road, plus free tools for every
              driver already out there running.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button href="/academy/apply">Apply to the Academy</Button>
              <Button variant="secondary" href="/knowledge">
                Explore Free Training
              </Button>
            </div>
          </div>

          {/* Promo tiles: TEMPORARY shirt merchandising (remove when it sells
              out), the Truck Parking marquee tile DIRECTLY beneath it, and the
              Navigator pilot tile DIRECTLY beneath that — same three, same
              pinned order, now a row from sm. The Navigator tile points at the
              pilot password gate, not the Navigator itself, so it is safe on a
              deploy where the Navigator runtime is switched off. */}
          <div className="grid w-full max-w-sm gap-5 [grid-area:tiles] sm:max-w-none sm:grid-cols-2 lg:grid-cols-3">
            <HeroShirtPromo />
            <TruckParkingMarquee />
            <NavigatorMarquee />
          </div>
        </div>
      </Container>
    </section>
  );
}

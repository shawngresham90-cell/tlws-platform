import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/**
 * Featured YouTube videos. Placeholder cards now (no live embeds = no third-party
 * JS hit to Lighthouse). When wired, these become lite-embeds that load the
 * iframe only on click. Structure is here; data plugs in later.
 */
const VIDEOS = [
  { title: 'FMCSA Just Changed DOT Inspections', tag: 'DOT / Regulations' },
  { title: 'DOT Officers Are Quietly Doing This', tag: 'Roadside' },
  { title: '17 Years, Zero Violations — Here’s How', tag: 'Career' },
];

export function FeaturedVideos() {
  return (
    <Section id="videos" className="border-b border-line bg-asphalt-800">
      <SectionHeading
        eyebrow="From the Channel"
        title="Trucking Life with Shawn"
        intro="Regulation breakdowns, roadside reality, and the money side of driving — to 84K+ on YouTube and hundreds of thousands more across Facebook and TikTok."
      />
      <div className="grid gap-5 sm:grid-cols-3">
        {VIDEOS.map((v) => (
          <div key={v.title} className="overflow-hidden rounded-card border border-line bg-asphalt">
            <div className="flex aspect-video items-center justify-center bg-asphalt-700">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-signal"
                aria-hidden="true"
              >
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
              </svg>
            </div>
            <div className="p-4">
              <p className="text-xs uppercase tracking-wide text-signal">{v.tag}</p>
              <h3 className="mt-1 font-semibold text-ink">{v.title}</h3>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-9">
        <Button variant="ghost" href="/videos">
          Watch on YouTube
        </Button>
      </div>
    </Section>
  );
}

import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/**
 * Featured videos. Card-style outbound links (no live embeds = zero
 * third-party JS on page load, no Lighthouse hit) — each card opens its
 * video on YouTube or TikTok in a new tab.
 */
const CARD =
  'block overflow-hidden rounded-card border border-line bg-asphalt transition-colors ' +
  'hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal';

const VIDEOS = [
  {
    title: 'FMCSA Just Changed DOT Inspections',
    tag: 'DOT / Regulations',
    url: 'https://youtu.be/UlW-GlLugUg?si=2Nhr_Tc_Rs8DhZ1w',
  },
  {
    title: 'DOT Officers Are Quietly Doing This',
    tag: 'Roadside',
    url: 'https://youtu.be/vXtKQs6we_s?si=HvdaE6GNqRGDVb21',
  },
  {
    title: '17 Years, Zero Violations — Here’s How',
    tag: 'Career',
    url: 'https://youtu.be/PDeJF0CMoUw?si=Kjo1o2Z0D9XVIAW5',
  },
];

const TIKTOKS = [
  {
    title: 'Latest from @trucking.life.with.shawn',
    tag: 'TikTok',
    url: 'https://www.tiktok.com/@trucking.life.with.shawn/video/7610553111299591454?is_from_webapp=1&sender_device=pc&web_id=7505819818789029422',
  },
  {
    title: 'More from the road on TikTok',
    tag: 'TikTok',
    url: 'https://www.tiktok.com/@trucking.life.with.shawn/video/7582959144139853087?is_from_webapp=1&sender_device=pc&web_id=7505819818789029422',
  },
];

function VideoCard({ video }: { video: { title: string; tag: string; url: string } }) {
  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" className={CARD}>
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
        <p className="text-xs uppercase tracking-wide text-signal">{video.tag}</p>
        <h3 className="mt-1 font-semibold text-ink">{video.title}</h3>
      </div>
    </a>
  );
}

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
          <VideoCard key={v.title} video={v} />
        ))}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TIKTOKS.map((v) => (
          <VideoCard key={v.url} video={v} />
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

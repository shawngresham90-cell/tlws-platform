import { Section, Container, Eyebrow, Placard } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'TLWS DOT Tools | Trucking Life With Shawn',
  description:
    'Explore upcoming free DOT reference tools from Trucking Life With Shawn. Regulatory features are being independently verified before release.',
  path: '/dot-tools',
});

/**
 * Landing page for TLWS DOT Tools.
 *
 * One tool is LIVE: the HOS Calculator (owner-authorized 2026-07-28; engine
 * `src/lib/hos/`, regulatory record in `docs/compliance/hos-verification.md`
 * and `split-sleeper-rule-ledger.md`). Its card links out; every other card
 * remains a plain <div> (never a link/button) with an honest status label,
 * because those tools remain blocked pending independent verification and
 * attorney review. This page itself still computes nothing.
 */

type ToolStatus = 'LIVE' | 'COMING SOON' | 'IN VERIFICATION' | 'LEGAL REVIEW REQUIRED';

const TOOLS: Array<{
  icon: string;
  name: string;
  description: string;
  status: ToolStatus;
  /** Set only for LIVE tools — the card becomes a link. */
  href?: string;
}> = [
  {
    icon: '⏱️',
    name: 'HOS Calculator',
    description:
      'Split sleeper berth pairing under 49 CFR 395.1(g), plus your 11-hour, 14-hour, cycle, and break clocks. Planning and education only — not an ELD.',
    status: 'LIVE',
    href: '/tools/hos-calculator',
  },
  {
    icon: '📖',
    name: 'Reg Deck',
    description: 'Browse selected U.S. commercial-driving regulations and official sources.',
    status: 'IN VERIFICATION',
  },
  {
    icon: '🚦',
    name: 'Before You Move',
    description: 'Review entered facts before making a Personal Conveyance or Yard Move decision.',
    status: 'IN VERIFICATION',
  },
  {
    icon: '📋',
    name: 'Violation Checker',
    description: 'Review public SMS violation information and estimated weighted values.',
    status: 'IN VERIFICATION',
  },
  {
    icon: '🚨',
    name: 'Roadside Mode',
    description:
      'Quick access to documents, official references, and roadside preparation information.',
    status: 'LEGAL REVIEW REQUIRED',
  },
  {
    icon: '🗂️',
    name: 'Document Wallet',
    description: 'Store selected documents locally on the driver’s device.',
    status: 'COMING SOON',
  },
  {
    icon: '✍️',
    name: 'Fix-It Letters',
    description: 'Create structured correction-request drafts after legal review is complete.',
    status: 'LEGAL REVIEW REQUIRED',
  },
];

/** Official sources already recorded in the repo verification documents. */
const SOURCES: Array<{ label: string; href: string }> = [
  { label: 'FMCSA', href: 'https://www.fmcsa.dot.gov' },
  { label: 'eCFR', href: 'https://www.ecfr.gov' },
  { label: 'FMCSA Safety Measurement System Methodology', href: 'https://csa.fmcsa.dot.gov' },
  { label: 'FMCSA DataQs', href: 'https://dataqs.fmcsa.dot.gov' },
];

function StatusPill({ status }: { status: ToolStatus }) {
  return (
    <span className="doc-caption inline-flex items-center gap-2 rounded-card border border-line px-2.5 py-1">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'LIVE' ? 'bg-marker' : status === 'IN VERIFICATION' ? 'bg-signal' : 'bg-muted'
        }`}
      />
      {status}
    </span>
  );
}

export default function DotToolsPage() {
  return (
    <>
      {/* Hero */}
      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>TLWS DOT Tools</Eyebrow>
          <h1 className="display-section">Free DOT tools built for working drivers.</h1>
          <p className="mt-4 text-muted">
            Reference tools, planning aids, and roadside resources are being carefully reviewed
            against current official sources before release.
          </p>
        </div>
      </Section>

      {/* Status notice */}
      <Section className="border-b border-line bg-asphalt-800">
        <Placard className="max-w-3xl border-l-2 border-l-signal">
          <p className="eyebrow mb-3">Independent verification in progress</p>
          <p className="text-muted">
            The HOS Calculator is live below. The remaining tools are not available yet — TLWS is
            verifying their regulatory sources, calculations, wording, privacy protections, and
            legal disclosures before launch.
          </p>
        </Placard>
      </Section>

      {/* Planned tools */}
      <Section className="border-b border-line">
        <div className="mb-10 max-w-2xl">
          <Eyebrow>Planned tools</Eyebrow>
          <h2 className="display-section">What’s on the way</h2>
          <p className="mt-4 text-muted">
            The HOS Calculator is live. Every other tool stays offline until its sources, wording,
            and disclosures are reviewed.
          </p>
        </div>

        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <li key={tool.name}>
              {tool.href ? (
                <a
                  href={tool.href}
                  className="block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                >
                  <Placard className="flex h-full flex-col border-l-2 border-l-marker transition-colors hover:border-signal">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span aria-hidden="true" className="text-2xl">
                        {tool.icon}
                      </span>
                      <StatusPill status={tool.status} />
                    </div>
                    <h3 className="font-display text-xl uppercase text-ink">{tool.name}</h3>
                    <p className="mt-2 text-sm text-muted">{tool.description}</p>
                    <p className="doc-caption mt-auto pt-3 text-signal">Open the calculator →</p>
                  </Placard>
                </a>
              ) : (
                <Placard className="flex h-full flex-col">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span aria-hidden="true" className="text-2xl">
                      {tool.icon}
                    </span>
                    <StatusPill status={tool.status} />
                  </div>
                  <h3 className="font-display text-xl uppercase text-ink">{tool.name}</h3>
                  <p className="mt-2 text-sm text-muted">{tool.description}</p>
                </Placard>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {/* Built from official sources */}
      <Section className="bg-asphalt-800">
        <div className="max-w-2xl">
          <Eyebrow>Built from official sources</Eyebrow>
          <h2 className="display-section">Checked against the record</h2>
          <p className="mt-4 text-muted">
            As each tool is prepared, its facts are verified against official government sources.
            Trucking Life With Shawn is an independent educational brand and is not a government
            agency.
          </p>
        </div>

        <ul className="mt-8 flex flex-wrap gap-3 p-0">
          {SOURCES.map((source) => (
            <li key={source.href} className="list-none">
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-caption inline-flex items-center gap-2 rounded-card border border-line px-3 py-2 text-muted transition-colors hover:border-signal hover:text-signal"
              >
                {source.label}
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="doc-caption mt-8 max-w-2xl leading-relaxed">
          Reference material only — not legal advice. These tools are still in preparation and are
          not yet available.
        </p>
      </Section>
    </>
  );
}

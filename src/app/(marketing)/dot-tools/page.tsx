import { Section, Container, Eyebrow, Placard } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'TLWS DOT Tools | Trucking Life With Shawn',
  description:
    'Explore upcoming free DOT reference tools from Trucking Life With Shawn. Regulatory features are being independently verified before release.',
  path: '/dot-tools',
});

/**
 * Static, informational landing page for the planned TLWS DOT Tools.
 *
 * This page is intentionally non-functional. It does not calculate,
 * interpret, store, recommend, or provide any compliance conclusion. Every
 * tool card is a plain <div> (never a link/button) carrying an honest status
 * label, because the regulatory tools remain blocked pending independent
 * verification and attorney review. No calculators, no logic, no storage, no
 * data collection, no analytics — see the DOT Tools compliance docs.
 */

type ToolStatus = 'COMING SOON' | 'IN VERIFICATION' | 'LEGAL REVIEW REQUIRED';

const TOOLS: Array<{
  icon: string;
  name: string;
  description: string;
  status: ToolStatus;
}> = [
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
          status === 'IN VERIFICATION' ? 'bg-signal' : 'bg-muted'
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
            These tools are not available yet. TLWS is verifying the regulatory sources,
            calculations, wording, privacy protections, and legal disclosures before launch.
          </p>
        </Placard>
      </Section>

      {/* Planned tools */}
      <Section className="border-b border-line">
        <div className="mb-10 max-w-2xl">
          <Eyebrow>Planned tools</Eyebrow>
          <h2 className="display-section">What’s on the way</h2>
          <p className="mt-4 text-muted">
            A preview of the free tools in development. Each one stays offline until its sources,
            wording, and disclosures are reviewed. Nothing here is interactive yet.
          </p>
        </div>

        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <li key={tool.name}>
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

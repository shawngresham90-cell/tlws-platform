import { Section, Eyebrow, Placard } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';
import { HosCalculator } from '@/components/tools/HosCalculator';

export const metadata = buildMetadata({
  title: 'HOS Calculator — Split Sleeper Berth | Trucking Life With Shawn',
  description:
    'Free FMCSA hours-of-service calculator for CDL drivers: 11-hour drive clock, 14-hour window, 60/70 cycle, and split sleeper berth pairing under 49 CFR 395.1(g) — 7/3, 8/2, and every qualifying combination.',
  path: '/tools/hos-calculator',
});

/**
 * HOS Calculator — planning and education only. All calculation logic lives
 * in `src/lib/hos/` (pure, minute-based, tested in
 * `scripts/test-hos-calculator.ts`); this page only renders it.
 *
 * Regulatory record: docs/compliance/hos-verification.md and
 * docs/compliance/split-sleeper-rule-ledger.md. Official sources:
 * 49 CFR 395.3 and 395.1(g) (eCFR), FMCSA split sleeper berth FAQs.
 */
export default function HosCalculatorPage() {
  return (
    <>
      <Section className="border-b border-line !py-10 sm:!py-14">
        <div className="max-w-2xl">
          <Eyebrow>TLWS DOT Tools</Eyebrow>
          <h1 className="display-section">HOS Calculator</h1>
          <p className="mt-3 text-muted">
            11-hour drive clock · 14-hour window · 60/70 cycle · split sleeper berth pairing under
            49 CFR §395.1(g). See what time your split gives back — and when.
          </p>
          <p className="doc-caption mt-4 leading-relaxed">
            Planning and education only. This tool is <strong>not an ELD</strong>, keeps no record
            of duty status, and does not replace your ELD, your carrier&rsquo;s safety department,
            or the regulations. Verify every result on your ELD before driving. Property-carrying
            drivers, current federal rules only — state rules, passenger rules, adverse-conditions,
            and short-haul exceptions are not calculated. Don&rsquo;t use this while driving — park
            first.
          </p>
        </div>
      </Section>

      <HosCalculator />

      <Section className="border-t border-line bg-asphalt-800">
        <div className="max-w-2xl">
          <Eyebrow>The rules behind the math</Eyebrow>
          <h2 className="display-section">Straight from the regulation</h2>
          <ul className="mt-6 space-y-3 text-sm text-muted">
            <li>
              <strong className="text-ink">11-hour driving limit</strong> — up to 11 hours of
              driving after 10 consecutive hours off duty (49 CFR 395.3(a)(3)(i)).
            </li>
            <li>
              <strong className="text-ink">14-hour window</strong> — no driving beyond the 14th
              consecutive hour after coming on duty. The window runs on the wall clock; ordinary
              breaks don&rsquo;t pause it (49 CFR 395.3(a)(2)).
            </li>
            <li>
              <strong className="text-ink">30-minute break</strong> — required after 8 cumulative
              hours of driving; any 30-minute non-driving period counts (49 CFR 395.3(a)(3)(ii)).
            </li>
            <li>
              <strong className="text-ink">60/70-hour cycle</strong> — the rolling on-duty cap over
              7 or 8 days; restored only by a 34-hour restart (49 CFR 395.3(b), (c)).
            </li>
            <li>
              <strong className="text-ink">Split sleeper berth</strong> — the 10 required off-duty
              hours may be split into one period of at least 7 consecutive hours in the sleeper
              berth plus a second period of at least 2 consecutive hours off duty or in the sleeper,
              totaling at least 10. Properly paired periods don&rsquo;t count against the 14-hour
              window, and the clocks recalculate from the end of the first qualifying period (49 CFR
              395.1(g)(1); FMCSA split sleeper FAQs). 6/4 and 5/5 are not authorized for ordinary
              property-carrying drivers.
            </li>
          </ul>
          <Placard className="mt-8 border-l-2 border-l-signal">
            <p className="doc-caption leading-relaxed">
              Official sources:{' '}
              <a
                className="text-signal underline-offset-4 hover:underline"
                href="https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.3"
                target="_blank"
                rel="noopener noreferrer"
              >
                49 CFR 395.3 (eCFR)
              </a>{' '}
              ·{' '}
              <a
                className="text-signal underline-offset-4 hover:underline"
                href="https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.1"
                target="_blank"
                rel="noopener noreferrer"
              >
                49 CFR 395.1(g) (eCFR)
              </a>{' '}
              ·{' '}
              <a
                className="text-signal underline-offset-4 hover:underline"
                href="https://www.fmcsa.dot.gov/regulations/hours-service/what-rest-periods-qualify-split-sleeper-berth-provision"
                target="_blank"
                rel="noopener noreferrer"
              >
                FMCSA: qualifying split rest periods
              </a>{' '}
              ·{' '}
              <a
                className="text-signal underline-offset-4 hover:underline"
                href="https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"
                target="_blank"
                rel="noopener noreferrer"
              >
                FMCSA HOS summary
              </a>
            </p>
          </Placard>
        </div>
      </Section>
    </>
  );
}

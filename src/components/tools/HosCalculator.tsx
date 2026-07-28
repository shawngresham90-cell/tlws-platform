'use client';

import { useId, useState } from 'react';
import { Section, Placard } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { parseHM, formatHM } from '@/lib/hos/time';
import { calculateQuickSplit } from '@/lib/hos/split-sleeper';
import { currentClocks } from '@/lib/hos/clocks';
import type { RestStatus, SplitResult, CycleRule } from '@/lib/hos/types';

/**
 * HOS Calculator UI. Mobile-first for a phone in a truck cab: big touch
 * targets, H:MM numeric fields, no horizontal scrolling. ALL calculation
 * logic lives in `src/lib/hos/` — this component only parses fields,
 * calls the engine, and renders its output verbatim.
 */

/* ------------------------------------------------------------ primitives */

function HmField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const id = useId();
  const parsed = parseHM(value);
  return (
    <div>
      <label htmlFor={id} className="doc-caption mb-1 block uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="H:MM"
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={value.trim() !== '' && parsed === null}
        className={cn(
          'w-full rounded-card border bg-asphalt-800 px-3 py-3 font-mono text-xl text-ink outline-none',
          'focus-visible:ring-2 focus-visible:ring-signal',
          value.trim() !== '' && parsed === null ? 'border-diesel' : 'border-line',
        )}
      />
      {hint ? <p className="doc-caption mt-1 text-muted">{hint}</p> : null}
    </div>
  );
}

function StatusSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RestStatus;
  onChange: (v: RestStatus) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="doc-caption mb-1 block uppercase tracking-wider text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as RestStatus)}
        className="w-full rounded-card border border-line bg-asphalt-800 px-3 py-3 font-mono text-xl text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <option value="sleeper">SLEEPER BERTH</option>
        <option value="off-duty">OFF DUTY</option>
      </select>
    </div>
  );
}

function ClockTile({
  label,
  minutes,
  danger,
}: {
  label: string;
  minutes: number;
  danger?: boolean;
}) {
  const tone =
    danger || minutes <= 0 ? 'text-diesel-300' : minutes <= 120 ? 'text-signal' : 'text-marker-300';
  return (
    <div className="placard flex flex-col items-center p-3 text-center">
      <div className="doc-caption uppercase tracking-widest text-muted">{label}</div>
      <div className={cn('mt-1 font-mono text-4xl font-bold leading-tight', tone)}>
        {formatHM(Math.max(0, minutes))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- results */

function ResultPanel({ result }: { result: SplitResult }) {
  const [showHow, setShowHow] = useState(false);
  const clocks = result.clocks;
  const splitStatus = result.fullReset
    ? 'FULL RESET — NOT A SPLIT'
    : result.split.qualifies
      ? 'VALID SPLIT'
      : 'DOES NOT QUALIFY';
  return (
    <div className="mt-6 space-y-4" aria-live="polite">
      {clocks ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <ClockTile label="Drive available" minutes={clocks.driveMin} />
          <ClockTile label="14-hr available" minutes={clocks.windowMin} />
          <ClockTile label="Cycle available" minutes={clocks.cycleMin} />
        </div>
      ) : null}

      <Placard
        className={cn('border-l-2', result.legalToDrive ? 'border-l-marker' : 'border-l-diesel')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="doc-caption uppercase tracking-widest text-muted">Split status</p>
            <p className="font-display text-xl uppercase text-ink">{splitStatus}</p>
          </div>
          <div className="text-right">
            <p className="doc-caption uppercase tracking-widest text-muted">HOS time available</p>
            <p
              className={cn(
                'font-display text-2xl uppercase',
                result.legalToDrive ? 'text-marker-300' : 'text-diesel-300',
              )}
            >
              {result.legalToDrive ? 'YES' : 'NO'}
            </p>
          </div>
        </div>
        <p className="doc-caption mt-2 text-muted">
          Based on the hours entered and FMCSA HOS calculations. Verify against your ELD and current
          duty status.
        </p>
        {clocks && result.limiting ? (
          <p className="mt-3 text-sm text-muted">
            Usable driving time:{' '}
            <strong className="font-mono text-ink">{formatHM(result.usableDriveMin)}</strong> —
            limited by the <strong className="text-ink">{result.limiting}</strong> clock. Break
            clock: {formatHM(clocks.untilBreakMin)} of driving before a 30-minute break is required.
          </p>
        ) : null}
      </Placard>

      {result.violations.length > 0 ? (
        <Placard role="note" className="border-l-2 border-l-diesel">
          <p className="doc-caption mb-2 uppercase tracking-widest text-diesel-300">
            Violations already on the clock
          </p>
          <ul className="space-y-2 text-sm text-muted">
            {result.violations.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </Placard>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowHow((s) => !s)}
          aria-expanded={showHow}
          className="doc-caption inline-flex min-h-[48px] items-center gap-2 rounded-card border border-line px-4 uppercase tracking-wider text-muted transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {showHow ? '▾' : '▸'} How this result works
        </button>
        {showHow ? (
          <Placard className="mt-3">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
              {result.explanation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <p className="doc-caption mt-4 leading-relaxed">
              Planning and education only — not an ELD, not a compliance determination. Verify on
              your ELD before driving.
            </p>
          </Placard>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ quick mode */

const PRESETS: Array<{ label: string; f: string; fs: RestStatus; s: string; ss: RestStatus }> = [
  { label: '7/3 SPLIT', f: '7:00', fs: 'sleeper', s: '3:00', ss: 'off-duty' },
  { label: '8/2 SPLIT', f: '8:00', fs: 'sleeper', s: '2:00', ss: 'off-duty' },
  { label: 'FULL 10-HR RESET', f: '10:00', fs: 'sleeper', s: '0:00', ss: 'off-duty' },
];

function QuickSplit() {
  const [form, setForm] = useState({
    f: '8:00',
    fs: 'sleeper' as RestStatus,
    s: '2:00',
    ss: 'off-duty' as RestStatus,
    drv: '6:00',
    on: '1:00',
    oth: '0:00',
    cycle: '70/8' as CycleRule,
    cyc: '30:00',
    bd: '0:00',
    bo: '0:00',
  });
  const [result, setResult] = useState<SplitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = () => {
    setError(null);
    const fields: Array<[keyof typeof form, string]> = [
      ['f', 'first rest'],
      ['s', 'second rest'],
      ['drv', 'driving between'],
      ['on', 'on duty between'],
      ['oth', 'other time between'],
      ['cyc', 'cycle used'],
      ['bd', 'driving before'],
      ['bo', 'on duty before'],
    ];
    const parsed: Record<string, number> = {};
    for (const [key, label] of fields) {
      const v = parseHM(form[key] as string);
      if (v === null) {
        setError(`Check the "${label}" field — enter time as H:MM (for example 7:30).`);
        setResult(null);
        return;
      }
      parsed[key] = v;
    }
    setResult(
      calculateQuickSplit({
        firstRestMin: parsed.f,
        firstRestStatus: form.fs,
        secondRestMin: parsed.s,
        secondRestStatus: form.ss,
        drivingBetweenMin: parsed.drv,
        onDutyBetweenMin: parsed.on,
        otherBetweenMin: parsed.oth,
        cycleRule: form.cycle,
        cycleUsedMin: parsed.cyc,
        drivingBeforeMin: parsed.bd,
        onDutyBeforeMin: parsed.bo,
      }),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick-start presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setForm((prev) => ({ ...prev, f: p.f, fs: p.fs, s: p.s, ss: p.ss }));
              setResult(null);
            }}
            className="doc-caption min-h-[48px] rounded-card border border-line px-4 uppercase tracking-wider text-muted transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HmField
          label="First rest length"
          value={form.f}
          onChange={(v) => setForm({ ...form, f: v })}
        />
        <StatusSelect
          label="First rest status"
          value={form.fs}
          onChange={(v) => setForm({ ...form, fs: v })}
        />
        <HmField
          label="Second rest length"
          value={form.s}
          onChange={(v) => setForm({ ...form, s: v })}
        />
        <StatusSelect
          label="Second rest status"
          value={form.ss}
          onChange={(v) => setForm({ ...form, ss: v })}
        />
      </div>

      <div className="border-t border-dashed border-line pt-4">
        <p className="doc-caption mb-2 uppercase tracking-wider text-signal">
          Between the two rest periods
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <HmField
            label="Driving"
            value={form.drv}
            onChange={(v) => setForm({ ...form, drv: v })}
          />
          <HmField
            label="On duty (not driving)"
            value={form.on}
            onChange={(v) => setForm({ ...form, on: v })}
          />
          <HmField
            label="Short breaks (under 2:00)"
            value={form.oth}
            onChange={(v) => setForm({ ...form, oth: v })}
            hint="Non-qualifying off-duty time — it still uses the 14-hr window."
          />
        </div>
      </div>

      <div className="border-t border-dashed border-line pt-4">
        <p className="doc-caption mb-2 uppercase tracking-wider text-signal">Cycle</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="hos-cycle-rule"
              className="doc-caption mb-1 block uppercase tracking-wider text-muted"
            >
              Cycle type
            </label>
            <select
              id="hos-cycle-rule"
              value={form.cycle}
              onChange={(e) => setForm({ ...form, cycle: e.target.value as CycleRule })}
              className="w-full rounded-card border border-line bg-asphalt-800 px-3 py-3 font-mono text-xl text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <option value="70/8">70 HR / 8 DAYS</option>
              <option value="60/7">60 HR / 7 DAYS</option>
            </select>
          </div>
          <HmField
            label="Cycle used before first rest"
            value={form.cyc}
            onChange={(v) => setForm({ ...form, cyc: v })}
          />
        </div>
      </div>

      <div className="border-t border-dashed border-line pt-4">
        <p className="doc-caption mb-2 uppercase tracking-wider text-muted">
          Before the first rest — optional, for the &ldquo;time you got back&rdquo; comparison
        </p>
        <div className="grid grid-cols-2 gap-3">
          <HmField
            label="Driving before"
            value={form.bd}
            onChange={(v) => setForm({ ...form, bd: v })}
          />
          <HmField
            label="On duty before"
            value={form.bo}
            onChange={(v) => setForm({ ...form, bo: v })}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={calculate}
        className="min-h-[56px] w-full rounded-card bg-signal px-6 font-display text-xl uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
      >
        Calculate my clocks
      </button>

      {error ? (
        <Placard role="alert" className="border-l-2 border-l-diesel">
          <p className="text-sm text-diesel-300">{error}</p>
        </Placard>
      ) : null}
      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

/* --------------------------------------------------- current-clocks mode */

function CurrentClocks() {
  const [form, setForm] = useState({
    drive: '11:00',
    window: '14:00',
    cycle: '70:00',
    brk: '8:00',
  });
  const [out, setOut] = useState<ReturnType<typeof currentClocks> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState<{ d: number; w: number; c: number; b: number } | null>(null);

  const calculate = () => {
    setError(null);
    const d = parseHM(form.drive);
    const w = parseHM(form.window);
    const c = parseHM(form.cycle);
    const b = parseHM(form.brk);
    if (d === null || w === null || c === null || b === null) {
      setError(
        'Every field needs a time as H:MM (for example 6:15). Read them straight off your ELD.',
      );
      setOut(null);
      setVals(null);
      return;
    }
    setVals({ d, w, c, b });
    setOut(currentClocks({ driveMin: d, windowMin: w, cycleMin: c, untilBreakMin: b }));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Enter the remaining time shown on your ELD. This mode does no rule math — it names your
        limiting clock and your usable driving time.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <HmField
          label="11-hr drive remaining"
          value={form.drive}
          onChange={(v) => setForm({ ...form, drive: v })}
        />
        <HmField
          label="14-hr window remaining"
          value={form.window}
          onChange={(v) => setForm({ ...form, window: v })}
        />
        <HmField
          label="Cycle remaining"
          value={form.cycle}
          onChange={(v) => setForm({ ...form, cycle: v })}
        />
        <HmField
          label="Drive time until break"
          value={form.brk}
          onChange={(v) => setForm({ ...form, brk: v })}
        />
      </div>
      <button
        type="button"
        onClick={calculate}
        className="min-h-[56px] w-full rounded-card bg-signal px-6 font-display text-xl uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
      >
        Show my limiting clock
      </button>
      {error ? (
        <Placard role="alert" className="border-l-2 border-l-diesel">
          <p className="text-sm text-diesel-300">{error}</p>
        </Placard>
      ) : null}
      {out && out.ok && vals ? (
        <div className="space-y-4" aria-live="polite">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <ClockTile label="Drive available" minutes={vals.d} />
            <ClockTile label="14-hr available" minutes={vals.w} />
            <ClockTile label="Cycle available" minutes={vals.c} />
          </div>
          <Placard
            className={cn('border-l-2', out.legalToDrive ? 'border-l-marker' : 'border-l-diesel')}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Usable driving time:{' '}
                <strong className="font-mono text-ink">{formatHM(out.usableDriveMin)}</strong> —
                limited by the <strong className="text-ink">{out.limiting}</strong> clock.
              </p>
              <div className="text-right">
                <p className="doc-caption uppercase tracking-widest text-muted">
                  HOS time available
                </p>
                <p
                  className={cn(
                    'font-display text-2xl uppercase',
                    out.legalToDrive ? 'text-marker-300' : 'text-diesel-300',
                  )}
                >
                  {out.legalToDrive ? 'YES' : 'NO'}
                </p>
              </div>
            </div>
            <p className="doc-caption mt-2 text-muted">
              Based on the hours entered and FMCSA HOS calculations. Verify against your ELD and
              current duty status.
            </p>
          </Placard>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

export function HosCalculator() {
  const [mode, setMode] = useState<'split' | 'clocks'>('split');
  return (
    <Section className="!py-10 sm:!py-14">
      <div className="mx-auto w-full max-w-xl">
        <div
          className="mb-5 grid grid-cols-2 overflow-hidden rounded-card border border-line"
          role="tablist"
          aria-label="Calculator mode"
        >
          {(
            [
              ['split', 'SPLIT SLEEPER CHECK'],
              ['clocks', 'CURRENT CLOCKS'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={cn(
                'min-h-[52px] px-3 font-display text-base uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal',
                mode === key
                  ? 'bg-signal text-asphalt'
                  : 'bg-transparent text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Placard>{mode === 'split' ? <QuickSplit /> : <CurrentClocks />}</Placard>
      </div>
    </Section>
  );
}

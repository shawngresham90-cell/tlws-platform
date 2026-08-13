'use client';

import { profileSummary, type EditableProfile } from '@/lib/navigator/truck-profile';
import { formatDimension, formatWeight } from '@/lib/navigator/format-units';

/**
 * The confirmed truck, in four lines, with an obvious way back in.
 *
 * WHY A SUMMARY EXISTS AT ALL. The full editor is five preset rows, a
 * hazmat select, five avoidance toggles and an honesty panel — correct
 * for the first visit and far too much for the twentieth. A returning
 * driver whose truck was restored from the last visit needs to check four
 * numbers and move on, not scroll past a form they already filled.
 *
 * WHAT IT MUST NOT BECOME. This is a READ-ONLY echo of the confirmed
 * profile. It has no inputs and no presets: everything that can change a
 * routing value lives behind **Edit truck**, so there is exactly one
 * place a truck can be edited and exactly one confirmation that follows
 * it. The dimensions render through `format-units`, the same authority
 * the editor and the route summary use, so this card cannot disagree with
 * either about what the same truck is — including reading `13′6″` in
 * imperial and `4.11 m` in metric for the identical stored value.
 */
export function TruckSummary({
  profile,
  metric,
  onEdit,
}: {
  profile: EditableProfile;
  metric: boolean;
  onEdit: () => void;
}) {
  // The not-sent fields stay visible even here: a card that lists only
  // the working ones reads as a guarantee of truck-legality, which this
  // app cannot make.
  const notSent = profileSummary(profile).filter((l) => !l.sent);
  return (
    <section aria-labelledby="truck-summary-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="truck-summary-heading" className="text-xl font-bold text-ink">
          Your truck
        </h3>
        <span className="text-base font-semibold text-ink/70">Saved</span>
      </div>

      <dl className="rounded-cockpit border border-line p-3 text-lg">
        <Row label="Height" value={formatDimension(profile.heightFt, metric)} />
        <Row label="Width" value={formatDimension(profile.widthFt, metric)} />
        <Row label="Length" value={formatDimension(profile.lengthFt, metric)} />
        <Row label="Gross weight" value={formatWeight(profile.grossWeightLbs, metric)} />
        <Row label="Axles" value={`${profile.axles}`} />
        <Row
          label="Hazmat"
          value={profile.hazmatClass === null ? 'None' : `Class ${profile.hazmatClass}`}
        />
      </dl>

      <p className="text-base text-ink/70">
        Not used for routing: {notSent.map((l) => l.label.toLowerCase()).join(', ')}.
      </p>

      <button
        type="button"
        onClick={onEdit}
        className="min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-4 text-xl font-semibold text-ink"
      >
        Edit truck
      </button>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-ink/70">{label}</dt>
      <dd className="num-data font-semibold text-ink">{value}</dd>
    </div>
  );
}

import type { DirectoryEntry } from '@/lib/directory/types';

/**
 * One directory listing. Renders whatever fields an entry has and skips the
 * rest, so thin early data and rich future data use the same card.
 */
export function EntryCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-asphalt-800 p-5">
      <h3 className="font-display text-lg uppercase text-ink">{entry.name}</h3>
      <p className="mt-1 text-sm text-muted">
        {entry.city}, {entry.state}
        {entry.address ? ` · ${entry.address}` : ''}
      </p>
      {entry.description && <p className="mt-3 flex-1 text-sm text-muted">{entry.description}</p>}
      {entry.amenities && entry.amenities.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {entry.amenities.map((a) => (
            <li
              key={a}
              className="rounded-card border border-signal/40 bg-signal/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-signal"
            >
              {a}
            </li>
          ))}
        </ul>
      )}
      {(entry.phone || entry.website || entry.parkingSpaces != null) && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          {entry.parkingSpaces != null && (
            <span className="text-muted">{entry.parkingSpaces} truck spaces</span>
          )}
          {entry.phone && (
            <a
              href={`tel:${entry.phone}`}
              className="text-signal underline-offset-4 hover:underline"
            >
              {entry.phone}
            </a>
          )}
          {entry.website && (
            <a
              href={entry.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-signal underline-offset-4 hover:underline"
            >
              Website
            </a>
          )}
        </div>
      )}
    </div>
  );
}

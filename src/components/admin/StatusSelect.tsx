'use client';

import { useState, useTransition } from 'react';
import { updateStatusAction } from '@/app/admin/actions';
import type { AdminEntity } from '@/lib/admin/status';
import { cn } from '@/lib/utils/cn';

/**
 * Inline status dropdown. Changing the value calls the admin-gated server
 * action and optimistically updates; on failure it reverts. No save button —
 * one change, one update.
 */
export function StatusSelect({
  entity,
  id,
  current,
  options,
}: {
  entity: AdminEntity;
  id: string;
  current: string;
  options: readonly string[];
}) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  // Always show the current value even if it predates the admin vocabulary.
  const opts = options.includes(value) ? options : [value, ...options];

  return (
    <select
      aria-label="Status"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        const prev = value;
        setValue(next);
        startTransition(async () => {
          try {
            await updateStatusAction(entity, id, next);
          } catch {
            setValue(prev);
          }
        });
      }}
      className={cn(
        'rounded-card border border-line bg-asphalt px-2 py-1 text-sm text-ink',
        'focus:border-signal focus:outline-none',
        pending && 'opacity-60',
      )}
    >
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

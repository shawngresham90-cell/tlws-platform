/**
 * Admin status vocabularies — one source of truth shared by the dashboards
 * (server) and the StatusSelect control (client). These MUST stay in sync with
 * the CHECK constraints in migration 017.
 */
export const APPLICATION_STATUSES = ['new', 'contacted', 'approved', 'denied'] as const;
export const FOUNDER_STATUSES = ['submitted', 'paid', 'approved', 'hidden'] as const;
export const SPONSOR_STATUSES = ['new', 'contacted', 'paid', 'active'] as const;

export const ENTITY_STATUSES = {
  applications: APPLICATION_STATUSES,
  founders: FOUNDER_STATUSES,
  sponsors: SPONSOR_STATUSES,
} as const;

export type AdminEntity = keyof typeof ENTITY_STATUSES;

/** Runtime-safe membership check for a (entity, status) pair. */
export function isValidStatus(entity: AdminEntity, status: string): boolean {
  const allowed = ENTITY_STATUSES[entity] as readonly string[] | undefined;
  return Boolean(allowed && allowed.includes(status));
}

'use client';

/**
 * FM-3: the visitor's previewed founder identity — name, would-be number, and
 * tier — held IN MEMORY ONLY. Never persisted, never sent anywhere; gone on
 * refresh. That impermanence is deliberate: the only way to make it permanent
 * is to actually take the place on the wall.
 *
 * Set by the Induction (WallScene); read by the finale (LegacySignature) so
 * the last line of the page can belong to the visitor.
 */
export type PreviewIdentity = { name: string; number: number; tierLabel: string } | null;

let current: PreviewIdentity = null;
const subs = new Set<(v: PreviewIdentity) => void>();

export function setPreviewIdentity(v: PreviewIdentity): void {
  current = v;
  subs.forEach((s) => s(v));
}

export function getPreviewIdentity(): PreviewIdentity {
  return current;
}

export function subscribePreviewIdentity(s: (v: PreviewIdentity) => void): () => void {
  subs.add(s);
  return () => subs.delete(s);
}

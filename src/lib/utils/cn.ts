/**
 * Minimal className joiner. Kept dependency-free on purpose —
 * no tool ships unless it earns its weight.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

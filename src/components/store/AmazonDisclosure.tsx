import { AMAZON_DISCLOSURE, AMAZON_DISCLOSURE_SHORT } from '@/lib/store/amazon';

/**
 * Amazon Associates disclosure. Required by the Operating Agreement wherever
 * affiliate links appear, so it renders on every store surface. `variant`
 * controls prominence, but the wording always states the material connection.
 */
export function AmazonDisclosure({ variant = 'banner' }: { variant?: 'banner' | 'inline' }) {
  if (variant === 'inline') {
    return (
      <p className="text-xs text-muted">
        {AMAZON_DISCLOSURE_SHORT}
      </p>
    );
  }
  return (
    <p className="rounded-card border border-line bg-asphalt-800 px-4 py-3 text-xs text-muted">
      {AMAZON_DISCLOSURE}
    </p>
  );
}

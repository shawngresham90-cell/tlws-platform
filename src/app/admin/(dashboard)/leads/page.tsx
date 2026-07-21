import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { segmentFor } from '@/lib/leads/funnel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Leads', robots: { index: false, follow: false } };

/**
 * Read-only lead funnel view (Block 2, M3). Shows the newsletter list by
 * segment (first-touch source) so the owner can see exactly who they'd be
 * emailing per track the day sending turns on. No send actions exist here
 * by design.
 */
type LeadRow = {
  id: string;
  email: string;
  first_name: string | null;
  source: string | null;
  sms_consent: boolean | null;
  utm: Record<string, string> | null;
  created_at: string;
};

export default async function AdminLeadsPage() {
  requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('leads')
    .select('id, email, first_name, source, sms_consent, utm, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  const leads = (data ?? []) as LeadRow[];

  const bySegment = new Map<string, { label: string; firstSend: string; count: number }>();
  for (const lead of leads) {
    const seg = segmentFor(lead.source);
    const cur = bySegment.get(seg.key) ?? { label: seg.label, firstSend: seg.firstSend, count: 0 };
    cur.count += 1;
    bySegment.set(seg.key, cur);
  }

  return (
    <div>
      <h1 className="display-section mb-2">Leads</h1>
      <p className="mb-8 max-w-2xl text-muted">
        The email list, segmented by first-touch source. Sending is intentionally not wired up —
        when it is, each segment below is a ready-made track. Showing the latest {leads.length}.
      </p>

      <div className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...bySegment.entries()].map(([key, seg]) => (
          <div key={key} className="rounded-card border border-line bg-asphalt-800 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">{seg.label}</p>
            <p className="mt-2 font-display text-4xl text-signal">{seg.count}</p>
            <p className="mt-2 text-xs text-muted">First send: {seg.firstSend}</p>
          </div>
        ))}
        {bySegment.size === 0 && <p className="text-muted">No leads yet.</p>}
      </div>

      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-asphalt-800 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">UTM source / campaign</th>
              <th className="px-4 py-3">SMS</th>
              <th className="px-4 py-3">Captured</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const seg = segmentFor(lead.source);
              return (
                <tr key={lead.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium text-ink">{lead.email}</td>
                  <td className="px-4 py-2.5 text-muted">{lead.first_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted">{seg.label}</td>
                  <td className="px-4 py-2.5 text-muted">{lead.source ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {lead.utm && (lead.utm.utm_source || lead.utm.utm_campaign)
                      ? `${lead.utm.utm_source ?? '—'} / ${lead.utm.utm_campaign ?? '—'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{lead.sms_consent ? 'yes' : '—'}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {new Date(lead.created_at).toLocaleDateString('en-US')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

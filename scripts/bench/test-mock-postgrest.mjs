/**
 * Self-test for scripts/bench/mock-postgrest.mjs.
 *
 * Exercises the mock through the real supabase-js client — the same library
 * the app uses — covering every PostgREST feature the user-facing directory
 * paths rely on (verified operator inventory in the benchmark README). Run:
 *
 *   node scripts/bench/mock-postgrest.mjs &        # default port 54999
 *   node scripts/bench/test-mock-postgrest.mjs
 *
 * Exits 1 on any failure so the bench orchestrator can gate on it.
 */
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.MOCK_PORT ?? 54999);
const sb = createClient(`http://127.0.0.1:${PORT}`, 'placeholder', {
  auth: { persistSession: false },
});

let failures = 0;
const t = (name, cond) => {
  console.log(cond ? `ok   ${name}` : `FAIL ${name}`);
  if (!cond) failures++;
};

// count=exact delivered with the first page (the PR #216 read pattern)
let { data, count, error } = await sb
  .from('locations')
  .select('id, name', { count: 'exact' })
  .eq('is_published', true)
  .is('deleted_at', null)
  .order('id', { ascending: true })
  .limit(500);
t('published count=2454 via content-range', count === 2454 && !error);
t('first page 500 rows ordered', data.length === 500 && data[0].id < data[499].id);

// keyset step
const after = data[499].id;
({ data, error } = await sb
  .from('locations')
  .select('id')
  .eq('is_published', true)
  .is('deleted_at', null)
  .gt('id', after)
  .order('id', { ascending: true })
  .limit(500));
t('keyset page 2: 500 rows all > cursor', data.length === 500 && data.every((r) => r.id > after));

// category filter at the binding-cap scale
({ count } = await sb
  .from('locations')
  .select('id', { count: 'exact', head: true })
  .eq('is_published', true)
  .is('deleted_at', null)
  .eq('category_slug', 'truck-stops'));
t('truck-stops head count=1882', count === 1882);

// coordinate presence via not.is.null — exact geocoded population
({ count } = await sb
  .from('locations')
  .select('id', { count: 'exact', head: true })
  .eq('is_published', true)
  .is('deleted_at', null)
  .not('lat', 'is', null)
  .not('lng', 'is', null));
t('geocoded count=1940', count === 1940);

// in() filter
({ count } = await sb
  .from('locations')
  .select('id', { count: 'exact', head: true })
  .eq('is_published', true)
  .is('deleted_at', null)
  .in('category_slug', ['parking', 'rest-areas']));
t('in() returns nonzero subset', count > 0 && count < 600);

// the pre-#216 capped read shape
({ data } = await sb
  .from('locations')
  .select('id')
  .eq('is_published', true)
  .is('deleted_at', null)
  .order('is_featured', { ascending: false })
  .order('name', { ascending: true })
  .limit(1000));
t('old-style capped read returns exactly 1000', data.length === 1000);

// range() -> Range header path (getNewestListings)
({ data } = await sb
  .from('locations')
  .select('id')
  .eq('is_published', true)
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .range(0, 23));
t('range(0,23) -> 24 rows', data.length === 24);

// single-object negotiation
const r1 = await sb.from('locations').select('id').eq('slug', 'no-such-slug').maybeSingle();
const r2 = await sb.from('locations').select('id').eq('slug', 'bench-stop-7').maybeSingle();
t('maybeSingle miss -> null, no error', r1.data === null && !r1.error);
t('maybeSingle hit -> row', r2.data?.id?.length === 36);

// rpc + unknown table fall back to empty sets
const r3 = await sb.rpc('nearby_locations', { lat: 1, lng: 2 });
const r4 = await sb.from('reviews').select('id').limit(5);
t('rpc -> []', Array.isArray(r3.data) && r3.data.length === 0 && !r3.error);
t('unknown table -> []', Array.isArray(r4.data) && r4.data.length === 0);

process.exit(failures ? 1 : 0);

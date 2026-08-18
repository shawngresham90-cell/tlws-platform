#!/usr/bin/env bash
# Live RLS verification — read-only / write-attempts-that-must-fail.
# Run AFTER applying supabase/migrations/054_public_api_surface_lockdown.sql:
#
#   SUPABASE_URL="https://<project-ref>.supabase.co" \
#   SUPABASE_ANON_KEY="<the publishable anon key>" \
#   bash scripts/verify-rls-live.sh
#
# Uses ONLY the publishable anon key (the same one every visitor's browser
# holds), so nothing here can do anything an anonymous visitor couldn't
# already attempt. Every write probe is expected to be REJECTED; the one
# probe that could theoretically land (spatial_ref_sys INSERT, srid 909090)
# is deleted immediately if it unexpectedly succeeds, and its success is
# reported as a FAILURE of the migration.
set -u
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"
BASE="$SUPABASE_URL/rest/v1"
AUTH=(-H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY")
fail=0

code() { curl -s -o /tmp/rls_body -w '%{http_code}' -m 30 "$@"; }

expect() { # label got want_regex
  if [[ "$2" =~ $3 ]]; then echo "OK   $1 (HTTP $2)"; else echo "FAIL $1 (HTTP $2, wanted $3)"; fail=1; fi
}

echo "== public content must stay readable =="
c=$(code "${AUTH[@]}" "$BASE/locations?select=slug&limit=1")
expect "anon reads published locations" "$c" '^200$'
c=$(code "${AUTH[@]}" "$BASE/campaign_progress?select=raised_cents&limit=1")
expect "anon reads campaign_progress view" "$c" '^200$'
c=$(code "${AUTH[@]}" "$BASE/kc_articles?select=slug&limit=1")
expect "anon reads published KC articles" "$c" '^200$'

echo "== sensitive tables: anon SELECT must return nothing or be denied =="
for t in applications leads sms_consents location_submissions community_profiles application_events; do
  c=$(code "${AUTH[@]}" "$BASE/$t?select=id&limit=1")
  body=$(cat /tmp/rls_body)
  if [[ "$c" == "200" && "$body" == "[]" ]]; then echo "OK   anon SELECT $t -> empty set"
  elif [[ "$c" =~ ^40[134]$ ]]; then echo "OK   anon SELECT $t -> denied ($c)"
  else echo "FAIL anon SELECT $t -> HTTP $c body: ${body:0:120}"; fail=1; fi
done

echo "== sensitive tables: anon UPDATE/DELETE must be denied (filters match nothing) =="
NOROW="id=eq.00000000-0000-0000-0000-000000000000"
for t in applications leads sms_consents location_submissions; do
  c=$(code "${AUTH[@]}" -X PATCH -H "Content-Type: application/json" -d '{"updated_at":"1970-01-01T00:00:00Z"}' "$BASE/$t?$NOROW")
  expect "anon UPDATE $t" "$c" '^(401|403|404|400)$'
  c=$(code "${AUTH[@]}" -X DELETE "$BASE/$t?$NOROW")
  expect "anon DELETE $t" "$c" '^(401|403|404|400)$'
done

echo "== anon INSERT into a form table must be denied =="
c=$(code "${AUTH[@]}" -X POST -H "Content-Type: application/json" -d '{"email":"rls-probe@invalid.example"}' "$BASE/leads")
expect "anon INSERT leads" "$c" '^(401|403|404|400)$'

echo "== spatial_ref_sys: reads stay open, writes must now be rejected =="
c=$(code "${AUTH[@]}" "$BASE/spatial_ref_sys?select=srid&srid=eq.4326")
expect "anon reads spatial_ref_sys (EPSG data is public)" "$c" '^200$'
c=$(code "${AUTH[@]}" -X POST -H "Content-Type: application/json" \
  -d '{"srid":909090,"auth_name":"RLSPROBE","auth_srid":909090,"srtext":"PROBE","proj4text":"PROBE"}' \
  "$BASE/spatial_ref_sys")
if [[ "$c" =~ ^(401|403|400|404)$ ]]; then
  echo "OK   anon INSERT spatial_ref_sys rejected ($c) — the 054 guard is live"
else
  echo "FAIL anon INSERT spatial_ref_sys -> HTTP $c — MIGRATION 054 IS NOT EFFECTIVE; cleaning probe row"
  curl -s -o /dev/null -m 30 "${AUTH[@]}" -X DELETE "$BASE/spatial_ref_sys?srid=eq.909090"
  fail=1
fi
c=$(code "${AUTH[@]}" -X PATCH -H "Content-Type: application/json" -d '{"auth_name":"PROBE"}' "$BASE/spatial_ref_sys?srid=eq.909090")
expect "anon UPDATE spatial_ref_sys (no-match filter)" "$c" '^(401|403|400|404)$'

echo "== the view-counter RPC must be service-role-only after 054 =="
c=$(code "${AUTH[@]}" -X POST -H "Content-Type: application/json" -d '{"p_location":"00000000-0000-0000-0000-000000000000"}' "$BASE/rpc/record_directory_view")
expect "anon rpc record_directory_view denied" "$c" '^(401|403|404)$'

if [ $fail = 0 ]; then
  echo "ALL RLS LIVE CHECKS PASSED"
else
  echo "FAILURES PRESENT — report the output back before relying on the lockdown."
fi
exit $fail

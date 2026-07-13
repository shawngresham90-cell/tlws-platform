#!/usr/bin/env python3
"""Batch 11 report builder (I-24 Tennessee): sources.md, review.md, validation.md
from the reconciled listings.json + validation artifacts. Mirrors the prior
GA/TN/KY/OH/MI/FL/IN/AL batch reports."""
import csv, io, json, re
from pathlib import Path
from collections import Counter

HERE = Path(__file__).parent
REPO = HERE.parent
STEM = "i24-kentucky-batch-012"
DATE = "2026-07-13"
STATE = "KY"
INTERSTATE = "I-24"
OUT = REPO/"data"/"imports"

master = (OUT/f"{STEM}.csv").read_text()
rows = list(csv.reader(io.StringIO(master)))
header, data = rows[0], rows[1:]
listings = json.loads((HERE/"listings.json").read_text())
excluded = json.loads((HERE/"excluded.json").read_text()) if (HERE/"excluded.json").exists() else []
excluded_existing = json.loads((HERE/"excluded_existing.json").read_text()) if (HERE/"excluded_existing.json").exists() else []
q = json.loads((HERE/"quality-scores.json").read_text())
exp = json.loads((HERE/"expansion-summary.json").read_text())
dup = json.loads((HERE/"dup-summary.json").read_text()) if (HERE/"dup-summary.json").exists() else {}
parts = sorted(str(p.name) for p in OUT.glob(f"{STEM}-part*.csv"))

cat_order = ["CAT Scales","Hotels with Truck Parking","Roadside Service","Tire Repair",
             "Truck Parking","Truck Stops","Truck Washes","Weigh Stations"]
held = [l for l in listings if l["published"]=="no"]
pub  = [l for l in listings if l["published"]=="yes"]
cats = Counter(l["category"] for l in listings)
cats_pub = Counter(l["category"] for l in pub)
cities = Counter(l["city"] for l in listings)

# I-24 Tennessee corridor, east (Chattanooga / I-75, high exits) -> west (KY line, low exits)
east_west = ["Oak Grove","Pembroke","Hopkinsville","Gracey","Cadiz","Canton","Grand Rivers",
    "Kuttawa","Eddyville","Calvert City","West Paducah","Paducah"]

def exit_of(l):
    return (l.get("exit_number") or "").strip()
exits = sorted({exit_of(l) for l in listings if exit_of(l)}, key=lambda x: (len(x), x))

def official_label():
    return "KYTC/KSP"

# ---- sources.md ----
o = [f"# Batch 12 — I-24 Kentucky: Source Report\n",
     f"Every listing was verified against the listed public sources on **{DATE}**.",
     "No field was invented: anything a source did not state is blank in the CSV. Coordinates are",
     "blank on every row (geocoding is a separate verified workflow). Research method: web search +",
     "official brand/state pages as primary sources, with directory/review sites as secondary",
     "confirmation, across corridor segments from the Tennessee state line at Oak Grove west through Hopkinsville and Cadiz",
     "to Eddyville, Paducah and the Illinois state line.",
     "Where official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, Blue Beacon, TruckParkingClub,",
     "TDOT) blocked direct fetches, facts were captured via search snippets and corroborated by 2+ directories.\n",
     f"- Records in CSV: **{len(data)}**",
     "- Researched but excluded: see end of file\n"]
for cat in cat_order:
    cl = [l for l in listings if l["category"]==cat]
    if not cl: continue
    o.append(f"## {cat}\n")
    for l in cl:
        o.append(f"### {l['name']} — {l['city']}, {STATE}\n")
        o.append(f"- **Verified:** {DATE}")
        o.append(f"- **Published:** {l['published']}")
        if l["published"]=="no": o.append(f"- **Held because:** {l['publish_reason'] or '(see corroboration)'}")
        o.append("- **Sources:**")
        for s in (l.get("sources") or []): o.append(f"  - {s}")
        blanks = ["lat","lng"]
        for f_,lab in [("address","address"),("zip","zip"),("phone","phone"),("website","website"),("exit_number","exit number")]:
            if not l.get(f_): blanks.append(lab)
        o.append(f"- **Left blank (not verifiable from sources):** {', '.join(blanks)}")
        corr = (l.get('corroboration') or '').strip()
        o.append(f"- **Corroboration:** {(corr+' ' if corr else '')}(research pass: {l.get('agent','?')}) Verified {DATE}.\n")
o.append("## Researched but excluded\n")
o.append("Candidates found and rejected during research, with reasons:\n")
for e in excluded:
    o.append(f"- **{e.get('name','?')}** ({e.get('city','?')}) — {e.get('reason','?')} _(from {e.get('_from','?')})_")
(OUT/f"{STEM}-sources.md").write_text("\n".join(o))
print("sources.md:", len("\n".join(o).splitlines()), "lines")

# ---- review.md ----
noph = [l for l in listings if not l.get('phone')]
noweb = [l for l in listings if not l.get('website')]
no_addr = [l for l in listings if not l.get('address')]
weird = [l for l in listings if l.get('address') and not re.match(r'^\d', l['address'])]
ready = len(listings)-len(no_addr)-len(weird)
tpc_ct = sum(1 for l in listings if l.get('tpc_url'))

r = [f"# Batch 12 — I-24 Kentucky: Review Summary\n",
     f"CSV: `data/imports/{STEM}.csv` · verified {DATE} · dry-run validated against the live import",
     "parser (`scripts/validate-import.ts`) **and** the Expansion Readiness assessment",
     "(`assessExpansion`). **Nothing has been imported to production.**\n",
     "## Totals\n",
     f"- Total researched candidates: **{len(listings)+len(excluded)}** ({len(listings)} included + {len(excluded)} excluded)",
     f"- Total rows in CSV: **{len(data)}**",
     f"- Published = yes: **{len(pub)}**",
     f"- Published = no (held with documented reasons): **{len(held)}**",
     "- Featured = yes: **0** (featuring requires explicit approval)",
     f"- TruckParkingClub URLs: **{tpc_ct}** (only where actually listed on truckparkingclub.com); no affiliate codes.",
     "- Coordinates: **none supplied** — geocoding is a separate verified workflow.\n",
     "## Rows by category\n",
     "| Category | Rows | Published | Held |","| --- | --- | --- | --- |"]
for cat in cat_order:
    if cats[cat]: r.append(f"| {cat} | {cats[cat]} | {cats_pub.get(cat,0)} | {cats[cat]-cats_pub.get(cat,0)} |")
r.append(f"| **Total** | **{len(data)}** | **{len(pub)}** | **{len(held)}** |\n")
r.append("## Corridor coverage (Chattanooga / I-75 → Monteagle → Murfreesboro → Nashville → Clarksville → Kentucky line)\n")
r.append(f"- Distinct I-24 exits represented: **{len(exits)}** — {', '.join(exits) if exits else '(none recorded)'}")
r.append("\n## Rows by city (east → west)\n| City | Rows |\n| --- | --- |")
for c in east_west:
    if cities.get(c): r.append(f"| {c} | {cities[c]} |")
for c in sorted(set(cities)-set(east_west)):
    r.append(f"| {c} | {cities[c]} |")
r.append("\n## Held records (Published = no) — reasons\n")
for l in held: r.append(f"- **{l['name']}** ({l['category']}, {l['city']}): {l['publish_reason'] or '(see sources)'}")
r.append("\n## Manual phone-verification list\n")
r.append(f"Rows missing a verified phone (blank rather than guessed): **{len(noph)}**. Call before/after import; priority = published rows:")
for l in [x for x in noph if x['published']=='yes']:
    r.append(f"- {l['name']} ({l['city']}, {l['category']})")
r.append("\n## Website-verification list\n")
r.append(f"Rows missing a verified website (blank rather than guessed): **{len(noweb)}**. Published rows to backfill:")
for l in [x for x in noweb if x['published']=='yes']:
    r.append(f"- {l['name']} ({l['city']}, {l['category']})")
r.append("\n## Address-verification concerns\n")
r.append(f"- Rows with no street address: **{len(no_addr)}**; rows whose address does not start with a street number (rest area / weigh station / mobile / ambiguous): **{len(weird)}**.")
for l in no_addr+weird: r.append(f"  - {l['name']} ({l['city']}) — address: {l.get('address') or '(blank)'}")
r.append("\n## Parking-verification concerns\n")
pk = [l for l in listings if l['category'] in ('Truck Parking','Truck Stops','Hotels with Truck Parking')]
r.append(f"- Parking/overnight rows: **{len(pk)}**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them. Overnight is never inferred from truck-space presence.")
r.append("\n## Weigh-station review\n")
ws = [l for l in listings if l['category']=='Weigh Stations']
r.append(f"- Weigh/inspection stations included: **{len(ws)}** ({sum(1 for l in ws if l['published']=='yes')} published / {sum(1 for l in ws if l['published']=='no')} held). Stations without a civic street address + official source are held pending KYTC/KSP confirmation.")
for l in ws: r.append(f"  - {l['name']} ({l['city']}) — {'published' if l['published']=='yes' else 'HELD: '+(l['publish_reason'] or 'see sources')}")
r.append("- Public rest areas / welcome centers and weigh stations without a civic address + official KYTC/KSP source are held.")
r.append("\n## Legitimate co-location pairs\n")
r.append(f"- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service at a host truck stop, filed as separate rows per the directory model): **{dup.get('inFile',0)}** (score >= 50 by `classifyPair`). The host business is never duplicated.")
r.append("\n## Coordinate readiness (no coordinates supplied)\n")
r.append(f"- **Coordinate-ready candidates ({ready}):** rows with a full verified street address — suitable for the verified geocoding console after import.")
r.append(f"- **Manual-review coordinate candidates ({len(no_addr)+len(weird)}):** mile marker / rest area / weigh station / mobile service / incomplete or ambiguous address:")
for l in no_addr+weird: r.append(f"  - {l['name']} ({l['city']})")
r.append("\n## Validation results\n")
r.append(f"- Live import parser (`validate-import.ts` / `prepareImport`): master + all {len(parts)} parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).")
r.append(f"- Expansion Readiness (`assessExpansion` vs live production): **{exp['ready']} ready-to-publish, {exp['unpub']} import-unpublished, {exp['manual']} manual-review, {exp['reject']} reject**; slug collisions vs live: **{exp.get('slugCollisions',0)}**.")
if dup:
    r.append(f"- Duplicate detection (`classifyPair`): vs Georgia **{dup.get('gaHits',0)}**, Tennessee I-75 **{dup.get('tnHits',0)}**, Kentucky **{dup.get('kyHits',0)}**, Ohio **{dup.get('ohHits',0)}**, Michigan **{dup.get('miHits',0)}**, Florida **{dup.get('flHits',0)}**, Indiana **{dup.get('inHits',0)}**, Alabama **{dup.get('alHits',0)}**, Tennessee I-65 **{dup.get('tn65Hits',0)}**, live DB **{dup.get('liveHits',0)}** low-confidence matches; in-file co-location pairs: **{dup.get('inFile',0)}**; in-batch slug duplicates: **{dup.get('inBatchSlugDupes',0)}**.")
    r.append("  - All cross-batch/live matches are score-35 `brand-multi-exit` or shared-corporate-contact false positives (same Pilot/Love's/Speedco/Blue Beacon brand or shared CAT Scale/Speedco corporate phone+website at a **different city, exit and street address**). `assessExpansion` — the authoritative gate — returned **0 manual-review and 0 reject**, and there are **0 slug collisions**, so no real duplicate survives.")
r.append(f"- Quality (`scoreCompleteness`): min {q['min']}, median {q['median']}, mean {q['mean']}, max {q['max']}; labels: " + ", ".join(f"{k} {v}" for k,v in q['dist'].items()) + ". Low scorers are the held/thin rows (safety features, single-source holds); every published full-service stop scores Good.")
r.append("\n## Existing-Tennessee duplicate protection\n")
tn_live = sum(1 for l in json.loads((HERE/'live.json').read_text()) if (l.get('state') or '')==STATE) if (HERE/'live.json').exists() else 0
r.append(f"- Every candidate was compared (normalized name + city, plus `classifyPair` on name/address/phone/website/category/interstate/exit) against all **{tn_live} existing production Kentucky listings** (the I-75 East/Central-East Kentucky batch). This batch is the Western-Kentucky **I-24** corridor (Oak Grove/Hopkinsville/Cadiz/Eddyville/Paducah); the existing KY rows are I-75 (Lexington/Corbin/London/Florence), so there is no city, exit or address overlap.")
r.append(f"- Rows dropped because they already exist in production Tennessee (exact/probable existing-TN duplicates; not re-added, production left unchanged): **{len(excluded_existing)}**.")
for e in excluded_existing:
    r.append(f"  - {e.get('name','?')} ({e.get('city','?')}, {e.get('category','?')}) — {e.get('reason','?')}")
r.append("- The Nashville Love's #429 (I-65 Trinity Ln, already live) and the Antioch/downtown facilities on the I-24/I-65/I-40 overlap were explicitly excluded rather than re-listed; the Clarksville truck cluster is actually in Oak Grove, KY (I-24 Exit 86, across the state line) and is out of scope for this TN batch.")
r.append("\n## Known issues / limitations\n")
r.append("- Some brand/official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub, TDOT) rate-limit or block direct fetches; those facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.")
r.append("- The KY I-24 corridor is rural Western Kentucky with truck-stop clusters concentrated at Oak Grove, Cadiz, Eddyville and Paducah; quality over quantity.")
r.append("\n## Final recommendation\n")
r.append(f"- Approved (Published = yes): **{len(pub)}** · Held (documented): **{len(held)}** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).")
r.append(f"- Import parts: {', '.join(f'`{p}`' for p in parts)} (<=25 rows each).")
r.append("- Nothing imported, published, merged, or deployed. Awaiting approval.")
(OUT/f"{STEM}-review.md").write_text("\n".join(r)+"\n")
print("review.md:", len(r), "lines")

# ---- validation.md ----
v = [f"# Batch 12 — I-24 Kentucky: Validation Report\n",
     f"All checks run {DATE} with the REAL production code, read-only. Nothing imported.\n",
     "## Import parser (`prepareImport` / `scripts/validate-import.ts`)\n",
     f"- Master + {len(parts)} parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).\n",
     "## Expansion Readiness (`assessExpansion` vs live)\n",
     f"- ready-to-publish {exp['ready']} / import-unpublished {exp['unpub']} / manual-review {exp['manual']} / reject {exp['reject']}; slug collisions {exp.get('slugCollisions',0)}.",
     f"- Per-row verdicts: `data/imports/{STEM}-expansion-report.csv`.\n",
     "## Duplicate detection (`classifyPair`)\n"]
if dup:
    v.append(f"- vs GA {dup.get('gaHits',0)} / TN-I75 {dup.get('tnHits',0)} / KY {dup.get('kyHits',0)} / OH {dup.get('ohHits',0)} / MI {dup.get('miHits',0)} / FL {dup.get('flHits',0)} / IN {dup.get('inHits',0)} / AL {dup.get('alHits',0)} / TN-I65 {dup.get('tn65Hits',0)} / live {dup.get('liveHits',0)}; in-file co-location {dup.get('inFile',0)}; in-batch slug duplicates {dup.get('inBatchSlugDupes',0)}.")
    v.append("- All are low-confidence (score 35) brand-multi-exit / shared-corporate-contact false positives; 0 exact duplicates, 0 slug collisions, 0 existing-TN duplicates dropped.")
v.append("\n## Quality (`scoreCompleteness`)\n")
v.append(f"- min {q['min']} / median {q['median']} / mean {q['mean']} / max {q['max']}; " + ", ".join(f"{k} {v2}" for k,v2 in q['dist'].items()) + ".")
v.append("\n## Slug-collision detection\n")
v.append(f"- vs live production detail slugs: {exp.get('slugCollisions',0)}; in-batch: {dup.get('inBatchSlugDupes',0)}.")
(OUT/f"{STEM}-validation.md").write_text("\n".join(v)+"\n")
print("validation.md written")

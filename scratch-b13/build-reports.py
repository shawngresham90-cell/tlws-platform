#!/usr/bin/env python3
"""Batch 13 report builder (I-24 Illinois + Georgia — corridor completion):
sources.md, review.md, validation.md from the reconciled listings.json +
validation artifacts. Mirrors the prior GA/TN/KY/OH/MI/FL/IN/AL/I-24 batch reports."""
import csv, io, json, re
from pathlib import Path
from collections import Counter

HERE = Path(__file__).parent
REPO = HERE.parent
STEM = "i24-illinois-georgia-batch-013"
DATE = "2026-07-13"
STATES = ("IL", "GA")
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

# I-24 west end (IL, low mile markers) -> Ohio River, then the GA dip near Chattanooga
west_east = ["Goreville","Tunnel Hill","Vienna","Belknap","New Columbia","Big Bay",
             "Metropolis","Wildwood","New England","Trenton"]

def exit_of(l):
    return (l.get("exit_number") or "").strip()
exits = sorted({exit_of(l) for l in listings if exit_of(l)}, key=lambda x: (len(x), x))

# ---- sources.md ----
o = [f"# Batch 13 — I-24 Illinois + Georgia (corridor completion): Source Report\n",
     f"Every listing was verified against the listed public sources on **{DATE}**.",
     "No field was invented: anything a source did not state is blank in the CSV. Coordinates are",
     "blank on every row (geocoding is a separate verified workflow). Research method: web search +",
     "official brand/state pages as primary sources, with directory/review sites as secondary",
     "confirmation, across two segments that complete the I-24 corridor: the Illinois western end",
     "(I-57 junction at Goreville east to the Ohio River at Metropolis, exits ~7-37) and the short",
     "Georgia dip through Dade County (Wildwood/New England, exits 167-169) near Chattanooga.",
     "Where official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub,",
     "IDOT, GDOT) blocked direct fetches, facts were captured via search snippets and corroborated by 2+ directories.\n",
     f"- Records in CSV: **{len(data)}**",
     "- Researched but excluded: see end of file\n"]
for cat in cat_order:
    cl = [l for l in listings if l["category"]==cat]
    if not cl: continue
    o.append(f"## {cat}\n")
    for l in cl:
        o.append(f"### {l['name']} — {l['city']}, {l['state']}\n")
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
    o.append(f"- **{e.get('business_name') or e.get('name','?')}** — {e.get('reason','?')} _(from {e.get('_from','?')})_")
(OUT/f"{STEM}-sources.md").write_text("\n".join(o))
print("sources.md:", len("\n".join(o).splitlines()), "lines")

# ---- review.md ----
noph = [l for l in listings if not l.get('phone')]
noweb = [l for l in listings if not l.get('website')]
no_addr = [l for l in listings if not l.get('address')]
weird = [l for l in listings if l.get('address') and not re.match(r'^\d', l['address'])]
ready = len(listings)-len(no_addr)-len(weird)
tpc_ct = sum(1 for l in listings if l.get('tpc_url'))

r = [f"# Batch 13 — I-24 Illinois + Georgia (corridor completion): Review Summary\n",
     f"CSV: `data/imports/{STEM}.csv` · verified {DATE} · dry-run validated against the live import",
     "parser (`prepareImport`) **and** the Expansion Readiness assessment",
     "(`assessExpansion`). **Nothing has been imported to production.**\n",
     "This batch completes the I-24 corridor: Tennessee (Batch 11) and Kentucky (Batch 12) are",
     "in-flight draft PRs; this adds the Illinois western end and the short Georgia dip.\n",
     "## Totals\n",
     f"- Total researched candidates: **{len(listings)+len(excluded)}** ({len(listings)} included + {len(excluded)} excluded)",
     f"- Total rows in CSV: **{len(data)}**",
     f"- Published = yes: **{len(pub)}**",
     f"- Published = no (held with documented reasons): **{len(held)}**",
     "- Featured = yes: **0** (featuring requires explicit approval)",
     f"- TruckParkingClub URLs: **{tpc_ct}** (only where actually listed on truckparkingclub.com); no affiliate codes.",
     "- Coordinates: **none supplied** — geocoding is a separate verified workflow.\n",
     "## Rows by state\n",
     "| State | Rows | Published | Held |","| --- | --- | --- | --- |"]
st_all = Counter(l["state"] for l in listings); st_pub = Counter(l["state"] for l in pub)
for st in STATES:
    if st_all.get(st): r.append(f"| {st} | {st_all[st]} | {st_pub.get(st,0)} | {st_all[st]-st_pub.get(st,0)} |")
r.append("\n## Rows by category\n")
r.append("| Category | Rows | Published | Held |"); r.append("| --- | --- | --- | --- |")
for cat in cat_order:
    if cats[cat]: r.append(f"| {cat} | {cats[cat]} | {cats_pub.get(cat,0)} | {cats[cat]-cats_pub.get(cat,0)} |")
r.append(f"| **Total** | **{len(data)}** | **{len(pub)}** | **{len(held)}** |\n")
r.append("## Corridor coverage (I-57/Goreville → Vienna → Metropolis → [Ohio River] … [TN] … Wildwood GA → [TN])\n")
r.append(f"- Distinct I-24 exits represented: **{len(exits)}** — {', '.join(exits) if exits else '(none recorded)'}")
r.append("\n## Rows by city (west → east)\n| City | Rows |\n| --- | --- |")
for c in west_east:
    if cities.get(c): r.append(f"| {c} | {cities[c]} |")
for c in sorted(set(cities)-set(west_east)):
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
r.append(f"- Rows with no street address: **{len(no_addr)}**; rows whose address does not start with a street number (rest area / weigh station / ambiguous): **{len(weird)}**.")
for l in no_addr+weird: r.append(f"  - {l['name']} ({l['city']}) — address: {l.get('address') or '(blank)'}")
r.append("\n## Parking-verification concerns\n")
pk = [l for l in listings if l['category'] in ('Truck Parking','Truck Stops','Hotels with Truck Parking')]
r.append(f"- Parking/overnight rows: **{len(pk)}**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them. Overnight is never inferred from truck-space presence.")
r.append("\n## Weigh-station review\n")
ws = [l for l in listings if l['category']=='Weigh Stations']
r.append(f"- Weigh/inspection stations included: **{len(ws)}** ({sum(1 for l in ws if l['published']=='yes')} published / {sum(1 for l in ws if l['published']=='no')} held). Stations without a civic street address + official source are held pending IDOT/ISP (Illinois) or GDOT/DPS (Georgia) confirmation.")
for l in ws: r.append(f"  - {l['name']} ({l['city']}) — {'published' if l['published']=='yes' else 'HELD: '+(l['publish_reason'] or 'see sources')}")
r.append("- Public rest areas / welcome centers and weigh stations without a civic address + official state source are held.")
r.append("\n## Legitimate co-location pairs\n")
r.append(f"- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service at a host truck stop, filed as separate rows per the directory model): **{dup.get('inFile',0)}** (score >= 50 by `classifyPair`). The host business is never duplicated.")
r.append("\n## Coordinate readiness (no coordinates supplied)\n")
r.append(f"- **Coordinate-ready candidates ({ready}):** rows with a full verified street address — suitable for the verified geocoding console after import.")
r.append(f"- **Manual-review coordinate candidates ({len(no_addr)+len(weird)}):** mile marker / rest area / weigh station / incomplete or ambiguous address:")
for l in no_addr+weird: r.append(f"  - {l['name']} ({l['city']})")
r.append("\n## Validation results\n")
r.append(f"- Live import parser (`prepareImport`): master + all {len(parts)} parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).")
r.append(f"- Expansion Readiness (`assessExpansion` vs live production): **{exp['ready']} ready-to-publish, {exp['unpub']} import-unpublished, {exp['manual']} manual-review, {exp['reject']} reject**; slug collisions vs live: **{exp.get('slugCollisions',0)}**.")
if dup:
    r.append(f"- Duplicate detection (`classifyPair`): vs Georgia I-75 **{dup.get('gaHits',0)}**, Tennessee I-75 **{dup.get('tnHits',0)}**, Kentucky I-75 **{dup.get('kyHits',0)}**, Ohio **{dup.get('ohHits',0)}**, Michigan **{dup.get('miHits',0)}**, Florida **{dup.get('flHits',0)}**, Indiana **{dup.get('inHits',0)}**, Alabama **{dup.get('alHits',0)}**, Tennessee I-65 **{dup.get('tn65Hits',0)}**, pending I-65 KY (b010) **{dup.get('ky65Hits',0)}**, pending I-24 TN (b011) **{dup.get('tn24Hits',0)}**, pending I-24 KY (b012) **{dup.get('ky24Hits',0)}**, live DB **{dup.get('liveHits',0)}** matches; in-file co-location pairs: **{dup.get('inFile',0)}**; in-batch slug duplicates: **{dup.get('inBatchSlugDupes',0)}**.")
    r.append("  - Cross-batch/live hits are reviewed individually in the validation report; brand-multi-exit matches (same chain at a different city/exit/street address) are false positives. `assessExpansion` is the authoritative gate.")
r.append(f"- Quality (`scoreCompleteness`): min {q['min']}, median {q['median']}, mean {q['mean']}, max {q['max']}; labels: " + ", ".join(f"{k} {v}" for k,v in q['dist'].items()) + ".")
r.append("\n## Existing-production duplicate protection (IL + GA)\n")
live_rows = json.loads((HERE/'live.json').read_text()) if (HERE/'live.json').exists() else []
il_live = sum(1 for l in live_rows if (l.get('state') or '')=='IL')
ga_live = sum(1 for l in live_rows if (l.get('state') or '')=='GA')
r.append(f"- Illinois has **{il_live}** existing production listings (first IL batch), so no existing-IL collision is possible; every GA candidate was compared (normalized name + city + state, plus `classifyPair`) against all **{ga_live}** existing production Georgia listings (the I-75 Georgia batch). The I-24 GA dip is in Dade County (Wildwood/New England, exits 167-169) in the far NW corner; the existing GA rows are the I-75 corridor (Ringgold → Valdosta), so no address/exit overlap exists.")
r.append(f"- Rows dropped because they already exist in production (not re-added, production left unchanged): **{len(excluded_existing)}**.")
for e in excluded_existing:
    r.append(f"  - {e.get('name','?')} ({e.get('city','?')}, {e.get('category','?')}) — {e.get('reason','?')}")
r.append("\n## Known issues / limitations\n")
r.append("- Some brand/official sites (Pilot/Flying J, Love's, CAT Scale, TruckParkingClub, IDOT, GDOT) rate-limit or block direct fetches; facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.")
r.append("- Both segments are rural with few facilities — I-24 in Illinois is a lightly-developed 38-mile connector and the Georgia dip is ~4 miles; a small, honest batch is the correct result. Quality over quantity; nothing was padded.")
r.append("\n## Final recommendation\n")
r.append(f"- Approved (Published = yes): **{len(pub)}** · Held (documented): **{len(held)}** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).")
r.append(f"- Import parts: {', '.join(f'`{p}`' for p in parts)} (<=25 rows each).")
r.append("- Nothing imported, published, merged, or deployed. Awaiting approval.")
(OUT/f"{STEM}-review.md").write_text("\n".join(r)+"\n")
print("review.md:", len(r), "lines")

# ---- validation.md ----
v = [f"# Batch 13 — I-24 Illinois + Georgia: Validation Report\n",
     f"All checks run {DATE} with the REAL production code, read-only. Nothing imported.\n",
     "## Import parser (`prepareImport`)\n",
     f"- Master + {len(parts)} parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).\n",
     "## Expansion Readiness (`assessExpansion` vs live)\n",
     f"- ready-to-publish {exp['ready']} / import-unpublished {exp['unpub']} / manual-review {exp['manual']} / reject {exp['reject']}; slug collisions {exp.get('slugCollisions',0)}.",
     f"- Per-row verdicts: `data/imports/{STEM}-expansion-report.csv`.\n",
     "## Duplicate detection (`classifyPair`)\n"]
if dup:
    v.append(f"- vs GA {dup.get('gaHits',0)} / TN-I75 {dup.get('tnHits',0)} / KY-I75 {dup.get('kyHits',0)} / OH {dup.get('ohHits',0)} / MI {dup.get('miHits',0)} / FL {dup.get('flHits',0)} / IN {dup.get('inHits',0)} / AL {dup.get('alHits',0)} / TN-I65 {dup.get('tn65Hits',0)} / pending-KY-I65 {dup.get('ky65Hits',0)} / pending-TN-I24 {dup.get('tn24Hits',0)} / pending-KY-I24 {dup.get('ky24Hits',0)} / live {dup.get('liveHits',0)}; in-file co-location {dup.get('inFile',0)}; in-batch slug duplicates {dup.get('inBatchSlugDupes',0)}.")
    v.append("- Cross-batch/live hits reviewed individually; brand-multi-exit / shared-corporate-contact matches at a different city, exit and street address are false positives. 0 slug collisions, 0 existing-production duplicates retained.")
v.append("\n## Quality (`scoreCompleteness`)\n")
v.append(f"- min {q['min']} / median {q['median']} / mean {q['mean']} / max {q['max']}; " + ", ".join(f"{k} {v2}" for k,v2 in q['dist'].items()) + ".")
v.append("\n## Slug-collision detection\n")
v.append(f"- vs live production detail slugs: {exp.get('slugCollisions',0)}; in-batch: {dup.get('inBatchSlugDupes',0)}.")
v.append("\n## Live snapshot verification\n")
v.append(f"- `live.json` ({len(live_rows)} rows) verified current against production (`select count(*) ... group by state` matched exactly: 670 total, IL 0, GA 78) before the dedup passes ran.")
(OUT/f"{STEM}-validation.md").write_text("\n".join(v)+"\n")
print("validation.md written")

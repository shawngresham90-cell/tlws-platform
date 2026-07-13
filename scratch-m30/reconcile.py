#!/usr/bin/env python3
"""M28 reconcile: merge research-*.json into the master CSV + parts + listings.json.

Reads every scratch-m28/research-*.json (the 6 geographic segments),
canonicalizes, de-duplicates within the batch, validates categories against the
production taxonomy, and emits the exact 32-column import CSV plus <=25-row
parts and a listings.json for the report builders. Never invents data: blank
stays blank; anything an agent held (published=no) stays held with its reason.

Generic machinery only — any Indiana-specific cross-agent merges are added to
STATE_MERGES after inspecting the in-file duplicate report (assess-m28), so no
merge is applied blind.
"""
import csv, io, json, glob, re, sys
from pathlib import Path
from collections import Counter

HERE = Path(__file__).parent
REPO = HERE.parent
STEM = "i65-tennessee-batch-009"
STATE = "TN"
INTERSTATE = "I-65"

CATEGORIES = {"Truck Stops","Truck Parking","CAT Scales","Tire Repair",
              "Truck Washes","Hotels with Truck Parking","Roadside Service","Weigh Stations"}

HEADER = ["Business Name","Category","Address","City","State","ZIP","Latitude","Longitude",
          "Phone","Website","Description","Truck Spaces","Free Parking","Paid Parking",
          "Reserved Parking","Overnight Parking","Showers","Food","Fuel","Laundry","Restrooms",
          "Repair","CAT Scale","WiFi","Security","TruckParkingClub URL","Affiliate Code",
          "Image URL","Interstate","Exit Number","Published","Featured"]

def yn(v):
    return "yes" if str(v).strip().lower() in ("yes","true","y","1") else ""

def norm_name(s):
    return re.sub(r"\s+"," ", re.sub(r"[^a-z0-9]+"," ", (s or "").lower())).strip()

def amen_has(l, key):
    ams = l.get("amenities") or []
    if isinstance(ams, list):
        return any((a or "").strip().lower().replace("-","").replace(" ","") == key for a in ams)
    return False

# ---- load research files ----
listings, excluded = [], []
for f in sorted(glob.glob(str(HERE/"research-seg*.json"))):
    try:
        data = json.load(open(f))
    except Exception as e:
        print(f"WARN: could not parse {f}: {e}", file=sys.stderr); continue
    seg = Path(f).stem
    for l in data.get("listings", []):
        l["agent"] = seg
        listings.append(l)
    for e in data.get("excluded", []):
        e["_from"] = Path(f).name
        excluded.append(e)

# ---- normalize parking fields (two agent key-styles → the four CSV booleans) ----
# Some agents emitted parking_free + free-text parking_type; others emitted the
# free_parking/paid_parking/reserved_parking/overnight_parking booleans directly.
# Map both into the booleans reconcile reads. NEVER infer Overnight from truck-space
# presence or parking_type — only an explicit overnight_parking=yes counts, per the
# conservative rest-area/overnight rule.
def _isyes(v): return str(v).strip().lower() in ("yes","true","y","1")
for l in listings:
    # published may arrive as a JSON boolean (true/false) or a string — canonicalize
    # to the "yes"/"no" strings every downstream check expects.
    pub_raw = l.get("published")
    l["published"] = "yes" if (pub_raw is True or (not isinstance(pub_raw, bool) and _isyes(pub_raw))) else "no"
    pt = (l.get("parking_type") or "").lower()
    if _isyes(l.get("parking_free")) or "free" in pt:
        l["free_parking"] = "yes" if (_isyes(l.get("free_parking")) or _isyes(l.get("parking_free")) or "free" in pt) else l.get("free_parking","")
    if "paid" in pt and not _isyes(l.get("paid_parking")):
        l["paid_parking"] = "yes"
    if ("reserv" in pt) and not _isyes(l.get("reserved_parking")):
        l["reserved_parking"] = "yes"
    # overnight_parking left exactly as the agent set it — never derived here.

# ---- canonicalize + validate + dedup (store-number, then name-prefix key) ----
seen, rows, bad_category = {}, [], []
for l in listings:
    name = (l.get("name") or "").strip()
    city = (l.get("city") or "").strip()
    state = (l.get("state") or STATE).strip() or STATE
    cat = (l.get("category") or "").strip()
    l["state"] = state
    if not name:
        continue
    if cat not in CATEGORIES:
        bad_category.append({"name":name,"category":cat})
        continue  # category is never guessed — drop from CSV, recorded for the report
    # Conservative dedup: a store number (#34, #920) uniquely IDs a facility
    # within a category + city; otherwise key on the FULL normalized name + city
    # so distinct same-brand facilities in one city (multiple TPC lots, NB/SB
    # rest areas / weigh stations, two TA service shops in Gary) stay separate.
    # Cross-agent variants that survive here are caught by the identical-address
    # second pass and the production import-key final pass.
    m = re.search(r"#(\d{2,4})", name)
    if m:
        key = (cat, norm_name(city), "num", m.group(1))
    else:
        key = (cat, norm_name(city), norm_name(name))
    if key in seen:
        prev = seen[key]
        prev.setdefault("_dupes", []).append(name)
        def filled(x): return sum(1 for v in x.values() if isinstance(v,str) and v.strip())
        if filled(l) > filled(prev):
            l["_dupes"] = prev.get("_dupes", [])
            l["sources"] = list(dict.fromkeys((l.get("sources") or []) + (prev.get("sources") or [])))
            seen[key] = l
            rows[rows.index(prev)] = l
        continue
    seen[key] = l
    rows.append(l)

# ---- second-pass dedup: same category + identical (non-blank) street address ----
# Co-location always differs in CATEGORY (truck stop vs its CAT scale share an
# address but not a category), so keying on (category, address) never merges a
# legitimate co-located service.
addr_seen = {}
for l in list(rows):
    a = re.sub(r"[^a-z0-9]+", " ", (l.get("address") or "").lower()).strip()
    if not a:
        continue
    k = (l.get("category"), a)
    if k in addr_seen:
        prev = addr_seen[k]
        prev.setdefault("sources", [])
        for s in (l.get("sources") or []):
            if s not in prev["sources"]:
                prev["sources"].append(s)
        prev.setdefault("_dupes", []).append(l["name"])
        rows.remove(l)
    else:
        addr_seen[k] = l

# ---- Indiana-specific cross-agent merges (filled after in-file dup review) ----
# Each entry: (drop_name_exact, canon_name_substring). Confirmed same physical
# facility; union sources, back-fill blank fields on the canonical row.
STATE_MERGES = []  # filled only after inspecting the in-file duplicate report (assess-m30)
_BACKFILL = ["address","zip","phone","website","exit_number","description","tpc_url"]
for drop_name, canon_sub in STATE_MERGES:
    canon = next((l for l in rows if canon_sub in (l.get("name") or "")), None)
    if not canon:
        continue
    for d in [l for l in list(rows) if (l.get("name") or "") == drop_name]:
        canon.setdefault("sources", [])
        for s in (d.get("sources") or []):
            if s not in canon["sources"]:
                canon["sources"].append(s)
        for fld in _BACKFILL:
            if not (canon.get(fld) or "").strip() and (d.get(fld) or "").strip():
                canon[fld] = d[fld]
        canon.setdefault("_dupes", []).append(d["name"])
        rows.remove(d)

# ---- weigh-station safety hold ----
# Weigh/inspection stations are held (published=no) unless they carry BOTH a
# verified street address AND at least one official/government source. Highway
# coops without a civic address stay unpublished with a documented reason.
def _is_official(src):
    s = (src or "").lower()
    return any(d in s for d in ("tn.gov", "tdot", "tennessee.gov", ".gov", "dot.tn.gov", "thp"))
for l in rows:
    if l.get("category") != "Weigh Stations":
        continue
    has_addr = bool((l.get("address") or "").strip())
    has_official = any(_is_official(s) for s in (l.get("sources") or []))
    if not (has_addr and has_official):
        l["published"] = "no"
        if not (l.get("hold_reason") or "").strip():
            l["hold_reason"] = ("Weigh/inspection station held pending an official TDOT/THP source with a "
                                "civic street address and confirmed direction/facility identity; corroborated "
                                "via aggregated truck directories only — confirm before publishing.")

# ---- rest-area / welcome-center conservative hold ----
# Per the M29 spec, public rest areas and welcome centers are held unless BOTH a
# location (civic address OR verified mile marker in the description) AND an
# official TDOT/state source confirm the facility and its legal overnight status.
# Overnight parking is never assumed merely from the presence of truck spaces.
import re as _re
for l in rows:
    nm = (l.get("name") or "")
    if not _re.search(r"rest area|welcome center|weigh[- ]?station", nm, _re.I):
        continue
    if l.get("category") == "Weigh Stations":
        continue  # already handled above
    has_addr = bool((l.get("address") or "").strip())
    has_official = any(_is_official(s) for s in (l.get("sources") or []))
    if not (has_addr and has_official):
        l["published"] = "no"
        if not (l.get("hold_reason") or "").strip():
            l["hold_reason"] = ("Public rest area / welcome center held pending an official TDOT source "
                                "confirming direction, mile marker/exit and legal overnight truck parking; "
                                "overnight status not assumed from truck-space presence alone.")

# ---- final pass: production import key (name + city + state, category-agnostic) ----
# The live importer (importDupKey) dedups on name+city+state IGNORING category.
# When two rows collide, keep the most-complete; if it is a branded service shop,
# normalize to the corridor's "Tire Repair" convention (TA Truck Service / Love's
# Truck Care / Speedco are filed as Tire Repair throughout GA/TN/KY/OH/MI/FL).
def _filled(x): return sum(1 for v in x.values() if isinstance(v, str) and v.strip())
TIRE_BRANDS = ("TA Truck Service", "Love's Truck Care", "Speedco")
imp_seen = {}
for l in list(rows):
    k = (norm_name(l.get("name")), norm_name(l.get("city")), norm_name(l.get("state") or STATE))
    if k in imp_seen:
        prev = imp_seen[k]
        keep, drop = (prev, l) if _filled(prev) >= _filled(l) else (l, prev)
        keep.setdefault("sources", [])
        for s in (drop.get("sources") or []):
            if s not in keep["sources"]:
                keep["sources"].append(s)
        keep.setdefault("_dupes", []).append(drop.get("name"))
        if any(b in (keep.get("name") or "") for b in TIRE_BRANDS):
            keep["category"] = "Tire Repair"
        if keep is l and prev in rows:
            rows[rows.index(prev)] = l
        imp_seen[k] = keep
        if drop in rows:
            rows.remove(drop)
    else:
        imp_seen[k] = l

# ---- existing-production Tennessee exclusion pass ----
# Production already contains the I-75 Tennessee listings. Drop any batch row
# whose production import key (normalizeText(name)|normalizeText(city)|STATE)
# already exists live, so this batch never re-lists a business already in
# production. Dropped rows are recorded (excluded_existing.json) for the review.
# A different interstate serving the same property is NOT a reason to re-add it.
excluded_existing = []
_live_path = HERE / "live.json"
if _live_path.exists():
    live = json.load(open(_live_path))
    live_tn_keys = {
        (norm_name(l.get("name")), norm_name(l.get("city")))
        for l in live if (l.get("state") or "").upper() == STATE
    }
    for l in list(rows):
        k = (norm_name(l.get("name")), norm_name(l.get("city")))
        if k in live_tn_keys:
            excluded_existing.append({
                "name": l.get("name", ""), "city": l.get("city", ""),
                "category": l.get("category", ""),
                "reason": "Already present in production among the existing Tennessee listings "
                          "(same normalized name + city); not re-added. Classified: exact/probable "
                          "existing-TN duplicate — confirm against the live row before any future change.",
            })
            rows.remove(l)
else:
    print("WARN: scratch-m30/live.json missing — existing-TN exclusion pass skipped", file=sys.stderr)

# ---- write master CSV ----
def row_to_csv(l):
    ts = l.get("truck_spaces")
    ts = str(ts) if isinstance(ts,(int,float)) and ts not in (None,"") else (str(ts).strip() if isinstance(ts,str) and ts.strip().isdigit() else "")
    pub = "yes" if str(l.get("published","")).strip().lower()=="yes" else "no"
    return [
        l.get("name","").strip(), l.get("category","").strip(), (l.get("address") or "").strip(),
        l.get("city","").strip(), (l.get("state",STATE) or STATE).strip(), (l.get("zip") or "").strip(),
        "", "",  # Latitude, Longitude always blank
        (l.get("phone") or "").strip(), (l.get("website") or "").strip(), (l.get("description") or "").strip(), ts,
        yn(l.get("free_parking")), yn(l.get("paid_parking")), yn(l.get("reserved_parking")),
        yn(l.get("overnight_parking")),
        yn(amen_has(l,"showers")), yn(amen_has(l,"food")), yn(amen_has(l,"fuel")),
        yn(amen_has(l,"laundry")), yn(amen_has(l,"restrooms")), yn(amen_has(l,"repair")),
        yn(amen_has(l,"catscale")), yn(amen_has(l,"wifi")), yn(amen_has(l,"security")),
        (l.get("tpc_url","") or "").strip(),
        "", "",  # Affiliate Code, Image URL
        (l.get("interstate",INTERSTATE) or INTERSTATE).strip(), (l.get("exit_number","") or "").strip(),
        pub, "no",
    ]

buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
w.writerow(HEADER)
for l in rows:
    w.writerow(row_to_csv(l))
(REPO/"data"/"imports"/f"{STEM}.csv").write_text(buf.getvalue())

# ---- parts (<=25) ----
data_rows = buf.getvalue().strip().split("\n")[1:]
parts = [data_rows[i:i+25] for i in range(0,len(data_rows),25)]
part_names = []
for n,chunk in enumerate(parts,1):
    b = io.StringIO(); ww = csv.writer(b, lineterminator="\n"); ww.writerow(HEADER)
    b.write("\n".join(chunk)+"\n")
    name = f"{STEM}-part{n}.csv"
    (REPO/"data"/"imports"/name).write_text(b.getvalue())
    part_names.append(name)

# ---- listings.json / excluded.json for report builders ----
def norm_listing(l):
    return {
        "name": l.get("name","").strip(), "category": l.get("category","").strip(),
        "city": l.get("city","").strip(), "state": (l.get("state",STATE) or STATE).strip(),
        "address": (l.get("address") or "").strip(), "zip": (l.get("zip") or "").strip(),
        "phone": (l.get("phone") or "").strip(), "website": (l.get("website") or "").strip(),
        "exit_number": (l.get("exit_number","") or "").strip(), "tpc_url": (l.get("tpc_url","") or "").strip(),
        "published": "yes" if str(l.get("published","")).strip().lower()=="yes" else "no",
        "publish_reason": (l.get("hold_reason","") or "").strip(),
        "amenities": l.get("amenities", []),
        "sources": l.get("sources", []), "corroboration": (l.get("corroboration","") or "").strip(),
        "agent": l.get("agent","?"), "dupes": l.get("_dupes", []),
    }
(HERE/"listings.json").write_text(json.dumps([norm_listing(l) for l in rows], indent=1))
(HERE/"excluded.json").write_text(json.dumps(excluded, indent=1))
(HERE/"excluded_existing.json").write_text(json.dumps(excluded_existing, indent=1))
(HERE/"bad_category.json").write_text(json.dumps(bad_category, indent=1))

cats = Counter(l.get("category") for l in rows)
pub = sum(1 for l in rows if str(l.get("published","")).strip().lower()=="yes")
print(json.dumps({
    "total": len(rows), "published": pub, "held": len(rows)-pub,
    "by_category": dict(cats), "parts": part_names, "excluded": len(excluded),
    "excluded_existing_tn": len(excluded_existing),
    "bad_category_dropped": len(bad_category),
}, indent=2))

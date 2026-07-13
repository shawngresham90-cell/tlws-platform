#!/usr/bin/env python3
"""Batch 15 reconcile (I-40 Arkansas): merge seg*.json (agent output) into the
master CSV + <=25-row parts + listings.json. Same proven machinery as prior
batches; only the loader is adapted to this batch's agent output shape
(included/held/excluded, business_name, category slug, boolean amenity fields).

Never invents data: blank stays blank; held rows (published=false) stay held
with their reason. Coordinates always blank (geocoding is separate).
"""
import csv, io, json, glob, re, sys
from pathlib import Path
from collections import Counter

HERE = Path(__file__).parent
REPO = HERE.parent
STEM = "i40-arkansas-batch-015"
STATE = "AR"
STATES = ("AR",)
INTERSTATE = "I-40"

CATEGORIES = {"Truck Stops","Truck Parking","CAT Scales","Tire Repair",
              "Truck Washes","Hotels with Truck Parking","Roadside Service","Weigh Stations"}

SLUG2TITLE = {
    "truck-stops":"Truck Stops","parking":"Truck Parking","cat-scales":"CAT Scales",
    "tire-repair":"Tire Repair","truck-washes":"Truck Washes",
    "hotels-truck-parking":"Hotels with Truck Parking","roadside-service":"Roadside Service",
    "weigh-stations":"Weigh Stations",
}
AMENITY_FIELDS = [("showers","Showers"),("food","Food"),("fuel","Fuel"),("laundry","Laundry"),
                  ("restrooms","Restrooms"),("repair","Repair"),("cat_scale","CAT Scale"),
                  ("wifi","Wi-Fi"),("security","Security")]

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

def _title_for(cat):
    c = (cat or "").strip()
    if c in CATEGORIES:
        return c
    return SLUG2TITLE.get(c.lower(), c)

# ---- load agent research files (my format: included/held/excluded) ----
listings, excluded = [], []
for f in sorted(glob.glob(str(HERE/"seg*.json"))):
    try:
        data = json.load(open(f))
    except Exception as e:
        print(f"WARN: could not parse {f}: {e}", file=sys.stderr); continue
    seg = Path(f).stem
    for src in ("included", "held"):
        for l in data.get(src, []):
            nl = {
                "name": (l.get("business_name") or l.get("name") or "").strip(),
                "category": _title_for(l.get("category")),
                "address": l.get("address") or "",
                "city": l.get("city") or "",
                "state": (l.get("state") or STATE) or STATE,
                "zip": l.get("zip") or "",
                "phone": l.get("phone") or "",
                "website": l.get("website") or "",
                "description": l.get("description") or "",
                "truck_spaces": l.get("truck_spaces"),
                "free_parking": l.get("free_parking"),
                "paid_parking": l.get("paid_parking"),
                "reserved_parking": l.get("reserved_parking"),
                "overnight_parking": l.get("overnight_parking"),
                "amenities": [title for (k, title) in AMENITY_FIELDS if bool(l.get(k))],
                "tpc_url": l.get("tpc_url") or "",
                "interstate": l.get("interstate") or INTERSTATE,
                "exit_number": l.get("exit_number") or "",
                "published": l.get("published"),
                "hold_reason": l.get("hold_reason") or "",
                "sources": l.get("sources") or [],
                "corroboration": l.get("corroboration") or "",
                "agent": seg,
            }
            listings.append(nl)
    for e in data.get("excluded", []):
        e["_from"] = Path(f).name
        excluded.append(e)

def _isyes(v): return str(v).strip().lower() in ("yes","true","y","1")
for l in listings:
    pub_raw = l.get("published")
    l["published"] = "yes" if (pub_raw is True or (not isinstance(pub_raw, bool) and _isyes(pub_raw))) else "no"

# ---- canonicalize + validate + dedup (store-number, then full name key) ----
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
        continue
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

# ---- second-pass dedup: same category + identical street address ----
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

# ---- weigh-station + rest-area / welcome-center safety hold (TN official source) ----
def _is_official(src):
    s = (src or "").lower()
    return any(d in s for d in ("arkansas.gov", "ardot", ".gov", "asp.arkansas", "arkansashighways"))
for l in rows:
    nm = (l.get("name") or "")
    is_ws = l.get("category") == "Weigh Stations"
    is_ra = bool(re.search(r"rest area|welcome center|weigh[- ]?station", nm, re.I))
    if not (is_ws or is_ra):
        continue
    has_addr = bool((l.get("address") or "").strip())
    has_official = any(_is_official(s) for s in (l.get("sources") or []))
    if not (has_addr and has_official):
        l["published"] = "no"
        if not (l.get("hold_reason") or "").strip():
            l["hold_reason"] = ("Weigh station / rest area / welcome center held pending an official "
                                "ARDOT/AHP source with a civic street address confirming direction, "
                                "exit/mile marker and (for parking) legal overnight status; overnight "
                                "parking is never assumed from truck-space presence alone.")

# ---- final pass: production import key (name + city + state, category-agnostic) ----
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

# ---- existing-production Kentucky exclusion pass ----
excluded_existing = []
_live_path = HERE / "live.json"
if _live_path.exists():
    live = json.load(open(_live_path))
    live_keys = {
        (norm_name(l.get("name")), norm_name(l.get("city")), (l.get("state") or "").upper())
        for l in live if (l.get("state") or "").upper() in STATES
    }
    for l in list(rows):
        k = (norm_name(l.get("name")), norm_name(l.get("city")), (l.get("state") or "").upper())
        if k in live_keys:
            excluded_existing.append({
                "name": l.get("name", ""), "city": l.get("city", ""),
                "category": l.get("category", ""),
                "reason": "Already present in production among the existing listings for this state "
                          "(same normalized name + city); not re-added. A different interstate serving "
                          "the same property is not a reason to re-add it.",
            })
            rows.remove(l)
else:
    print("WARN: scratch-b13/live.json missing — existing-state exclusion pass skipped", file=sys.stderr)

# ---- write master CSV ----
def row_to_csv(l):
    ts = l.get("truck_spaces")
    ts = str(ts) if isinstance(ts,(int,float)) and ts not in (None,"") else (str(ts).strip() if isinstance(ts,str) and ts.strip().isdigit() else "")
    pub = "yes" if str(l.get("published","")).strip().lower()=="yes" else "no"
    return [
        l.get("name","").strip(), l.get("category","").strip(), (l.get("address") or "").strip(),
        l.get("city","").strip(), (l.get("state",STATE) or STATE).strip(), (l.get("zip") or "").strip(),
        "", "",
        (l.get("phone") or "").strip(), (l.get("website") or "").strip(), (l.get("description") or "").strip(), ts,
        yn(l.get("free_parking")), yn(l.get("paid_parking")), yn(l.get("reserved_parking")),
        yn(l.get("overnight_parking")),
        yn(amen_has(l,"showers")), yn(amen_has(l,"food")), yn(amen_has(l,"fuel")),
        yn(amen_has(l,"laundry")), yn(amen_has(l,"restrooms")), yn(amen_has(l,"repair")),
        yn(amen_has(l,"catscale")), yn(amen_has(l,"wifi")), yn(amen_has(l,"security")),
        (l.get("tpc_url","") or "").strip(),
        "", "",
        (l.get("interstate",INTERSTATE) or INTERSTATE).strip(), (l.get("exit_number","") or "").strip(),
        pub, "no",
    ]

buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
w.writerow(HEADER)
for l in rows:
    w.writerow(row_to_csv(l))
(REPO/"data"/"imports"/f"{STEM}.csv").write_text(buf.getvalue())

data_rows = buf.getvalue().strip().split("\n")[1:]
parts = [data_rows[i:i+25] for i in range(0,len(data_rows),25)]
part_names = []
for n,chunk in enumerate(parts,1):
    b = io.StringIO(); ww = csv.writer(b, lineterminator="\n"); ww.writerow(HEADER)
    b.write("\n".join(chunk)+"\n")
    name = f"{STEM}-part{n}.csv"
    (REPO/"data"/"imports"/name).write_text(b.getvalue())
    part_names.append(name)

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
    "excluded_existing": len(excluded_existing),
    "bad_category_dropped": len(bad_category),
}, indent=2))

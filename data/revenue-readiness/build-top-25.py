"""Build TOP-25-PROSPECTS.csv and SOURCING-QUEUE.csv from OUTREACH-CANDIDATES.csv.

Run from the repo root: python3 data/revenue-readiness/build-top-25.py

The two RAW strings below are snapshots of read-only queries against the live
directory (2026-07-26), reduced to flags. They deliberately contain no phone
number, email, or website URL — only whether we hold one — because this file
lives in a public repository. Re-run the queries in
docs/directory/crm-directory-inquiries.md terms if the data changes.

  FLAGS_RAW  <id8>:<P|-><W|-><I|-><B|-><amenity count>
             P = we hold a phone, W = we hold a website,
             I = locations.is_indexable (an unused manual override),
             B = is_published, then the amenity count.
  GATE_RAW   <id8>:<A|-><signal count>  — the deterministic indexability gate
             (isDetailIndexable): street address present, plus the number of
             substance signals. >= 2 signals with an address means the page can
             be indexed.
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from openings import OPENINGS  # noqa: E402


FLAGS_RAW = "096dd2fe:-W-B3 0a0c7a0d:-W-B8 0e24e007:P--B0 12fa9201:P--B3 27a1a923:-W-B0 28c41568:---B5 36d48fe4:PW-B8 38aadae7:PW-B0 3ec4da2b:-W-B1 4212adfe:P--B0 43a04cd8:-W-B1 469dadae:PW-B1 48f3af5a:P--B0 4be0bff5:PW-B1 4c1a72f9:-W-B1 4e347a10:P--B0 4e5234b6:-W-B1 50c54637:-W-B1 53bc511f:-W-B1 595de56a:-W-B1 5ad2354d:---B1 5b586188:P--B0 5ff9ec4c:PW-B0 605eb2aa:PW-B1 63337a0c:---B3 6bad6451:-W-B8 6da51cc0:PW-B1 738937f9:PW-B1 7c5326e4:-W-B1 7d2aff0a:---B2 7d74bb54:PW-B8 7dd25bf6:PW-B1 7de48d80:---B1 7f5d9778:-W-B0 7fd02b6b:PW-B1 85a4e108:PW-B1 8954f3e6:-W-B1 8bb903e1:-W-B2 8bf6630b:PW-B8 8e79a54d:PW-B1 8f2aedd7:PW-B1 910b954b:-W-B1 9659739b:PW-B1 9acc0450:P--B0 9f3e2546:-W-B1 b1a240d4:PW-B0 b25603ec:-W-B1 b329619c:-W-B0 b440672c:---B1 b621363d:PW-B8 b9f278be:---B0 be40a471:-W-B1 c46096bc:---B1 c8a6032f:---B1 ca06adc7:P--B0 cb0165c3:-W-B0 cd88c617:---B1 cf54cfb5:-W-B0 d4513e91:PW-B1 d6097cf6:PW-B0 d7bc6a17:-W-B0 e2d59ea7:P--B4 e808cd20:PW-B1 e945424b:P--B1 ebb8ad22:P--B7 ee7f6f07:P--B5 f12efc5b:---B3 f1d1bc65:PW-B1 f393fa83:P--B0 f4967041:---B0 f89415ea:P--B4 f972d0f0:P--B2 fa924e2a:PW-B0 fc04797c:---B3 fef1dd1a:PW-B1"

# Deterministic indexability gate (isDetailIndexable): street address + city +
# state, plus >= 2 of {phone, website, description >= 30 chars, >= 1 amenity,
# coordinates, parking spaces}. Measured, not assumed.
GATE_RAW = "096dd2fe:A4 0a0c7a0d:A4 0e24e007:A3 12fa9201:A5 27a1a923:A3 28c41568:A3 36d48fe4:A5 38aadae7:A4 3ec4da2b:A4 4212adfe:A3 43a04cd8:A4 469dadae:A5 48f3af5a:A3 4be0bff5:A5 4c1a72f9:A4 4e347a10:A3 4e5234b6:A4 50c54637:A4 53bc511f:A4 595de56a:A4 5ad2354d:A3 5b586188:A3 5ff9ec4c:A4 605eb2aa:A5 63337a0c:A3 6bad6451:A4 6da51cc0:A5 738937f9:A5 7c5326e4:A4 7d2aff0a:A3 7d74bb54:A5 7dd25bf6:A5 7de48d80:A3 7f5d9778:A3 7fd02b6b:A5 85a4e108:A5 8954f3e6:A4 8bb903e1:A4 8bf6630b:A5 8e79a54d:A5 8f2aedd7:A5 910b954b:A4 9659739b:A5 9acc0450:A3 9f3e2546:A4 b1a240d4:A4 b25603ec:A4 b329619c:A3 b440672c:A3 b621363d:A5 b9f278be:A2 be40a471:A4 c46096bc:A3 c8a6032f:A3 ca06adc7:A3 cb0165c3:A3 cd88c617:A3 cf54cfb5:A3 d4513e91:A5 d6097cf6:A4 d7bc6a17:A3 e2d59ea7:A4 e808cd20:A5 e945424b:A4 ebb8ad22:A4 ee7f6f07:A4 f12efc5b:A3 f4967041:A2 f1d1bc65:A5 f393fa83:A3 f89415ea:A5 f972d0f0:A5 fa924e2a:A4 fc04797c:A3 fef1dd1a:A5"
gate = {}
for tok in GATE_RAW.split():
    sid, g = tok.split(':')
    gate[sid] = {'has_address': g[0] == 'A', 'signals': int(g[1:])}

flags = {}
for tok in FLAGS_RAW.split():
    sid, f = tok.split(':')
    flags[sid] = {
        'has_phone': f[0] == 'P',
        'has_website': f[1] == 'W',
        'is_indexable': f[2] == 'I',
        'is_published': f[3] == 'B',
        'amenities': int(f[4:]),
    }

rows = list(csv.DictReader(open('data/revenue-readiness/OUTREACH-CANDIDATES.csv')))
assert len(rows) == 75, len(rows)

# Deterministic score. Every term is a fact we hold, not a guess about them.
INTENT = {
    'tire-repair': 5,          # bought at the moment of a blowout
    'roadside-service': 5,     # same, and the buyer is stationary
    'truck-washes': 3,         # planned, repeat, local
    'truck-stops': 3,          # independents only; chains are excluded upstream
    'cdl-schools': 2,          # different audience, longer cycle
    'parking': 2,              # often a landlord, not a marketer
    'cat-scales': 1,           # colocated at a host site; not its own advertiser
}

# Operators we already hold more than one published site for. Multi-site is an
# observation from our own data, not a claim about their size.
name_key = lambda n: n.split(' - ')[0].split(' #')[0].split(' (')[0].strip().lower()
counts = {}
for r in rows:
    counts[name_key(r['business_name'])] = counts.get(name_key(r['business_name']), 0) + 1

# Corporate travel-center brands. These are real, correctly-published listings —
# they are simply not prospects for a $99 local placement, because nobody at the
# site can buy one. Excluded from the outreach ranking with the reason recorded,
# never silently dropped.
import re
CHAIN_RE = re.compile(r'\b(TA|TA Express|Petro|TravelCenters of America)\b')

out = []
excluded = []
for r in rows:
    sid = r['listing_id'][:8]
    f = flags[sid]
    cat = r['rank_category']
    multi = counts[name_key(r['business_name'])] > 1
    score = INTENT.get(cat, 1)
    if r['corridor']:
        score += 2
    if r['exit_number']:
        score += 1
    if f['has_phone'] or f['has_website']:
        score += 2
    if f['has_phone']:
        score += 1
    if f['amenities'] >= 1:
        score += 1
    if multi:
        score += 1

    if f['has_phone'] and f['has_website']:
        confidence, channel = 'high', 'phone (number is on the listing)'
    elif f['has_phone']:
        confidence, channel = 'medium', 'phone (number is on the listing)'
    elif f['has_website']:
        confidence, channel = 'medium', 'website contact form (site is on the listing)'
    else:
        confidence, channel = 'low', 'manual sourcing queue — we hold no phone or site'

    # Second offer. Corridor sponsorship is one primary per corridor page, so it
    # is only suggested where a business plausibly wants the whole corridor:
    # a high-intent category, on a corridor, operating more than one site.
    if cat in ('tire-repair', 'roadside-service') and r['corridor'] and multi:
        offer, offer_why = 'corridor-sponsor', 'high-intent category, on a corridor, more than one site in our data'
    elif cat in ('tire-repair', 'roadside-service', 'truck-washes'):
        offer, offer_why = 'featured-listing', 'high-intent category page; featured sits above standard results'
    elif cat in ('truck-stops', 'parking'):
        offer, offer_why = 'featured-listing', 'destination listing; category and corridor pages are where drivers pick one'
    else:
        offer, offer_why = 'listing-claim only', 'claim is the right ask; placement is not a fit yet'

    billing = ('annual', 'multi-site operator — annual is the cheaper unit and matches a planned budget') if multi else \
              ('monthly', 'single site — monthly lets them stop after one month, which is the honest offer for an unproven directory')

    if CHAIN_RE.search(r['business_name']):
        excluded.append({
            'business_name': r['business_name'], 'city': r['city'], 'state': r['state'],
            'category': cat, 'directory_url': r['directory_url'],
            'excluded_reason': 'corporate travel-center brand — placement is not bought at the site',
        })
        continue

    out.append({
        'business_name': r['business_name'],
        'city': r['city'], 'state': r['state'],
        'category': cat, 'corridor': r['corridor'], 'exit_number': r['exit_number'],
        'directory_url': r['directory_url'],
        'category_page': r['category_page'], 'corridor_page': r['corridor_page'],
        'score': score,
        'first_ask': 'listing-claim (free)',
        'recommended_paid_offer': offer,
        'paid_offer_rationale': offer_why,
        'billing_recommendation': billing[0],
        'billing_rationale': billing[1],
        'category_corridor_value': '',
        'official_website': 'on listing' if f['has_website'] else 'to source',
        'public_phone': 'on listing' if f['has_phone'] else 'to source',
        'public_email': 'to source (we hold none)',
        'evidence_source': 'in-repo directory record (nationwide audit, PR #187) + live listing page',
        'confidence': confidence,
        'first_contact_channel': channel,
        'multi_site_in_our_data': 'yes' if multi else 'no',
        'opening_sentence': OPENINGS.get(sid, ''),
        'page_indexable': 'yes' if (gate[sid]['has_address'] and gate[sid]['signals'] >= 2) else 'no',
        'page_signals': gate[sid]['signals'],
        'listing_id': r['listing_id'],
    })

VALUE = {
    'tire-repair': 'Driver with a blown tire searches, calls the nearest listing, buys within the hour.',
    'roadside-service': 'Driver is already stopped and cannot move; the first callable listing wins the job.',
    'truck-washes': 'Planned, repeated spend; a driver washing on this corridor washes on it again.',
    'truck-stops': 'Independent competing against chains on the same corridor and exit pages.',
    'parking': 'Nightly parking search; the listing is the whole product.',
    'cdl-schools': 'Long cycle, different buyer, but a real budget for student acquisition.',
    'cat-scales': 'Colocated at a host site — the host is the advertiser, not the scale.',
}
for o in out:
    o['category_corridor_value'] = VALUE[o['category']]

out.sort(key=lambda o: (-o['score'], o['category'], o['state'], o['business_name']))
top = out[:25]
for i, o in enumerate(top, 1):
    o['rank'] = i

cols = ['rank', 'business_name', 'city', 'state', 'category', 'corridor', 'exit_number',
        'directory_url', 'category_page', 'corridor_page', 'first_ask',
        'recommended_paid_offer', 'paid_offer_rationale', 'billing_recommendation',
        'billing_rationale', 'category_corridor_value', 'official_website', 'public_phone',
        'public_email', 'evidence_source', 'confidence', 'first_contact_channel',
        'multi_site_in_our_data', 'opening_sentence', 'page_indexable', 'page_signals', 'score',
        'listing_id']

with open('data/revenue-readiness/TOP-25-PROSPECTS.csv', 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=cols)
    w.writeheader()
    for o in top:
        w.writerow({c: o[c] for c in cols})

with open('data/revenue-readiness/EXCLUDED-FROM-OUTREACH.csv', 'w', newline='') as fh:
    ecols = ['business_name', 'city', 'state', 'category', 'directory_url', 'excluded_reason']
    w = csv.DictWriter(fh, fieldnames=ecols)
    w.writeheader()
    for e in sorted(excluded, key=lambda e: (e['state'], e['business_name'])):
        w.writerow(e)

with open('data/revenue-readiness/SOURCING-QUEUE.csv', 'w', newline='') as fh:
    qcols = ['business_name', 'city', 'state', 'category', 'corridor', 'directory_url',
             'score', 'what_to_source', 'where_to_look']
    w = csv.DictWriter(fh, fieldnames=qcols)
    w.writeheader()
    for o in sorted([o for o in out if o['confidence'] == 'low'], key=lambda o: -o['score']):
        w.writerow({
            'business_name': o['business_name'], 'city': o['city'], 'state': o['state'],
            'category': o['category'], 'corridor': o['corridor'],
            'directory_url': o['directory_url'], 'score': o['score'],
            'what_to_source': 'official website, public phone',
            'where_to_look': "the business's own site or its own verified profile — not a scraped aggregator",
        })

print('excluded (chain):', len(excluded))
print('sourcing queue:', sum(1 for o in out if o['confidence'] == 'low'))

print('top25 categories:', {c: sum(1 for o in top if o['category'] == c) for c in sorted(set(o['category'] for o in top))})
print('corridors:', {c or 'none': sum(1 for o in top if (o['corridor'] or 'none') == (c or 'none')) for c in sorted(set(o['corridor'] for o in top))})
print('states:', {c: sum(1 for o in top if o['state'] == c) for c in sorted(set(o['state'] for o in top))})
print('offers:', {c: sum(1 for o in top if o['recommended_paid_offer'] == c) for c in sorted(set(o['recommended_paid_offer'] for o in top))})
print('billing:', {c: sum(1 for o in top if o['billing_recommendation'] == c) for c in sorted(set(o['billing_recommendation'] for o in top))})
print('confidence:', {c: sum(1 for o in top if o['confidence'] == c) for c in sorted(set(o['confidence'] for o in top))})
print('score range:', top[-1]['score'], '-', top[0]['score'])
print('needs sourcing in top25:', sum(1 for o in top if o['confidence'] == 'low'))
print('needs sourcing in all 75:', sum(1 for o in out if o['confidence'] == 'low'))

"""Personalized opening sentences for the top-25 launch list.

Read by build-top-25.py and written into TOP-25-PROSPECTS.csv.

Every sentence is built from something we actually hold about the listing — its
corridor, its exit, its category, or another listing of ours at the same site or
the same operator. None of them claims traffic, ranking, leads, or results, and
none of them invents a fact about the business. Keyed by the first 8 characters
of the listing id.
"""

OPENINGS = {
    # Snider Fleet Solutions — three sites in our data (Florence, Savannah,
    # Chattanooga), two of them on I-95. One conversation, not three.
    '9659739b': "You've got three locations on our directory — Florence, Savannah and Chattanooga — and two of them sit on the I-95 pages, so I'd rather have one conversation with you than three.",
    '7fd02b6b': "Your Savannah branch is on our I-95 tire pages alongside your Florence one, so this is the same conversation for both.",
    # Colony Tire — Rocky Mount NC and Emporia VA, both on I-95, one state apart.
    '469dadae': "You and your Emporia store are both on our I-95 tire pages, one state apart — Rocky Mount at Exit 145 and Emporia at Exit 11.",
    '6da51cc0': "Emporia at Exit 11 and your Rocky Mount store at Exit 145 are both on our I-95 tire pages, so one conversation covers both.",
    # Southern Tire Mart — #165 Atlanta and #230 Knoxville.
    'f1d1bc65': "Your Fulton Industrial store and your Knoxville #230 store are both on our tire pages, so I'd rather talk to you once about both.",
    '85a4e108': "Store #230 in Knoxville and your Atlanta #165 store are both on our tire pages — one conversation for the pair.",
    # Roadside, high intent.
    'e945424b': "You're the roadside repair listing on our I-40 page at Exit 216 in Brinkley — I built it from public information, so I'd rather you checked it than have me guess.",
    '8f2aedd7': "You're on our I-95 roadside page at Exit 87A in Jupiter, and I'd rather you told me the details than have me guess them.",
    '605eb2aa': "You're our on-site repair listing for the Gary stretch of I-65 — the one a driver looks for when the truck will not move.",
    '910b954b': "You're on our I-40 roadside page at Exit 287, one exit from Thompson Truck Group, and I'd like your details right before I talk to anyone about placement.",
    '50c54637': "Your Cookeville dealership is on our I-40 page at Exit 288, listed under roadside service — tell me if that is the wrong way to describe what you do.",
    # Tire repair.
    '738937f9': "You and Pat's Tire are both on our West Palm Beach I-95 tire page — I built both listings from public information and I want them right.",
    '7dd25bf6': "You and Martino are both on our West Palm Beach I-95 tire page, built from public information — can you check yours?",
    'd4513e91': "You're our Jacksonville I-95 tire listing, which is what a driver finds when a trailer tire goes on the way to the port.",
    '7c5326e4': "Your service centre is listed separately from the Kenly 95 plaza on our I-95 page at Exit 106 — worth checking I split those two correctly.",
    '8bb903e1': "You're our I-40 tire listing at Exit 44 in west Asheville, built from public information.",
    'fef1dd1a': "You're on our I-75 tire page for the Cincinnati stretch — I built the listing from public information, so I'd like you to check it.",
    '4be0bff5': "You're our I-75 tire listing north of Toledo, near the Hy-Miler and Barney's stops we also list.",
    'be40a471': "You're the I-95 tire listing at Exit 130 in Fredericksburg on our directory.",
    '3ec4da2b': "You're our I-40 tire listing in Hickory with 24-hour road service noted — I want to be sure that is still right.",
    # Independent truck stops.
    'f972d0f0': "You're one of the few independent truck stops we list on I-65 in Alabama, and your wash is listed separately at the same exit.",
    'f89415ea': "You're an independent on our I-75 page at Exit 84, sitting among a lot of chains — which is the whole reason drivers use a list like this.",
    'ee7f6f07': "You're on our I-95 page at Exit 76 in Midway, listed as an independent.",
    'e2d59ea7': "You're listed as Oasis Travel Center (Lakewood Landing) on our I-95 page at Exit 168 — tell me which name you would rather drivers see.",
    '12fa9201': "You're on our I-75 page at Exit 195 near Hy-Miler — I built the listing from public information and I want your hours right.",
}

"""Per-prospect commercial reason for the first-contact queue.

Each is a statement about the fit — the category's buying moment, the corridor's
measured depth, and anything we hold about the operator. None of them claims
traffic, results, or a figure about the business's own revenue. Keyed by the
first 8 characters of the listing id.
"""

REASONS = {
    'e945424b': 'Roadside repair on I-40 between Little Rock and Memphis. A driver looking for this is stationary and buying now — one job pays for months of placement, so the payback threshold is a single customer.',
    '910b954b': 'I-40 Exit 287 roadside, one exit from another listing of ours. Breakdown demand on our second-deepest corridor (240 published listings, 68 of them service businesses).',
    '50c54637': 'An International dealer service point at I-40 Exit 288. Larger service capacity than a one-truck operator and a real local marketing budget — but confirm on the call that Cookeville can buy its own placement rather than group marketing.',
    '8bb903e1': 'I-40 tire at Exit 44, west Asheville — the last commercial tire option we list before the Tennessee grade. Blowout demand, our second-deepest corridor.',
    'fef1dd1a': 'Cincinnati tire on I-75, our deepest corridor by a distance (404 published listings, 97 service businesses). Both a phone and a site on the listing, so outreach can start today.',
    '4be0bff5': 'I-75 tire north of Toledo, near two independent stops we also list. Deepest corridor in the directory and a reachable contact on the record.',
    '9659739b': 'Three sites in our data and two of them on I-95 — the only prospect in the queue where a single corridor sponsorship covers more than one location. Treat Florence and Savannah as one sale.',
    '8f2aedd7': 'Towing and recovery at I-95 Exit 87A. The buyer cannot move and picks the first callable listing; a single recovery job is worth many months of placement.',
    '605eb2aa': 'Mobile on-site repair on the Gary stretch of I-65 (162 published listings, 41 service businesses). On-site repair is the definition of buy-now demand.',
    '7fd02b6b': 'The second Snider site on I-95. Same conversation as Florence — do not pitch this one separately or you are selling the same corridor page twice.',
}

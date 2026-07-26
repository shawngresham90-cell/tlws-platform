"""Generate OUTREACH-FIRST-10.md from FIRST-10-QUEUE.csv.

Run from the repo root: python3 data/revenue-readiness/build-outreach.py

The per-prospect emails are generated rather than hand-written so the opening
sentence, the offer, the price and the attribution link can never drift from the
queue they came from. The shared assets — follow-up, phone script, objections,
voicemail, discovery checklist, post-call template — live once in
SALES-PLAYBOOK.md and are referenced, not duplicated.

NOTHING IS SENT BY THIS SCRIPT. It writes a markdown file. No phone number,
email address or website URL is written into it: this repository is public, and
the contact values live only in the gitignored local file.
"""

import csv
from pathlib import Path

SITE = 'truckinglifewithshawn.com'

# The approved prices, written once. If these ever disagree with
# src/lib/directory/offers.ts the pricing test in the app is the source of truth.
FEATURED = '$99 a month, or $999 a year'
CORRIDOR = '$299 a month, or $2,999 a year'

rows = list(csv.DictReader(open('data/revenue-readiness/FIRST-10-QUEUE.csv')))
assert len(rows) == 10, len(rows)

CATEGORY_PAGE = {
    'tire-repair': 'truck tire repair',
    'roadside-service': 'roadside service',
    'truck-washes': 'truck wash',
    'truck-stops': 'truck stop',
}

out = []
w = out.append

w('# Outreach kit — the first ten')
w('')
w('**Nothing here has been sent.** No email, no call, no DM, no form submission.')
w('This is copy waiting for approval.')
w('')
w('Generated from `FIRST-10-QUEUE.csv` by `build-outreach.py`, so the opening')
w('sentence, the offer, the price and the attribution link cannot drift from the')
w('queue. Regenerate rather than edit by hand.')
w('')
w('**Contact details are deliberately absent.** This repository is public. Each')
w("prospect's phone and website are on their own listing page and in the")
w('gitignored local file — open the directory URL and they are right there.')
w('')
w('Shared assets are in `SALES-PLAYBOOK.md` and are not repeated per prospect:')
w('the follow-up email, the DM template, the phone script, the seven objection')
w('responses, the voicemail script. The discovery-call checklist and the')
w('post-call follow-up template are at the bottom of this file.')
w('')
w('## Order of contact')
w('')
w('| # | Business | Category | Corridor | Offer to lead with | Contact |')
w('| --: | --- | --- | --- | --- | --- |')
for r in rows:
    offer = 'Corridor sponsor' if r['recommended_paid_offer'] == 'corridor-sponsor' else 'Featured listing'
    w(
        f"| {r['contact_order']} | {r['business_name']} | {r['category']} | "
        f"{r['corridor'] or '—'} | {offer} (second conversation) | {r['contact_status']} |"
    )
w('')
w('Every one of the ten opens with the **free claim**, never the price. The offer')
w('column is what to raise once they have replied and the listing is corrected.')
w('')
w('---')
w('')

for r in rows:
    n = r['contact_order']
    name = r['business_name']
    url = f"{SITE}{r['directory_url']}"
    link = f"{SITE}{r['attribution_link']}"
    cat_label = CATEGORY_PAGE.get(r['category'], r['category'])
    corridor = r['corridor']
    is_corridor_sale = r['recommended_paid_offer'] == 'corridor-sponsor'

    w(f'## {n}. {name}')
    w('')
    w(f"**{r['category']} · {r['state']}{' · ' + corridor if corridor else ''}**  ")
    w(f"Listing: `{url}`  ")
    w(f"Attribution link: `{link}`  ")
    w(f"Contact: {r['contact_status']} — {r['first_contact_channel']}")
    w('')
    w(f"**Why this one:** {r['commercial_reason']}")
    w('')
    w('### Claim email (send first)')
    w('')
    w('> **Subject:** Your listing on the Trucking Life truck stop directory')
    w('>')
    w(f'> Hi — I run Trucking Life with Shawn. We publish a directory drivers use to')
    w(f'> find truck stops, parking, scales, washes and repair along the interstates.')
    w('>')
    w(f'> {name} is on it: {url}')
    w('>')
    w(f"> {r['opening_sentence']}")
    w('>')
    w('> Hours, services, phone, anything wrong — tell me and I will fix it.')
    w('>')
    w('> Claiming it is free. There is a button on the page, or just reply. Nothing')
    w('> changes until I have reviewed it, and claiming does not commit you to')
    w('> anything.')
    w('>')
    w('> — Shawn')
    w('')

    if is_corridor_sale:
        w('### Corridor sponsor email (only after they have claimed)')
        w('')
        w(f'> **Subject:** Sponsoring the {corridor} pages')
        w('>')
        w(f'> Hi — thanks for getting {name} straightened out.')
        w('>')
        w(f'> I keep one primary sponsor per corridor. For {corridor} that slot is')
        w(f'> {CORRIDOR}, and it covers the corridor pages a driver browses when')
        w('> they are planning that run — not a single listing. It is labelled')
        w('> Sponsored, and the link out is tagged as a paid link.')
        w('>')
        w('> You have more than one location on that corridor with us, so this is one')
        w('> sponsorship covering all of them rather than separate placements.')
        w('>')
        w('> Same honesty as always: I am not going to quote you traffic. Measurement')
        w('> is still being set up and I would rather show you real figures later than')
        w('> a guess now. If you want to wait for that, that is the sensible call and')
        w('> I will come back to you.')
        w('>')
        w('> — Shawn')
        w('')
    else:
        w('### Featured listing email (only after they have claimed)')
        w('')
        w(f'> **Subject:** Featured placement on the {cat_label} page')
        w('>')
        w(f'> Hi — thanks for getting {name} straightened out.')
        w('>')
        w(f'> I have opened featured placement on the {cat_label}'
          f"{' and ' + corridor if corridor else ''} pages: a featured business sits")
        w('> above the standard results and is labelled Sponsored, so drivers can see')
        w(f'> exactly what it is. It is {FEATURED}. I run up to three per page, so it')
        w('> does not turn into a wall of ads.')
        w('>')
        w('> Straight answer on the part you will ask about: I am not going to quote')
        w('> you traffic. The measurement is still being set up and I would rather')
        w('> show you real numbers once they exist than sell you a guess.')
        w('>')
        w('> Month to month is fine — start, see nothing you like, stop.')
        w('>')
        w('> — Shawn')
        w('')
    w('---')
    w('')

w('## Discovery-call checklist')
w('')
w('Ten minutes, and the goal is to *disqualify fast* — a business that should not')
w('buy is a better outcome than one that buys and regrets it.')
w('')
w('- [ ] Confirm who you are speaking to and whether they can decide.')
w('- [ ] Confirm the listing is theirs and the details are right. Take corrections.')
w('- [ ] Ask what a new customer is worth to them. Do not tell them; let them say it.')
w('- [ ] Ask whether they advertise anywhere now, and whether it worked.')
w('- [ ] Explain what Sponsored means before they ask.')
w('- [ ] State the price plainly. Once. Do not repeat it nervously.')
w('- [ ] Say the honest thing about measurement before they ask for numbers.')
w('- [ ] Ask if they want it, or want to wait for figures. Accept "wait".')
w('- [ ] If yes: confirm monthly or annual, and the start date.')
w('- [ ] Agree the next step and a date. Write it in `next_action`.')
w('')
w('Disqualify — politely, on the call — if: they want a guarantee you cannot give;')
w('they want their competitor removed; they want to edit the listing themselves;')
w('they are a franchise with no local marketing budget; or the price is clearly a')
w('stretch. Leave the free listing in place and thank them.')
w('')
w('## Post-call follow-up template')
w('')
w('> **Subject:** What we agreed just now')
w('>')
w('> Hi — good to talk.')
w('>')
w('> Writing down what we said so neither of us has to remember it:')
w('>')
w('> • Your listing: [DIRECTORY URL]')
w('> • Corrections you gave me: [LIST]. I will make those and reply when done.')
w('> • Placement: [none / featured at $99 a month / featured at $999 a year /')
w('>   corridor at $299 a month / corridor at $2,999 a year]')
w('> • Runs from [START] to [END].')
w('> • It will be labelled Sponsored on the page.')
w('> • Cancel any time — monthly stops at the end of the month you have paid for;')
w('>   annual gets the unused whole months back.')
w('> • I have not promised you traffic, leads or results, and I am not going to.')
w('>')
w('> If any of that is wrong, tell me before I invoice.')
w('>')
w('> — Shawn')
w('')
w('Every line of that is a fact or a commitment about money. Nothing in it is a')
w('prediction about their business.')
w('')
w('## Rules for all ten')
w('')
w('- Nothing may be sent without separate approval.')
w('- Claim first. The price is the second conversation, always.')
w('- Never quote traffic, leads, ranking or results. There are none to quote.')
w('- Never say a listing is verified, claimed or featured when it is not.')
w('- One follow-up. Then stop.')
w('- Anyone who asks to be left alone is marked and never contacted again.')
w('- Anyone who asks for their listing to come down gets it taken down, with no')
w('  negotiation and no counter-offer.')

Path('data/revenue-readiness/OUTREACH-FIRST-10.md').write_text('\n'.join(out) + '\n')
print('wrote OUTREACH-FIRST-10.md —', len(out), 'lines,', len(rows), 'prospects')

# Data-access request — TA / Petro / TA Express

Draft for Shawn to send. **Not sent.** No business or agency has been contacted.

Send to TA's fleet / business services contact, or to the developer-portal
contact if one exists. Adjust the greeting once you know who owns it.

---

**Subject:** Location data request — trucking directory listing TA, Petro and TA Express

Hello,

I run Trucking Life With Shawn, a driver-facing website with a truck-stop and
truck-parking directory. We already list TA, Petro and TA Express locations, and
I want to make sure what we show drivers is accurate and current rather than
assembled from secondhand sources.

Could you point me to an official location export or API? Specifically I'm
looking for one national file, one row per site, with:

- site number or store ID (a stable identifier that doesn't change between updates)
- brand — TA, Petro, or TA Express, kept distinct
- name, street address, city, state, ZIP
- latitude and longitude
- truck parking spaces
- showers
- scales
- status (open / closed / temporarily closed)
- last updated

Any format works — CSV, Excel or JSON.

Three things I'd also want confirmed in writing:

1. **Redistribution terms** — what we may display, and how you want TA
   attributed.
2. **Update frequency** — how often the file changes, and whether a refresh can
   be pulled on a schedule.
3. **Closures** — whether the export includes closed sites with a status flag,
   or drops them. That determines how we detect a location going away.

The reason for the last one: our directory currently holds **387** TA-network
records against a reference list of **354**, so we have roughly thirty rows that
are either duplicates, closed sites, or locations that were never TA. I'd rather
correct those against your data than guess. Until then we are holding them
rather than publishing changes.

I'm happy to sign whatever agreement you need, and happy to attribute TA on
every listing. If the right route is a partnership or licensing conversation
rather than a file, I'm glad to have it.

Thanks,
Shawn Gresham
Trucking Life With Shawn
truckinglifewithshawn.com

---

## If they ask what we do with it

Straight answers, ready to give:

- **Display.** Location pages and corridor pages showing address, coordinates on
  a map, parking capacity, and amenities — attributed to TA.
- **We do not resell the data** or expose it as an API.
- **We do not claim overnight parking permission** unless the source states it.
- **We honour closures.** A closed site is unpublished, not silently deleted,
  and never on a single export's say-so alone.
- **Corrections flow back.** If we find a record that disagrees with theirs, we
  tell them rather than quietly patching it.

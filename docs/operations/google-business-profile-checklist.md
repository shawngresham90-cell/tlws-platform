# Google Business Profile checklist — owner actions (LOCAL-SEO-1)

A Google Business Profile (GBP) for **Trucking Life Academy** is the single
highest-leverage move for "CDL school Dalton GA" searches — it is what puts
the school in the map pack and on Google Maps, and no amount of on-site SEO
substitutes for it. Everything below is an OWNER action at
<https://business.google.com> — **nothing here is automated, and no code
deploy is involved.**

Two hard rules before starting:

1. **Only claim what is true today.** Every field below is split into
   "eligible now" (facts already established and published on the site) and
   "waiting" (facts not yet confirmed — leave those fields empty rather than
   guessing). Google suspends profiles over inconsistent or invented data,
   and a suspension takes weeks to appeal.
2. **Match the site exactly.** Name, address, and category consistency
   between GBP, the website, and future citations is the core local ranking
   signal. The site's authority for these facts is
   `src/lib/academy/program.ts` — if a fact changes, change it there first,
   then update GBP to match.

## 1. Create / claim the profile (eligible now)

| GBP field | Value to enter | Where the site asserts it |
| --- | --- | --- |
| Business name | `Trucking Life Academy` | `SITE.brand` / org schema `alternateName` |
| Primary category | `Truck driving school` | closest GBP category to the site's EducationalOrganization |
| Address | `1821 Wendell Street, Dalton, GA` | `ACADEMY_ADDRESS` in `src/lib/academy/program.ts`, visible on `/academy` and `/academy/facility` |
| Website | `https://truckinglifewithshawn.com/academy` | the primary Dalton landing page (not the homepage — send map-pack clicks straight to the money page) |
| Appointment / signup link | `https://truckinglifewithshawn.com/academy/apply` | the live application |
| Description | Use the program facts verbatim: CDL-A training, ELDT-compliant, tuition $3,995, weekend program begins October 2026 (Saturdays and Sundays, eight weekends), weekday program begins January 2027, manual 10-speed training, job-placement assistance (employment is not guaranteed). | `PROGRAM_SUMMARY`, `EQUIPMENT`, `PLACEMENT` |
| Opening date | The month you consider the school founded — only if you are sure. | not asserted in the repo |
| Social profiles | YouTube `@TruckingLifewithShawn`, Facebook `TruckingLifewithShawn`, TikTok `@truckinglifewithshawn` | `SITE.social`, org schema `sameAs` |
| Photos | Real photos of the facility, the tractor and 53-foot trailer, and Shawn. No stock photos. | `/academy/facility` imagery |

Verification will likely be by video or postcard at the street address.
Complete it promptly — an unverified profile does not rank.

## 2. Leave EMPTY for now (waiting — facts not established)

Do **not** fill these in until the fact is real and has been added to
`src/lib/academy/program.ts` first:

- **Phone number** — no phone is published anywhere on the site. Adding one
  to GBP but not the site (or vice versa) is the classic NAP mismatch.
  When a business line exists: add it to `program.ts`, render it on
  `/academy`, then add it to GBP the same day.
- **Business hours** — training hours are "to be announced" on
  `/academy/facility`. Empty is better than wrong; wrong hours earn
  "suggested edits" from strangers that Google may auto-apply.
- **ZIP code** — the site deliberately publishes the address without a ZIP
  because it is unconfirmed. GBP's address form will want one; confirm the
  real ZIP for 1821 Wendell Street before entering it, then add it to
  `program.ts` so the site can carry it too.
- **Attributes about licensing/registration** — nothing about Georgia DDS
  licensing or the FMCSA Training Provider Registry goes on the profile (or
  in posts, or in review replies) until that status is finalized and
  published on the site.

## 3. After the profile is live (ongoing, 15 minutes a week)

- **Reviews**: ask every graduate (and October's first cohort) for a Google
  review that mentions the town they drove from — "worth the drive from
  Calhoun" is local-ranking gold. Reply to every review as the owner.
- **Posts**: one GBP post when weekend enrollment milestones happen, one
  when the weekday program date firms up. Link `/academy/apply`.
- **Q&A**: seed the profile's Q&A with the same questions answered on
  `/academy` (cost, ELDT, experience needed, areas served) using the same
  answers — you can post and answer questions on your own profile.
- **Photos**: add a few real photos per month; profiles with fresh photos
  earn more map actions.

## 4. Related manual moves (separate from GBP, same goal)

- **FMCSA Training Provider Registry** — when the school is registered,
  its TPR listing is itself a citation; at that point the site may also say
  so (update `program.ts` + `/academy` first, per the truth guardrail).
- **Georgia DDS school license** — same rule: once granted, publish it on
  the site and GBP together.
- **Local citations** (only after GBP is verified, and always with the
  identical name/address): Dalton–Whitfield Chamber of Commerce directory,
  Better Business Bureau, Bing Places, Apple Business Connect, Yelp.
- **Local orgs**: Dalton State College workforce programs and the Northwest
  Georgia workforce board both maintain training-provider lists — a link
  from either is a strong, relevant local signal.

The site side of this milestone (LOCAL-SEO-1) is already done: `/academy`
is the Dalton landing page GBP should point at, the address on it matches
`program.ts`, and the organization schema carries the street address. This
checklist is the off-site half.

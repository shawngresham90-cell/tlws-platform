# YouTube Funnel — Owner Guide

How traffic flows between the channel and the site, and what to put in
video descriptions.

## Short links for descriptions (`/go/…`)

Every link below 302-redirects to the real page with
`utm_source=youtube&utm_medium=video&utm_campaign=<slug>` attached, so
arrivals from the channel segment cleanly in Plausible (Top Sources →
youtube; campaign = which link they clicked). They're short enough to say
on camera.

| Say / paste | Lands on |
| --- | --- |
| `truckinglifewithshawn.com/go/dot-guide` | DOT compliance guides |
| `…/go/hos` | Hours of Service guides |
| `…/go/parking` | Truck parking directory |
| `…/go/directory` | Directory hub |
| `…/go/tests` | Practice tests |
| `…/go/trip` | Trip Planner |
| `…/go/books` | Books |
| `…/go/preschool` | CDL Pre-School |
| `…/go/apply` | Academy application |
| `…/go/academy` | Academy |
| `…/go/founders` | Founders Wall |
| `…/go/sponsor` | Sponsor front door |
| `…/go/newsletter` | Homepage newsletter form |

A mistyped slug lands on the homepage — a viewer is never dead-ended.
Adding a new slug is one line in `src/lib/go-links.ts`.

## Suggested description block

```
🚛 Free driver tools:
Parking & truck stops: truckinglifewithshawn.com/go/parking
CDL practice tests:    truckinglifewithshawn.com/go/tests
Trip planner:          truckinglifewithshawn.com/go/trip
My books:              truckinglifewithshawn.com/go/books
Newsletter:            truckinglifewithshawn.com/go/newsletter
```

Pin the matching link in a comment on each video (e.g. a DOT-inspection
video pins `/go/dot-guide`).

## Site → channel touchpoints (already live)

- Homepage "From the Channel" section: three YouTube cards + TikToks +
  "Watch on YouTube" channel CTA.
- Footer: YouTube/Facebook/TikTok links plus a "Videos" link to the
  channel.
- All open in new tabs with safe rel attributes.

## Measuring it

Once `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set (see `analytics-setup.md`),
the Plausible dashboard shows youtube-sourced sessions per campaign slug,
and goals (newsletter signup, application started, test completed) can be
filtered to youtube traffic — that's your per-video conversion picture.

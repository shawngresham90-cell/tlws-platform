# Seven-day directory launch campaign

**Nothing here has been published, scheduled, or sent.** This is copy waiting for
Shawn's approval. No paid ad spend, no automation, no scarcity, no invented
numbers.

Three objectives, in order of how much they matter:

1. **Drivers use the directory and tell other drivers.** Without them the rest is
   worthless.
2. **Business owners claim their free listing.** Free, no catch, improves the
   data whether or not they ever pay.
3. **Independent shops ask about sponsored placement.** The revenue, and the
   last thing to mention, not the first.

---

## Attribution — how we will know what worked

Analytics is not switched on (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset and no
existing account could be proven), so page-level UTM data goes nowhere. What
*does* work is the funnel's own source line: any link to `/sponsors` carrying
`?from=<token>` writes **`Came from: <token>`** into the inquiry, and the admin
inbox shows it as a Source column. That is the campaign attribution for this
launch, and it is real.

Use these tokens. One per post, never reused:

| Post | Business-facing link |
| --- | --- |
| FB business post 1 | `/sponsors?from=fb-biz-1#inquire` |
| FB business post 2 | `/sponsors?from=fb-biz-2#inquire` |
| Reel 3 (owners) | `/sponsors?from=reel-3#inquire` |
| YT community 3 | `/sponsors?from=yt-3#inquire` |
| YT long-form read | `/sponsors?from=yt-video#inquire` |
| FB Live | `/sponsors?from=fb-live#inquire` |
| Pinned post | `/sponsors?from=pinned#inquire` |
| Stories | `/sponsors?from=story#inquire` |

Driver-facing links point at the directory itself and need no token — there is
nothing to attribute, because a driver is not a lead. If you want standard
`utm_source=facebook&utm_medium=social` on those, add it; just know that
**nothing records it yet**. Do not report a UTM number as if it were measured.

Every business-facing link is bounded server-side: the token is slugified and
capped, so a mistyped link degrades to no source rather than breaking.

---

## Day 1 — Monday

### Facebook post 1 (drivers)

> Seventeen years out here and I still can't tell you how many nights I've
> circled an exit looking for a legal place to park.
>
> So we built the thing I wanted: a directory of truck stops, parking, scales,
> washes, tire shops and roadside service, sorted by interstate and exit.
> Free, no login, works on a phone in the dark.
>
> 👉 truckinglifewithshawn.com/directory
>
> It's not finished. Some listings are thin, some hours are probably wrong. If
> you find one that's off, tell me and I'll fix it. That's the deal — you use
> it, I keep it honest.

### Story slides (drivers)

1. *"Looking for parking at 9pm again?"* — dark photo of a lot.
2. *"Truck stops, parking, scales, washes, repair. By interstate and exit."*
3. *"Free. No login. Works on a phone."* → swipe up to `/directory`
4. *"Found something wrong? Tell me. I'll fix it."*

---

## Day 2 — Tuesday

### Reel / TikTok 1 — "The 9pm problem" (20s, drivers)

> **[0–4s, cab at dusk]** "It's 9pm, you've got 30 minutes on the clock, and
> you don't know where you're parking."
>
> **[4–12s, phone screen scrolling the corridor page]** "This is every truck
> stop, rest area and paid lot we've got on I-75, by exit number."
>
> **[12–18s]** "Free. No app. No login."
>
> **[18–22s, to camera]** "If a listing's wrong, tell me and I'll fix it.
> Link's in the bio."

On-screen text: `truckinglifewithshawn.com/directory` · caption ends with
"What's the worst exit you've ever tried to park at?"

### YouTube community post 1 (drivers)

> New thing on the site: a truck stop and parking directory you can actually use
> from the cab. Sorted by interstate and exit — truck stops, parking, CAT
> scales, washes, tire shops, roadside service.
>
> It's free and there's no login. It's also incomplete, which is why I'm posting
> it here first: **tell me what's missing or wrong on your regular run** and I'll
> get it fixed.
>
> truckinglifewithshawn.com/directory

---

## Day 3 — Wednesday

### Facebook post 1 (business owners)

> If you run a truck shop, a wash, a tow truck or an independent stop — you're
> probably already on our directory.
>
> I built those listings from public information, which means some of them are
> wrong. Hours, services, phone numbers.
>
> **Claiming your listing is free.** You check it, I fix what's wrong, and it
> stays free. There's no account to make and nothing to buy.
>
> 👉 truckinglifewithshawn.com/sponsors?from=fb-biz-1#inquire
>
> Find your business at truckinglifewithshawn.com/directory and hit "Claim this
> listing", or just message me.

### Reel / TikTok 2 — "I probably got yours wrong" (25s, owners)

> **[0–5s, to camera]** "If you own a truck shop, I've probably already listed
> you. And I probably got something wrong."
>
> **[5–14s, showing a listing page]** "I built these from public information —
> hours, services, phone. No way that's all right."
>
> **[14–20s]** "Claiming your listing is free. You tell me what's wrong, I fix
> it. That's it."
>
> **[20–25s]** "Link in the bio. Nothing to buy."

---

## Day 4 — Thursday

### YouTube community post 2 (drivers)

> Question for the people who run I-95 regularly: where would you actually stop
> between Richmond and Savannah?
>
> We've got the exits listed here — truckinglifewithshawn.com/directory/i95 —
> but a list can't tell you which ones are worth it. Drop the good ones in the
> comments and I'll get them checked and added properly.

### Facebook post 2 (drivers)

> The directory now covers truck stops, parking, CAT scales, washes, tire
> repair, roadside service and CDL schools across the interstates.
>
> Three things it will never do:
> • Ask you to log in
> • Sell your location to anybody
> • Tell you a lot has parking when we don't actually know
>
> If we don't know, it says so. That's the whole point.
>
> truckinglifewithshawn.com/directory

---

## Day 5 — Friday

### Facebook Live outline (25 minutes)

*Title:* "The directory, and how I'd like your help with it"

| Minutes | Beat |
| --- | --- |
| 0–2 | Who's on, where you are, what today is about. |
| 2–6 | Screen share: find a stop on I-75 by exit. Do it slowly. |
| 6–10 | Show a thin listing. Say plainly it's thin and why. Ask for corrections. |
| 10–14 | Take three live comments and look their exits up on the spot. |
| 14–18 | **Owners:** claiming is free. What claiming does and does not do — it never hands over the listing, it means I've checked you represent the business. |
| 18–22 | **Paid placement, briefly and honestly:** featured $99/mo or $999/yr, up to three per page; corridor sponsor $299/mo or $2,999/yr, one per corridor. Labelled Sponsored. Say out loud: "I'm not going to quote you traffic — I don't have numbers worth quoting yet." |
| 22–25 | Where to send corrections. Pinned link. Thanks. |

Rules for the live: no traffic figures, no "limited spots", no promises about
results, and if someone asks how many people use it — "not many yet, that's the
honest answer, and I'd rather say that than make something up."

### Story slides (owners)

1. *"Own a truck shop? You're probably already listed."*
2. *"I built it from public info. Some of it's wrong."*
3. *"Claiming it is free."* → `/sponsors?from=story#inquire`
4. *"No account. Nothing to buy. Just tell me what's wrong."*

---

## Day 6 — Saturday

### Reel / TikTok 3 — "What Sponsored means" (30s, owners)

> **[0–6s, to camera]** "A few shops have asked what 'Sponsored' means on the
> directory. Here's the straight version."
>
> **[6–16s, showing a category page]** "If you pay, your listing sits at the top
> of its page — and it says Sponsored on it. Everybody can see you paid. That's
> deliberate."
>
> **[16–24s]** "Ninety-nine a month, up to three per page. Corridor sponsorship
> is separate. Claiming your listing is still free and always will be."
>
> **[24–30s]** "And no, I'm not going to tell you how much traffic it gets. I
> don't have a number I'd stand behind yet. Link's in the bio."

### YouTube community post 3 (owners)

> For the shop owners following along: the directory now has a paid option, and
> I want to be straight about what it is.
>
> • Claiming your listing: **free**, always.
> • Featured on your category or corridor page: **$99/month or $999/year**, up
>   to three businesses per page, labelled Sponsored.
> • Sponsoring a whole corridor: **$299/month or $2,999/year**, one per corridor.
>
> What I'm not doing is quoting you audience numbers. Measurement is still being
> set up and I'd rather show you real figures later than a guess now.
>
> truckinglifewithshawn.com/sponsors?from=yt-3#inquire

---

## Day 7 — Sunday

### Facebook post 2 (business owners)

> Week one of the directory. Here's the honest scoreboard: I don't have traffic
> numbers to show you yet, and I'm not going to invent any.
>
> What I do have is a list of independent truck shops, washes and stops that
> drivers can find by exit number — and a growing pile of corrections from
> people who actually run those roads.
>
> If you own one of these places: claim it, free, and let's get your details
> right. If you want to be featured later, that conversation is open and the
> prices are on the page.
>
> truckinglifewithshawn.com/sponsors?from=fb-biz-2#inquire

### Pinned post copy (leave up after the week)

> 📍 **The Trucking Life directory** — truck stops, parking, CAT scales, washes,
> tire repair and roadside service, by interstate and exit.
> Free, no login: truckinglifewithshawn.com/directory
>
> Own one of these businesses? Claiming your listing is free:
> truckinglifewithshawn.com/sponsors?from=pinned#inquire
>
> Found something wrong? Comment here or message me and I'll fix it.

### YouTube long-form sponsor read (60–75 seconds, mid-roll)

> "Quick one before we get back to it.
>
> We run a directory on the site — truck stops, parking, scales, washes, tire
> shops, roadside service. By interstate, by exit. It's free, there's no login,
> and it works on a phone.
>
> I built a lot of those listings from public information, which means some of
> them are wrong. If you spot one, tell me and I'll fix it. That's not a
> throwaway line — corrections from drivers are the only reason it gets better.
>
> And if you own one of those businesses: claiming your listing is free. Always
> will be. You check it, I fix what's wrong, done. There's a paid option too —
> featured placement on your category page, ninety-nine a month, and it's
> labelled Sponsored so nobody's being tricked. But claiming is free and I'm not
> going to pretend otherwise.
>
> One thing I won't do is tell you how many people use it. I don't have a number
> I'd stand behind yet, and I'd rather say that than make one up.
>
> truckinglifewithshawn.com/directory. Back to it."

---

## Comment-reply templates

**"Is this free?"**
> Yes. Free for drivers, no login, and free for a business to claim their
> listing. There's a paid featured option but nothing about the list depends on
> it.

**"How many people use it?"**
> Not enough yet, and I don't have measurement properly switched on, so any
> number I gave you would be made up. When I've got real figures I'll post them,
> including if they're small.

**"[Place] isn't on here" / "The hours are wrong"**
> Thanks — that's exactly what I need. Send me the name and the exit and I'll
> check it against the business's own info and get it fixed.

**"Does it have parking counts?"**
> Only where we actually know. If we don't have a count we leave it blank rather
> than guessing, because a wrong parking count at 9pm is worse than no listing.

**"I own [business], how do I get on there?"**
> Search your name on the directory first — you may already be listed. If you
> are, hit "Claim this listing" and I'll check and correct it. If you're not,
> message me the details and I'll look at adding you.

**"What does Sponsored mean?"**
> It means the business paid for that position, and the page says so. Sponsored
> listings sit above the standard results with a label on them. Claiming is
> separate and free.

**"Is this an app?"**
> No, and it isn't going to be. It's a web page that works on a phone, so
> there's nothing to install and nothing tracking you in the background.

**A complaint about a listed business**
> Sorry you had that. I'll note it, but I'm not going to remove a business over
> a single report — if you've got details, message me and I'll look properly.

**A request to be removed**
> Done — send me the listing link and I'll take it down. No argument, no sales
> pitch.

---

## What this campaign will not do

- No paid ad spend.
- No "limited spots", countdown, or manufactured urgency. Capacity is stated as
  a policy (three per page, one per corridor) and never as "only 1 left".
- No traffic, reach, ranking or results figure, invented or estimated.
- No automated posting. Every item above is posted by a person, or not at all.
- No tagging or naming a business that has not asked to be named.
- No DMs to businesses as part of the campaign — outreach is the separate top-25
  list, and it needs its own approval.

---

## Founder announcement (post this first, Day 1, before anything else)

The only post that is about Shawn rather than the product. It buys the right to
post the other eight.

> Seventeen years, about two million miles, and I have lost more nights than I
> can count to the same problem: I did not know where I was stopping.
>
> Not "which stop is nicest". Where there was a legal space at 9pm with the
> clock running out.
>
> So we built one. A directory of truck stops, parking, scales, washes, tire
> shops and roadside service — sorted by interstate and exit, because that is
> how you actually think about it when you are tired.
>
> It is free, there is no login, and it works on a phone in the dark.
>
> It is also not finished. Some listings are thin. Some hours are probably
> wrong. I built a lot of it from public information and I would rather you told
> me than have me guess.
>
> That is the deal I am offering: you use it, and when it is wrong you tell me,
> and I keep it honest.
>
> 👉 truckinglifewithshawn.com/directory

**One CTA:** open the directory. **Link:** `/directory` (no token — a driver is
not a lead).

## Free-listing-claim announcement (Day 3, owners)

> Quick one for the shop owners, tow operators and independent stop owners
> following this page.
>
> You are probably already on our directory. I built those listings from public
> information, which means some of them are wrong — hours, services, the phone
> number.
>
> **Claiming your listing is free.** Not free-for-now, not free-until-we-launch.
> Free. You check it, I fix what is wrong, and it stays free whether or not you
> ever spend a penny with me.
>
> There is no account to make. There is nothing to buy. There is not a
> salesperson who calls you afterwards unless you ask one to.
>
> 👉 truckinglifewithshawn.com/sponsors?from=fb-claim#inquire

**One CTA:** claim your listing. **Link:** `/sponsors?from=fb-claim#inquire`.

## Sponsored-placement announcement (Day 6, owners)

> I have been asked what the paid option is, so here it is with no wrapping.
>
> **Featured listing — $99 a month, or $999 a year.** Your listing sits at the
> top of its category or corridor page, with the word Sponsored on it. Up to
> three businesses per page, so it does not become a wall of ads.
>
> **Corridor sponsor — $299 a month, or $2,999 a year.** One business per
> corridor, across the pages a driver browses when they are planning that run.
>
> Claiming your listing is still free and always will be. I do not move paying
> businesses up the review queue.
>
> And the part most people leave out: I am not going to tell you how many people
> use it. Measurement is still being set up and any number I gave you today
> would be invented. When I have figures I will publish them — including if they
> are small.
>
> 👉 truckinglifewithshawn.com/sponsors?from=fb-sponsored#inquire

**One CTA:** ask about placement. **Link:** `/sponsors?from=fb-sponsored#inquire`.

## Driver nomination post (Day 4, drivers — the highest-value post in the set)

This one does double duty: it is the most engaging post for drivers *and* it
generates the next round of prospects, from people who have actually used them.

> Drivers — who has saved your bacon?
>
> Not the big chains. The independent tire guy who came out at 2am. The wrecker
> that actually turned up. The wash that did not take an hour.
>
> Name them and the exit, and I will look them up and get them on the directory
> properly. If they are already on it I will make sure their details are right.
>
> I am not paying anybody for a mention and nobody is paying me for one. I just
> want the list to be the one you would actually give another driver.
>
> 👉 truckinglifewithshawn.com/directory

**One CTA:** name a business in the comments. **Link:** `/directory`.

**What to do with the replies:** every named business is a warm prospect —
recommended by a customer, unprompted. Add them to the pipeline at stage 1 with
a note saying who named them. That is a materially better opener than a cold
one, and it costs nothing.

## Short-form hooks (first three seconds, for Reels / TikTok / Shorts)

The scripts are above; these are the openers to test. One idea each, spoken
plainly, no music sting, no "wait for it".

| # | Hook | For |
| --: | --- | --- |
| 1 | "It's 9pm, you've got thirty minutes on the clock, and you don't know where you're parking." | drivers |
| 2 | "Nobody builds anything for the guy who's tired at 2am. So I did." | drivers |
| 3 | "This is every truck stop on I-75, by exit number. That's it. That's the video." | drivers |
| 4 | "If you own a truck shop, I've probably already listed you. And I probably got something wrong." | owners |
| 5 | "Here's what 'Sponsored' means on my directory — because a few people asked and I'd rather say it out loud." | owners |
| 6 | "I'm not going to tell you how many people use it. I don't have a number I'd stand behind." | owners |

Hooks 2 and 6 are the honest ones and will probably outperform the clever ones.
That has been true of everything else on this channel.

## CTA and attribution index

One CTA per post, one token per post, never reused. Driver-facing posts carry no
token — a driver is not a lead and there is nothing to attribute.

| Post | Audience | Single CTA | Link |
| --- | --- | --- | --- |
| Founder announcement | drivers | Open the directory | `/directory` |
| FB post 1 (drivers) | drivers | Open the directory | `/directory` |
| FB post 2 (drivers) | drivers | Open the directory | `/directory` |
| Driver nomination post | drivers | Comment a business | `/directory` |
| Reel 1 / hooks 1–3 | drivers | Link in bio | `/directory` |
| YT community 1 & 2 | drivers | Tell me what's wrong | `/directory` |
| Story slides (drivers) | drivers | Swipe up | `/directory` |
| Free-claim announcement | owners | Claim your listing | `/sponsors?from=fb-claim#inquire` |
| FB business post 1 | owners | Claim your listing | `/sponsors?from=fb-biz-1#inquire` |
| FB business post 2 | owners | Claim your listing | `/sponsors?from=fb-biz-2#inquire` |
| Sponsored announcement | owners | Ask about placement | `/sponsors?from=fb-sponsored#inquire` |
| Reel 2 / hook 4 | owners | Link in bio | `/sponsors?from=reel-2#inquire` |
| Reel 3 / hooks 5–6 | owners | Link in bio | `/sponsors?from=reel-3#inquire` |
| YT community 3 | owners | Ask about placement | `/sponsors?from=yt-3#inquire` |
| YT long-form read | both | Open the directory | `/sponsors?from=yt-video#inquire` |
| FB Live | both | Claim your listing | `/sponsors?from=fb-live#inquire` |
| Story slides (owners) | owners | Swipe up | `/sponsors?from=story#inquire` |
| Pinned post | both | Claim your listing | `/sponsors?from=pinned#inquire` |

Every token is slugified and length-capped server-side, so a mistyped link
degrades to no source rather than breaking the form.

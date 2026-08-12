# Navigator Pilot — Driver Guide

**Read this once before your first trip. It takes five minutes.**

---

## What this is

Navigator is a **pilot**. It is not a finished product, it is not certified
truck navigation, and you are one of two or three people using it.

You are not testing whether you like it. You are testing whether it is safe.
Those are different jobs, and the second one is the one that matters.

---

## The rules that override everything else

**1. Signs win. Always.**
A posted clearance, a weight limit, a no-truck sign, a closed ramp — every
one of those beats anything on the screen. If the app and the sign disagree,
the sign is right and the app is wrong.

**2. Your judgment wins.**
You have driven more miles than this app has existed. If a route looks wrong
for a truck, it is wrong. Take the road you would have taken.

**3. Never make an unsafe turnaround.**
If Navigator ever leaves you needing to reverse direction, **do not turn
around**. Keep going the way you are pointed until you reach somewhere you
*know* is safe. Do not U-turn at an intersection, do not use a driveway, do
not use a private lot, do not back into traffic, do not use the shoulder.

The app cannot identify a place a truck can turn around. It does not have
that data and it does not pretend to. That job is entirely yours.

**4. Do not follow an instruction that is physically unsafe.**
Not "unusual". Not "annoying". Unsafe. Ignore it, keep driving, and tell me
about it afterwards.

**5. Keep a second way to navigate.**
Your own knowledge, a paper atlas, another device. Navigator does not get to
be your only source during the pilot.

---

## Before you pull out

- [ ] **Enter the pilot password.** I will send it to you directly. Do not
      forward it.
- [ ] **Set your destination and check it.** Read the address that comes back
      and make sure it is the place you actually mean — not a similarly-named
      one two towns over.
- [ ] **Tap Start.** That one tap does the rest: the browser asks for
      location if it needs to, Navigator waits for a real GPS fix, plans one
      validated truck route, and starts guiding. If the route needs a second
      look — a warning, or something unusual about its shape — it shows you
      the briefing first and waits for you.
- [ ] **Turn voice on while you are stopped** (optional, recommended).
      Phones will not let an app speak until you have tapped something. If
      you skip this, Navigator will be silent all trip and you will not know
      why.
- [ ] **Your first name is optional.** It is only used to talk to you, it is
      never stored, a reload loses it, and leaving it blank changes nothing
      about navigation.
- [ ] **Look at the truck panel.** Check the height, width, length, weight and
      axle count it is using are yours. While you are driving, the same
      numbers ride in the corner chip — height, weight, axles, hazmat — and
      it says plainly that trailer count is not part of the profile.
- [ ] **Glance at the clocks.** DRIVE, WINDOW, CYCLE and BREAK sit above the
      controls while you navigate, and the one about to bite is marked. They
      start from a **fresh driver every session** — Navigator is not an ELD
      and cannot see what you drove before you opened it. **Your logs are the
      record.** Tap the strip while parked to see the clocks in full.
- [ ] **Write down the build number** shown on screen. It is a short code like
      `b6a1260`. Every report needs it.

---

## What the app knows about your truck — and what it doesn't

**It sends:** height, width, length, gross weight, axle count, hazmat class,
your avoid options, and departure time.

**It does not send:**

- **What kind of truck you are.** It does not tell the routing service
  whether you are a combination or a straight truck. The service guesses.
- **Weight per axle.** Only gross weight. Many bridge postings are per-axle.
- **How many trailers.** Doubles and triples are barred from some roads
  outright and the request cannot say you are pulling two.
- **Hazmat tunnel category.** Only the class.

If you run doubles, or you are heavy per axle, or you are placarded through
tunnel country — **assume the route has not accounted for it.**

---

## While you are driving

### "Off route" / "Rerouting"

Means Navigator noticed you are not on the planned route and is asking for a
new one. Normal after a missed turn.

**What you should see:** the old turn instruction disappears, and within a
few seconds a new route appears with a turn you can actually take from where
you are.

**If it just sits on "Rerouting" and nothing comes:** navigate yourself. Do
not wait for it. Tell me afterwards — this is one of the specific things the
pilot is testing.

**If it gives you a turn you have already passed:** ignore it. That is a
defect, and an important one to report.

### If the map shows you in the wrong place

If the truck marker is on the wrong road, or off the road, or frozen —
**stop using it for guidance.** Every turn instruction is computed from where
it thinks you are. Note roughly how far off it was and what road you were on.

### If the route looks wrong

Take your route. Then tell me: where you were, where it wanted to send you,
and where you went instead.

### If the app freezes or goes blank

A frozen screen still looks like a working screen. If it stops updating,
assume it is wrong. Pull over somewhere safe, reload the page, and tell me
whether your trip survived the reload.

### If it stops finding routes

Usually the routing service or your signal. Your current route keeps working;
you just will not get a new one. Not an emergency — but tell me what the
screen said, because "I couldn't tell what was wrong" is itself a finding.

### If it asks for the pilot password again

That is normal — **the pilot password lasts 12 hours**, then it asks again.
Nothing is broken and you have not been locked out. Pull over, enter it
again, and carry on. Tell me if it happened mid-trip and whether the trip
survived re-entry, because that is worth knowing.

---

## When you are stopped: report

**Please send a report after every trip — including the ones where nothing
went wrong.** "Nothing went wrong" is data. It is the only way to tell a
quiet week from a week nobody reported.

1. Stop the truck. The report screen only opens when you are stationary — that
   is deliberate.
2. Tap **Report a problem**, pick the closest category, add a sentence if you
   want to.
3. Tap to copy. It copies a block of text.
4. Send it to me.

> ### Report destination — owner-selected
>
> **Send your report to: `shawngresham90@gmail.com`**
>
> This address was chosen by the owner on 2026-08-10. The line above was
> deliberately left blank until the owner picked one, rather than guessed
> at — a driver holding a truck-route defect report at 2 a.m. needs a real
> destination, not one invented to fill a template. A test still fails the
> build if any other destination ever appears in this guide, so the address
> can only change here on the owner's word.

The report contains what the app was doing, what build it was, and your note.
**It does not contain where you were** — no coordinates, no track, no
history. That is by design and it is not negotiable.

---

## Stop using Navigator and call me immediately if

- It routes you toward a **low bridge, a weight limit, or a no-truck road**.
- It ever leaves you needing to **turn around**.
- It tells you to go the **wrong way** on anything.
- A **turn is never announced**, or comes too late to take safely.
- It **freezes twice** in one trip.
- The **map position is badly wrong** and it did not warn you.
- Anything about **your hours** looks wrong or missing.
- You see a **password, a key, or a long code** anywhere on screen or in a
  report.
- Anyone reaches Navigator **without the password**.

You do not need to work out whether it is serious. Call me and let me decide.

---

## What I need from you

- One report per trip.
- The build number on every report.
- An honest answer to "would you have driven that route?"
- A phone call the first time something scares you, rather than a note about
  it three days later.

**You are not going to break it, and you are not going to hurt my feelings.**
The worst outcome of this pilot is that you saw something and did not mention
it because it seemed small.

---

## What Navigator will never do

- Store where you have been.
- Send your location anywhere.
- Guarantee a route is legal for your truck.
- Know a place your truck can turn around.
- Work without a signal.

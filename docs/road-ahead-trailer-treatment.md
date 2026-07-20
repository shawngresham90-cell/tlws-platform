# THE ROAD AHEAD — cinematic trailer treatment & voiceover script

The creative direction for `/road-ahead` as a cinematic trailer, and the assets
that make it feel like a Hollywood film about a driver's legacy. THE ROAD AHEAD
is the **interactive** trailer (scroll-driven, seven acts); this document is the
narration + music + edit direction that layers onto it. Everything here is
**plug-and-play** into the pipeline already built — no code changes.

## The emotional arc (already the scene structure)

| Act | Scene | Feeling | Footage slot(s) |
| --- | --- | --- | --- |
| I | 1 · Dark Highway | The open road; something bigger ahead | `dark-highway` / `night-driving` / `headlights` / `windshield-rain` |
| II | 2 · The Pre-Trip | The craft; discipline nobody films | `pretrip` / `truck-walkaround` / `backing` / `climb-into-cab` / `air-brake-check` |
| III | 3 · The Grind | Sacrifice; the miles nobody sees | `truck-stop` / `empty-highway` / `rain-driving` / `late-night-driving` |
| IV | 4 · First Light | Freedom; why we do it; the future | `sunrise` / `hero-shot` / `drone-shot` / `academy-footage` |
| V | 5 · The Founder Wall | Legacy; the names that built it | *(3D exhibit — no clip)* |
| VI | 6 · Your Name | Passing the torch; you belong now | *(induction — no clip)* |
| VII | 7 · Legacy | Bigger than yourself; the handoff | `student-training` / `key-handoff` / `student-success` / `truck-driving-away` |

## Voiceover script (deep, cinematic — not cheesy)

Record this (voice actor / TTS / AI voice), export a single `narration.mp3`, drop
it in `public/road-ahead/audio/`, and it plays through the already-wired
`narration` slot. Timed to land one beat per act; pauses are part of it.

> **[Act I — over the dark highway]**
> It starts in the dark.
> Before the world wakes up… before the first light…
> there's a driver, and a road that doesn't end.
>
> **[Act II — the pre-trip]**
> Nobody films the walk-around.
> The lights. The tires. The air brakes.
> But this is where a professional is made — one honest mile at a time.
>
> **[Act III — the grind]**
> Rain on the glass. Three a.m. The miles nobody sees.
> This is the price.
> And somebody paid it — long before you ever climbed in.
>
> **[Act IV — first light]**
> Then the sun comes up.
> And you remember why.
> Millions of miles were driven to get you here.
>
> **[Act V — the Founder Wall]**
> Somebody taught you. Somebody gave you a chance.
> Every name on this wall believed first.
>
> **[Act VI — your name]**
> Now it's your turn.
> One driver can change another driver's life.
> Put your name where the next one will see it.
>
> **[Act VII — legacy]**
> The road doesn't end with us.
> What we build today teaches the ones who come tomorrow.
> This isn't just a job. It's a legacy.
> This… is the road ahead.

**Closing line options (pick one for the final beat):**
- "Take your place. The road ahead is yours."
- "Somebody drove so you could. Now you drive for the next one."
- "The road ahead doesn't end. It's handed down."

## Music direction

Cinematic trailer score, licensed. Export a single `score.mp3`, drop it in
`public/road-ahead/audio/`, and it plays through the wired `score` slot (cross-
fades under the scene ambience; nothing autoplays until the visitor enables
sound). Direction:

- **Acts I–II:** sparse — a low drone, a single piano/cello motif, distant.
- **Act III:** tension builds — pulse enters, strings swell under the sacrifice.
- **Act IV (first light):** the lift — the motif opens up, warm brass/strings.
- **Acts V–VI:** intimate then rising — the theme returns, held, reverent.
- **Act VII:** full, hopeful, anthemic — resolve on an unresolved-to-resolved
  major cadence so it feels like a beginning, not an ending.

Reference feel: *Interstellar* restraint → *Top Gun: Maverick* lift →
*Friday Night Lights* / NFL Films warmth on the payoff.

## Edit direction — if you also cut a flat video

For a standalone trailer video (rendered outside this app in a real editor), the
same arc applies. Per act: hold the establishing shot 2–3s, cut on motion, let
the payoff shots (first light, key handoff, driving away) breathe longer. Slow-mo
the human moments (the handshake, the first climb into the cab, the sunrise).
Color: cool/desaturated through Acts I–III, warm and lifted from Act IV on. Keep
text overlays minimal — the narration carries the story.

## How your clips become the trailer (zero code)

Each clip you supply — YouTube-Unlisted link **or** a compressed file — maps to a
slot above via `public/road-ahead/youtube-sources.json` (links) or a drop-in
`<slot>.mp4` (files). A landscape 16:9 clip fills the frame best. Send me the
clip + which act/scene, and it appears on the next deploy.

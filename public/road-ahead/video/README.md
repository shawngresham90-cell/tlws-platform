# THE ROAD AHEAD — scene clips (zero-code drop-in folder)

Two ways to give a scene real footage. **Neither one touches code.**

1. **Drop a file here** — name it exactly `<slot-id>.mp4` (table below), redeploy.
2. **Map a YouTube-Unlisted clip** — add the slot id + link to
   `../youtube-sources.json`, redeploy.

A dropped-in `.mp4` always wins over YouTube (better quality, no third party).
Until a scene has either, it shows its cinematic gradient fallback, so the
experience is never blank.

## Slot ids per scene

Each scene has several named slots; the **first slot that has footage** becomes
that scene's backdrop, so the first row per scene is the hero shot. Drop a file
named `<slot-id>.mp4` (e.g. `dark-highway.mp4`).

| Scene | Slot id (filename stem) | What it shows |
| --- | --- | --- |
| 1 · Night Drive | `dark-highway` · `night-driving` · `headlights` · `windshield-rain` | Empty night highway, headlights carving the dark, windshield POV, rain |
| 2 · The Pre-Trip | `pretrip` · `truck-walkaround` · `backing` · `climb-into-cab` · `air-brake-check` | Inspection, walk-around, backing, climb-in, air-brake check |
| 3 · The Grind | `truck-stop` · `empty-highway` · `rain-driving` · `late-night-driving` | Truck stop at night, empty highway, rain driving, late-night miles |
| 4 · First Light | `sunrise` · `hero-shot` · `drone-shot` · `academy-footage` | Sunrise, truck hero shot, drone flyover, academy |
| 5 · The Wall | *(none — the 3D Founder Wall renders its own scene)* | — |
| 6 · Your Name | *(none — the engraving renders its own scene)* | — |
| 7 · The Payoff | `student-training` · `key-handoff` · `student-success` · `truck-driving-away` | Student training, key handoff, success, truck driving away |

A matching poster still (shown before the clip decodes, and under Save-Data /
slow connections) goes in `../poster/` as `<slot-id>.jpg` or `.webp`. Optional
captions go in `../captions/` as `<slot-id>.vtt`.

## Recommended encoding (dropped-in files)

| Setting | Value |
| --- | --- |
| Resolution | **1920×1080** (1080p); phones auto-downscale |
| Container / codec | **MP4 / H.264** (`yuv420p`, `+faststart`) — optional `.webm` (VP9) beside it for smaller mobile payloads |
| Duration | **8–15 s**, framed to loop cleanly (no hard cut at the seam) |
| Frame rate | 24–30 fps |
| Audio | **None** (clips play muted; strip the audio track) |
| Max file size | **≤ 4 MB** per clip (aim for 2–3 MB); posters ≤ 200 KB |

### The easy way (compress + poster in one command)

Hand Claude your raw clip and it will compress + generate the poster for you:

```bash
node scripts/compress-road-ahead-video.mjs <input-file> <slot-id>
# e.g.  node scripts/compress-road-ahead-video.mjs ~/night-drive.mov dark-highway
```

## The YouTube-Unlisted way (no file, no code)

1. Film a clip.
2. Upload it to YouTube and set visibility to **Unlisted**.
3. Open `../youtube-sources.json` and paste the link (or bare id) next to the
   slot id — e.g. `"dark-highway": "https://youtu.be/dQw4w9WgXcQ"`.
4. Redeploy. The scene plays it as a muted, looping, cover-fit background.

Watch/share/embed/`youtu.be`/shorts URLs and bare 11-char ids all work. The clip
plays via privacy-enhanced `youtube-nocookie.com`, muted and controls-off, and
is skipped under reduced-motion and Save-Data — same guards as a dropped-in file.

## How "no code changes" works

`npm run build` runs `scripts/generate-road-ahead-manifest.mjs` (the `prebuild`
hook), which scans this folder **and** `../youtube-sources.json` and writes
`src/lib/road-ahead/asset-presence.generated.ts`. The scene resolver reads that
build-time manifest (never the filesystem at request time — serverless/ISR-safe),
so a new file or YouTube mapping lights up its scene on the next deploy with zero
component edits.

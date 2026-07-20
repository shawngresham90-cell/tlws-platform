# THE ROAD AHEAD — scene clips (drop-in folder)

Drop one short clip per scene here, named **exactly**:

| File | Scene | What it shows |
| --- | --- | --- |
| `scene-01.mp4` | 1 · Night Drive | Night driving, headlights, highway, windshield POV |
| `scene-02.mp4` | 2 · The Pre-Trip | Inspection, walk-around, backing, climb-in, air-brake |
| `scene-03.mp4` | 3 · The Grind | Truck stop, rain, late-night driving, empty highway |
| `scene-04.mp4` | 4 · First Light | Sunrise, truck hero shot, drone, academy |
| `scene-05.mp4` | 5 · The Wall | *(optional atmosphere — the 3D Founder Wall renders its own scene)* |
| `scene-06.mp4` | 6 · Your Name | *(optional atmosphere — the engraving renders its own scene)* |
| `scene-07.mp4` | 7 · The Payoff | Student, key handoff, training, truck driving away |

A matching poster still goes in `../poster/` as `scene-0N.jpg` (first frame is fine).

## Recommended encoding

| Setting | Value |
| --- | --- |
| Resolution | **1920×1080** (1080p); phones auto-downscale |
| Container / codec | **MP4 / H.264** (`yuv420p`, `+faststart`) — optional `.webm` (VP9) beside it for smaller mobile payloads |
| Duration | **8–15 s**, framed to loop cleanly (no hard cut at the seam) |
| Frame rate | 24–30 fps |
| Audio | **None** (clips play muted; strip the audio track) |
| Max file size | **≤ 4 MB** per clip (aim for 2–3 MB); posters ≤ 200 KB |

## The easy way

Hand Claude your raw clip and it will compress + generate the poster for you:

```bash
node scripts/compress-road-ahead-video.mjs <input-file> <scene-number 1-7>
# e.g.  node scripts/compress-road-ahead-video.mjs ~/night-drive.mov 1
```

That writes `scene-0N.mp4`, `scene-0N.webm`, and `../poster/scene-0N.jpg` at the
recommended settings. After the files land, set each scene's `src`/`webmSrc`/
`poster` in `src/lib/road-ahead/assets.ts` (`SCENE_BACKDROP`) and add license
provenance — the scene goes live with no component changes.

Until a clip is supplied, each scene shows its cinematic gradient fallback, so
the experience is never blank.

# MedCheck marketing media

Records the **real running MedCheck app** (client/ built and served by server/, with the real rules engine and
NAFDAC Greenbook snapshot) into screenshots, phone videos and slide composites. Nothing is mocked up: every
verdict on screen is what `/api/check` returned, and each render saves that response next to the files.

## Run it

```bash
(cd client && npm ci && npm run build)          # the app the server serves
(cd server && npm ci && npm start)               # http://localhost:3001, leave running
cd tools/marketing-media && npm ci
export MEDIA_OUT=~/medcheck-media                # default: <repo>/media-library (gitignored)
npm run media:shots                              # phone + laptop stills          (~1 min)
npm run media:videos                             # phone walkthroughs and loops   (~2–3 min per scene)
npm run media:images                             # covers, composites, phone frames (needs shots)
npm run media:gallery                            # gallery.html over everything
npm test && npm run typecheck
```

`npm run media:videos -- V03` renders one scene; `-- --reencode` re-cuts from kept frames without recording.
On a laptop, run `npx playwright install chromium` once.

## How it works

- **Deterministic capture** (`lib/recorder.ts`): Playwright's fake clock is installed before the app loads and
  every frame advances it by exactly one frame step (33/34/33 ms), then waits for the network to go quiet, then
  screenshots. CSS animations and transitions are paused and set to the page's virtual time each frame, so motion is
  kept and two runs give the same frames. Taps show a small ripple, since phones have no cursor.
- **Camera**: Chromium's fake camera plays the pack photo (`content/photos/`), so the live viewfinder and the
  captured photo are that real pack.
- **Photo reading**: if no AI key is set, `/api/extract` is answered by a stand-in that returns a person's
  transcription of the pack (`content/packs.json` → `printed`) in the middleware's exact response shape. It never
  touches the verdict, which always comes from the real `/api/check`.
- **Truth guard**: each pack declares the verdict its story needs (`expect`). If the real backend disagrees, the
  render fails instead of publishing a misleading asset.
- **Checks** (`lib/checks.ts`): every still and video fails on leftover text (`undefined`, `NaN`, raw ISO dates…)
  and on any claim the product must never make ("genuine", "safe to use").
- **Brand**: colours come from `client/src/index.css` and `shared/legend.ts`; a test asserts they match.

## Add or change content

- A new pack: add a row to `content/packs.json` (and its photos to `content/photos/`, with author, licence and
  source URL). Only photos you may redistribute.
- A new scene: add it to `manifest.ts`, built from the steps in `scenes/flows.ts`. Use real accessible names only;
  a missing control fails the render.
- Clips are cut by marker names (`rec.mark('verdict')`), never frame numbers.

Planning docs: `docs/DECISIONS.md`, `docs/ASSET-LIST.md`, `docs/HANDOFF.md`.

# Hardening pass: every step's input, output and edge cases

Written Sat 24 Oct 2026, about 9:30 PM ET (the original header says Oct 25, the UTC date), against `client/` at 703a406, then implemented in 896570d (9:36 PM) and the commits after it. Goal: every step has a clear input and output, every edge case lands somewhere sensible, Back and forward always do what the user expects, and the phone demo works on a real device.

Kept as written. Two notes for readers:

- "A local stand-in for the Anthropic API" below means a stub server that returns a fixed transcription, so the real multer, sharp, SDK-parse and field-check code ran without spending budget or needing a key on the build machine. Verdicts in this test are real; the AI read was not. See [AI use and validation](../ai-use-and-validation.md).
- The test counts here (83/83) are from that moment. At 404a699 the server suite is 219 tests, all passing.

Scope: `client/` on main @703a406 against `server/` (backend + `/api/extract` middleware) and `shared/types.ts`.
Goal: every step has a clear input and output, every edge case lands somewhere sensible, back and forward always do what the user expects, and the phone demo works on a real device.

## 1. What changed on the backend that the client hasn't caught up with

| Backend fact (source) | Client today | Needed |
|---|---|---|
| `/api/extract` takes **1–3 photos of one pack** as `photos` (any side, any order), or one `image` (`server/src/extract/route.ts`, commit deb4274). The AI combines them and reports `sidesSeen`. | Sends one `image`. Snap is a file input, no live camera. | Collect 1–3 photos of the pack, sent as `photos`; the AI infers every field from the whole set. (A guided front/NAFDAC/batch sequence was tried and dropped at Eric's request, Oct 25.) |
| Response carries `extraction: { photoStatus, sidesSeen, model, costUsd }`. `photoStatus` can be `blurry`, `glare`, `partial`. | Ignored. | Show a one-line hint on Confirm when the photo wasn't clean ("Some text was hard to read (glare). Check the highlighted fields."). Type it in `shared/types.ts` (`ExtractionInfo`, `ExtractResponse`). |
| 422 has three distinct messages: "Photograph one pack at a time.", "This doesn't look like a medicine pack.", "We couldn't read the pack." | Every 422 is replaced by one generic sentence. | Use the server's message for 422 (it is already user-facing copy). 413 and 400 too. |
| A partial reg no. comes back as `value: null` with `sourceText` and a note. | Handled (Read as + notes). | Keep. Verified. |
| One AI call for up to 3 photos takes longer than for one. | 30 s timeout. | 45 s for extract. |

Verified on the real stack (server on :3001, a local stand-in for the Anthropic API so the real multer, sharp, SDK-parse and `fields.ts` path runs): `image` and 3×`photos` both return a valid `StandardizedMedicationInput`; 4 photos → 400; a non-image → 400; unconfirmed → 422; confirmed hero read → RED R3; the extra `extraction` key is ignored by `/api/check`; `/api/report` drafts from the result. Server tests 83/83, both typechecks clean. **No server change was needed to connect.**

## 2. Step by step: input, output, edge cases, back and forward

### Start (landing)
- In: nothing. `GET /api/meta` for the data dates (fails quietly).
- Out: Scan → Snap. Type → Confirm (typed). Demo pack (mock or `?demo`) → Confirm prefilled.
- Back: leaves the app (first history entry).

### Snap (rebuilt)
- In: camera permission state; any photos already taken (coming back from Read or Confirm keeps them).
- Out: 1–3 photos, each `{ id, blob (JPEG ≤1600 px), url }`, in the order taken → Read. Order doesn't matter to the server: each photo is labelled "Photo n" and the AI reports which side it shows.
- States and handling:
  - **Permission unknown / prompt**: frame shows "Allow camera" with one line on why. Tapping it calls `getUserMedia` (a user gesture, which iOS needs). If the browser says already granted, the live preview starts with no tap.
  - **Live**: `getUserMedia({ video: { facingMode: 'environment', 1920×1440 ideal } })`, `playsInline muted autoplay`. The shutter grabs exactly what's inside the frame (object-cover crop), downsized to 1600 px JPEG 0.85.
  - **Denied** (`NotAllowedError`): "Camera is blocked" + how to unblock (site settings icon by the address bar) + Try again, with Upload and the phone's own camera app still available.
  - **No camera** (`NotFoundError`/`OverconstrainedError` after a relaxed retry): upload only.
  - **Camera busy** (`NotReadableError`, another app has it): message + Try again.
  - **Insecure context** (phone on `http://192.168…`, `navigator.mediaDevices` missing): the shutter opens the phone's camera app through `<input capture="environment">`. Message says live preview needs HTTPS.
  - **Track ends / tab hidden**: stop the stream on hide, restart on show; stop it on leaving the screen so the camera light goes off.
  - **Camera and photo library, both ways** (Eric: once the camera was used there was no way back to picking photos). "From photos" sits next to the shutter and the next empty slot in the strip is a "+" that opens the library. Switching never loses photos already added.
  - **Several photos at once** (Eric, Oct 25): the library picker takes multiple files and fills the free slots. More than fit: the first ones are added and a note says so. An unreadable file is skipped with a message and doesn't take a slot. Verified: 3 at once, 5 at once (3 added), camera + 3 picked (2 added + note), one bad file of two. Non-images and undecodable files (HEIC on Chrome) give an inline error, nothing is lost.
- One capture screen: "Photograph the pack · Take 1 to 3 photos from any side. Include the NAFDAC number and expiry if you can." A strip of 3 slots shows what's added; tap a photo to check it (Remove / Back to camera), × removes it. "Read pack" appears once there's 1 photo. At 3 the camera hides, the frame shows the three, and Read pack is the one button.
- Back: → Start. Photos are kept until a new check.
- **Bug fixed**: the step bar was missing on Snap (the step index only knew Snap once the photo path had started).

### Read
- In: the photo set. Out: `StandardizedMedicationInput` (unconfirmed) + `extraction` → Confirm.
- Errors: 404 off / 429 paused / 503 down → "Type the details" primary (photos kept for copying). 422 → server's own message + Retake. Timeout/offline → Try again.
- **Bug fixed**: going back while the read is in flight let the late answer jump the user to Confirm from Snap. The request is now aborted on unmount and late answers are dropped.
- Back / Retake: → Snap with the photos kept.

### Confirm
- In: fields (from the read, a demo pack, or empty), photos if any, `photoStatus`.
- Out: `toInput(..., confirmedByUser: true)` → `/api/check`. Unchanged rules: low-confidence rows need "Looks right" or an edit, then the attestation tick, then the button; any edit un-ticks.
- Photo sheet shows every photo.
- **Bug fixed**: after "Type the details" from a failed read, Back went to Start and left the old photos behind; it now returns to Snap whenever photos exist.
- Offline / check fails → stays here with the error, details kept.

### Checking
- In: the exact input sent. Out: result → Result, or error → Confirm.
- Back during the call is a no-op (nothing to go back to mid-request).

### Result
- **Bug fixed**: a real photo read fills all nine fields, so the Compare table plus the expiry note pushed the page to 905 px on a 390×844 screen. On phones 740 px or taller the screen is now locked to the viewport and the tab content scrolls on its own; shorter phones (iPhone SE) scroll the page so the table is never squeezed to nothing.
- Otherwise unchanged: rendered from `/api/check` as sent. Back = Edit details (re-tick needed). Unsure primary = Add the NAFDAC number (focuses that field). Check another pack → Snap with a clean slate (all photo URLs revoked).

### Report
- In: input + result. Out: a draft the user sends themselves (mail, call, share/copy). Back → Result.

### History
- **Bug fixed**: Confirm → Back to Snap skips Read, and "Check another pack" starts a fresh Snap, which left spare history entries, so Back on the start screen did nothing several times. Back on the start screen now keeps going until the browser leaves the app.

## 3. Real-device demo

- Camera preview needs a secure context: `https://` or `localhost`. A phone on `http://<laptop-ip>:3001` falls back to the phone's camera app (it still works, no live preview).
- `npm run dev:phone` (client) serves Vite over HTTPS on the LAN with a self-signed cert (accept the warning once) and proxies `/api` to the server on :3001.
- No-warning option: `npx cloudflared tunnel --url http://localhost:3001` after `npm run build`, open the `https://…trycloudflare.com` URL on the phone.
- The live demo artifact runs in mock mode inside an iframe; if the page can't use the camera there, Snap falls back to upload and the demo packs.

## 4. Out of scope / notes
- No gzip on the server (perf ~80); harmless locally.
- No client-side blur detection; the server's `photoStatus` covers it.

## 5. Verification (Oct 25, after the fixes)

Real server on :3001 serving the built client, Chromium at 390×844 with a fake camera feed, the Anthropic API replaced by a local stand-in so the real extract path runs:
- Allow camera → live preview → 3 photos → "Read pack" → server got 3 images → Confirm ("Your 3 photos") → Looks right → tick → RED R3 → Report. Every screen fits 390×844.
- Permission already granted: live preview with no tap.
- Denied, busy, no camera, insecure (http): the right message each time; the shutter opens the camera app on http; "From photos" adds photos and "Read pack" works.
- Camera and library mixed; remove with ×; view a photo, go back to the camera and add another; Back from Confirm keeps all photos.
- 422 not_medicine / multiple_packs show the server's own sentence; glare shows the note on Confirm; AI down (503) and no key (404) offer "Type the details".
- Back during a slow read: stays on Snap; the late answer is dropped.
- Typed path, all three demo packs (`?demo`), and the Why/Checked tabs fit at 390×844. At 375×667 the verdict and the demo-pack start screen scroll the page.
- Server tests 83/83, both typechecks, production build.

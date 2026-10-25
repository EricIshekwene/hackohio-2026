# MedCheck media: what to use where

Everything here is the real MedCheck app checking real packs against the real NAFDAC Greenbook snapshot
(25 Oct 2026). Verdicts were not edited. Open `gallery.html` to browse it all.

## Best picks

- **Slide cover**: `images/I01-cover-light.png` (or `I02-cover-dark.png` on a dark slide). Put the title on the empty left half.
- **"How it works" slide**: `images/I03-three-phones.png`, or the four stills S01 → S05/S06 → S07 → S08 in a row.
- **"It works" slide**: S08 and the clip `V02-typed-green-result.mp4` (the green result, Artheget EZ).
- **"Real pack" slide**: `images/I06-real-pack-natrilix.png`, S02 (Natrilix SR in the camera), S18 (three photos), S20 (flagged), and the walkthrough `V05-photo-natrilix-walk.mp4`.
- **"It catches fakes" slide**: `images/I04-catches-phones.png`, S11 (cloned number) and S13 (NAFDAC Alert 042/2026).
- **Demo video**: the walkthroughs `V0x-…-walk.mp4` (full flows, 20–26 s each) and the short loops for B-roll.
- **Reporting**: S15 and `V03-catch-cloned-report.mp4`.

## Rules when using them

- Keep "Not proof of authenticity" visible on any result. Never call a green result "genuine" or "safe".
  Say "No problems found" or "matches NAFDAC's records".
- Frame the red results as catches: "MedCheck caught a cloned registration number", "MedCheck matched the batch to NAFDAC Alert 042/2026".
- The real Natrilix SR pack came back amber, and the assets show that: "MedCheck flagged an expired pack (08/2025) with an Inactive NAFDAC registration." Don't present it as "No problems found".
- The cloned-number pack (Malacure Forte) is a demo scenario built on a real NAFDAC record. Alert 042/2026 is a real NAFDAC alert.
- In these recordings the photo-reading step is a stand-in (a person's transcription in the AI's exact output format),
  because the build machine had no AI key. If the video narrates "the AI reads the label", that's what the real app does;
  just don't claim these particular clips show the live model.
- Loops are silent. Don't add music to them; add it to the edit if you want.
- To embed a loop on a web page: `<video autoplay muted loop playsinline poster="…-poster.webp">` with the WebM then MP4 source.

## Changing something

Tell the engineer the asset ID and the change. It is a re-run of `tools/marketing-media`, not a redraw.

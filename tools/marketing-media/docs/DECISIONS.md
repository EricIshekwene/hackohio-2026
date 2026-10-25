# Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Record the real server (`server/`, :3001) serving the built `client/dist`, not mock mode. | Every verdict is real rules-engine output against the 8,943-product Greenbook snapshot of 25 Oct 2026. Mock mode only knows three fixture packs. |
| D2 | Pinned clock: 25 Oct 2026, 09:00 Lagos (08:00 UTC), timezone Africa/Lagos, locale en-NG. | Matches the snapshot date and demo day, so "expires 1 Dec 2026 (in 36 days)" reads the same in every asset. |
| D3 | Phone first: stills at 390×844 @3× (1170×2532 PNG), videos at 390×844 @3× encoded 1080 wide, 30 fps, silent. Two laptop stills only. | MedCheck is a phone app with a 430 px max column; on a laptop it is a narrow column on white, which suits a slide less than a phone frame. |
| D4 | Light theme only. | The app has no dark theme. Composites come in a light and an ink background instead. |
| D5 | No text baked into images or videos. | Slide titles change; the cover and share card leave the left side empty. |
| D6 | No AI key on the build machine, so `/api/extract` is answered by a stand-in returning a person's transcription in the middleware's exact shape (`model: "stand-in (human transcription)"`). Read time shown is 2.6 s (the real read takes 6–15 s). | Keeps the photo flow real end to end except the one AI call. The stand-in never changes a value, and the verdict still comes from `/api/check`. Disclosed in the gallery and handoff. |
| D7 | Typed-path stories use the team's three demo packs: Artheget EZ (green), cloned A4-6238 on "Malacure Forte" (red), Alert 042/2026 (red). | Artheget EZ's record and Alert 042 are real NAFDAC data. The cloned pack is the team's invented attack scenario on a real record, and is labelled as such. |
| D8 | Positive framing: most assets show a clean pack and "No problems found" with the caveat; the two red cases are framed as catches. | Eric's brief. Truth rules still hold: no faked verdicts, the caveat stays visible, never "genuine" or "safe". |
| D9 | Real pack photos only from sources we may redistribute (openly licensed, or photos the team takes of packs it owns), each with author, licence and source in `content/packs.json`. | Eric asked for real images of Nigerian medicines; stock photos we can't redistribute are out. |
| D10 | Pipeline committed to `main` under `tools/marketing-media/`, renders never committed. | Eric's rule: no PRs, push to main. Renders live in the project files folder. |
| D11 | Scale cut for the deadline: one walkthrough per key flow, 1–3 loops each, every screen as a phone still, a few composites. No 16:9 desktop walkthroughs, no dark theme, no social cuts. | Submission is Sun 10:00 AM ET with recording from 7:30 AM. |
| D12 | Animations kept and driven by the fake clock (paused, `currentTime` set each frame) instead of disabled. | Keeps the app's real motion (progress steps, scan line, tab changes) while staying deterministic. |

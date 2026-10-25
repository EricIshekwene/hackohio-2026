# Team plan: who did what, the clock, and the cut order

Four people, two AI assistants, one night. This is how the work was split and the rules we agreed to work by. Sources: the 6:18 PM team meeting notes (Notion), the team plan and decision doc (Drive, ~7:00 PM ET), and the team's shared build file (Drive, "00-MUSE-AND-CLAUDE", created ~7:10 PM ET).

## 1. Roles

| Who | Planned job |
|---|---|
| Jeremiah | Frontend: Capture → Confirm → Verdict → Report screens, mobile first |
| Aldez | Middleware: `/api/extract` (image → standardised JSON), the manual path, extraction accuracy on 10–15 real packs |
| Eric | Backend: registry and alerts ingest, rules, `/api/check` and `/api/report`, repo |
| Michael | Whole project: presentation, rubric map, process log, Q&A prep, submission |
| **Muse** (Meta AI, run by Amoako for Michael) | "Conductor": the shared build file, a demo-safe site, decks with speaker notes, verification passes written as failing cases, gap checks |
| **Claude Code** | Builder inside the repo: code to the agreed contract, screenshots, recordings, the media pipeline |

In practice the work moved as the night went on. Eric's Claude Code sessions built the backend, then the client (the two `client/` plans were reconciled first, see [spec reconciliation](03-spec-reconciliation.md)), then `/api/extract`. The git log is the record of who committed what.

## 2. The loop between the two AIs

From the shared build file, written before any code:

1. **One specs, the other builds.** Muse writes the failing case and the acceptance check first ("pack X must return R3 with the name and manufacturer rows highlighted"). Claude implements. Muse verifies against the check, "not against vibes".
2. **No number ships that isn't measured.** An accuracy number goes from the person who measured it to the status board, and only then into the deck or video.
3. **Screenshots come from the real app**, by script, and are re-run when a screen changes. No hand-made screenshots.
4. **Every AI use is disclosed** in the video (AI for Impact rewards transparency).
5. **One source of truth.** When repo, Drive, deck and video disagree, the shared file wins until Michael rules.

## 3. The contract, frozen early

Input and output shapes were agreed before the build (`StandardizedMedicationInput` → `VerificationResult`, the same shape for photo and typed input), and the backend refuses unconfirmed input. The final version is in [API contract](05-api-contract.md).

AI was allowed to do exactly three things: extract label fields (with confidence, shown and editable), reword code-produced reasons (a stretch goal, never built), and parse alerts once at ingest with a person checking every row (we entered Alert 042 by hand instead).

## 4. The clock (ET)

| Time | Milestone |
|---|---|
| Sat 12:00 AM | End to end: photo or typed → confirmed fields → correct verdict |
| Sat 12–3 AM | Extraction accuracy on 10–15 real packs |
| Sun 3–5 AM | Print the mock packs (BP5203 + the cloned-number pack) |
| **Sun 5:00 AM** | Feature freeze, bug fixes only |
| Sun 7:30 AM | Record the video (hard stop 8:30) |
| Sun 9:15 AM | Team submit target |
| **Sun 10:00 AM** | Hard deadline |

The end-to-end milestone was met early: the typed path ran through the real client and rules from 8:04 PM (6720f18), and the photo path once `/api/extract` landed and the client used it (8:16–9:02 PM). **The real-pack accuracy run was not done** (see [AI use and validation](../ai-use-and-validation.md)).

## 5. Cut order and never-cuts

- **Cut first, if behind:** Pidgin explanations → WHO alerts → report logging → the photo path (typed entry keeps the demo alive).
- **Never cut:** field confirmation, the R3 side-by-side, sources and dates, "Not proof of authenticity".

Muse's devil's-advocate review (8:18 PM) caught that two plans disagreed: the build plan dropped *typed entry* last, the team plan dropped *photo* last. The shared file's version (photo is the cut, typed entry survives) governed. In the end nothing on the never-cut list was cut, and of the cut list only Pidgin and live WHO alerts were left out.

## 6. Presentation formats considered

Michael asked for options at about 8:15 PM: face on camera over slides, an AI voice, a Claude-built video from real app recordings, a live-demo-only cut, a hybrid (a person for the story, the recorded real app for the demo), team voice clones, and cartoon avatars. The rule agreed: record the face-on-camera cut first, build the app-recording segment overnight, submit the hybrid if both land, and disclose any AI voice. The pitch script puts the live product demo at 1:06–2:00 of the 3-minute video.

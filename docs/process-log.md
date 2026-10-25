# Process log

Everything that happened, in order, with the pivots called out. All times are **ET**, Saturday 24 Oct 2026 unless marked. Commit times come from git (some of our agents commit in UTC; they are converted here). The full history is `git log` on `main`; the team's rule was no PRs, straight to main.

## Pivots

| # | When | From | To | What forced it |
|---|---|---|---|---|
| 1 | 5:05 PM | "OCR + lookup" | The cloned-number check as the hero | Council Skeptic: a counterfeiter copies a real number |
| 2 | ~7:00 PM | Season Planner (Eric's "product brain") | MedCheck | Data and buildability; the rubric rewards complexity that serves the solution |
| 3 | 7:30 PM | Our Flow A plan (3 tiers, "not found" amber, reg. no. required) | The backend spec (4 tiers, reg. no. optional) | Two plans for one `client/`; 25 differences listed |
| 4 | 7:47 PM | Match the manufacturer | Match the Nigerian licence holder | NAFDAC registers the holder, not the factory |
| 5 | ~8:10 PM | v1 dark-green design | v2 black, white, green accent | Eric: "vibecoded", "too much green" |
| 6 | 9:51 PM | Guided 3-shot capture | 1–3 photos, any side | Eric: felt like a form |
| 7 | 9:52 PM | "Not found" = RED | AMBER "Unable to verify registration" | A real pack (AquaMal QS) missing from the snapshot |
| 8 | 11:12 PM | Two real-photo demo packs | One (Natrilix SR) | Eric: "we only need one" |

## Detailed log

### 4:27 PM Setup
Repo created (a527424). Council skills installed. The team handoff (rubric, rules and a full Discord digest) read at about 4:47 PM.

### 4:53–5:09 PM The research run
"Go" at 4:52:58 PM. Six research agents in parallel (~7 min), a hard filter (28 → 6), six adversarial councils (~2.5 min), a live re-check of the MedCheck data at 5:06, and the ranked report at 5:08:40. **About 16 minutes against a 90-minute time box.** Details: [research method](research/02-method-and-options.md).

### 5:10–7:00 PM Choosing
Eric's MedCheck-vs-Season-Planner conversation ([why MedCheck](research/03-why-medcheck.md#3-the-season-planner-conversation)). The 6:18 PM team meeting assigned roles. **MedCheck confirmed at about 7:00 PM.** The team plan set the clock, the cut order and the never-cuts ([team plan](planning/06-team-plan.md)). Graded verdict over yes/no.

### 7:10 PM The shared build file
Muse (the team's Meta AI assistant) created one file for both AIs and the team: locked facts, the contract, owners, the "spec the failing case first" loop, the status board. A demo site followed (live about 9:14 PM).

### ~7:15 PM Four user flows
Wizard, single screen, dual entry, chat. Scored on 7 criteria; the wizard won 31/35 ([user flows](planning/01-user-flows.md)).

### 7:29 PM Backend and contract (77bee3b)
Rules engine, `/api/check`, `/api/legend`, `/api/report`, `shared/types.ts`, `shared/legend.ts`, three demo fixtures. 24 tests.

### 7:30 PM Spec reconciliation
Our Flow A plan and the backend's frontend spec disagreed in 25 places. Rule: the spec wins on contracts, our plan on UX ([spec reconciliation](planning/03-spec-reconciliation.md)).

### 7:37–7:52 PM Real data
GitHub Action to snapshot the Greenbook (7:37). Alert 042 demo pack corrected to match NAFDAC's alert page (7:40). **Snapshot committed by the Action: 8,943 products** (7:41, 3f138b7). R3 changed to match the Nigerian licence holder, with a new `marketedBy` field (7:47, 7:52).

### 8:04 PM Client v1 (6720f18)
Capture, confirm, verdict and report screens, built from the 18-decision design page ([decisions](design/decisions.md)).

### ~8:10 PM "Vibecoded": the redesign
Eric rejected the look. New bar: Apple, Figma, Resend, Railway; mostly black and white. A theme commit from feedback meant for another agent was reverted a minute later (8:13–8:14). In parallel, a 19-item [UX critique](design/ux-critique.md) of v1 (top 12 sent at about 8:20).

### 8:29 PM Client v2 (162fa91)
Rebuilt on the new [design system](design/design-system.md). Design audit fixes at 8:37 (f916a13): contrast, first-load JS 445 → 276 KB.

### 8:16–9:02 PM Photo reading
`/api/extract` (8:16, deb4274). Scored on 33 AI-generated mock packs (8:40): 31/33 verdicts, 0 unflagged field mistakes; both misses were partial reg. nos. treated as "not registered". Fix: send an incomplete number as empty. 33/33 at 8:47, with correct fields no longer flagged on every pack (40 → 6). Near-miss spellings flagged (9:00). Hero pack renamed to made-up names, Malacure Forte / Sunrise Pharma (9:01). See [AI use and validation](ai-use-and-validation.md).

### 9:36–9:50 PM Hardening
Every step's input, output and edge cases specified, then built ([hardening](planning/04-hardening.md)): live camera with seven handled states, a guided 3-shot set, Back that always does the expected thing (9:36). Multi-pick from the library (9:44). Backend hard review: input caps, the report re-runs the check, per-IP AI cap, date and strength parsing (9:47). Snapshot guard against partial scrapes (9:49); second snapshot (9:50).

### 9:51 PM The photo-flow reversal
Eric rejected the guided shots. Back to one capture screen: 1–3 photos from any side, and the AI works out which side is which (19d7eff).

### 9:52 PM R1 red to amber
A real pack, AquaMal QS (B4-0910), came back "Do not use" because its number isn't in our snapshot. The snapshot only holds registrations expiring after about 27 Oct 2025. Calling a real medicine "do not use" because of a gap in our data was the worst possible error, so "not found" became AMBER "Unable to verify registration", and results gained a decision status, reason codes, `authenticityVerified: false` and per-source evidence (df2fc17). A sourced GS1 record for B4-0910 lifts it to "Product listing found".

### 10:16–10:28 PM Media pipeline
Records the real app into stills, phone videos and slide composites (46c6314, 25711ee), with the AI read replaced by a disclosed stand-in because the build machine had no key.

### 10:26 PM End-to-end runs on the real registry
Parallel runs through the real registry and a real browser (97c0e6b, fd0a2b9, a2045c7). Found and fixed: the engine took the first of several rows sharing a number (false REDs, 23 false "Inactive"); an alert batch on a different product came back GREEN; Unicode look-alike characters; misleading "not on the pack" wording. Every Active row as a genuine pack: 0 false R3, 0 false R4.

### ~10:45 PM Pitch v3
Script and deck, with the live demo at 1:06–2:00 of the video. Every stat re-checked against its source.

### 11:07–11:13 PM Start screen, home page, rules scan
New start screen and home (11:07, 11:13). Rules scan over ~102k genuine variants and made-up fakes: fakes wrongly GREEN 11,500 → 37 (6079bae). Eric: **"we only need one"** real-photo pack, so AquaMal was archived and Natrilix SR kept.

### 11:24–11:48 PM Wrap-up
Natrilix SR real-photo demo (11:24). Demo screen recording (11:25). README for judges (11:43). Repo made public; submission checklist. Media pipeline matched to the new home heading (11:48).

### Sun 25 Oct, after midnight
These docs, written from the night's artifacts and the git history.

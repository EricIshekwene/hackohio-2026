# Challenges, and how we got past them

The hard parts of MedCheck were not where we expected. "Look up a number" turned out to be a data and judgement problem; "read a photo" turned out to be a problem of knowing when not to trust the read.

## Data

| Challenge | What we did |
|---|---|
| **Greenbook has no API, no CORS, and runs in debug mode** (it echoes SQL in responses) | Found the JSON endpoint behind its table, then decided: snapshot once, server-side, ~18 polite requests from a GitHub Action, never from the browser or during the demo. A guard refuses to overwrite the snapshot with a partial scrape. |
| **The snapshot isn't complete.** Greenbook only returns registrations expiring after about a year before the download date | Found when a real pack (AquaMal QS, B4-0910) came back "Do not use". "Not found" became AMBER "Unable to verify registration", and a sourced reference file can show a product listing for numbers Greenbook drops. |
| **NAFDAC registers the Nigerian licence holder, not the factory** | A genuine pack naming its factory looked like a mismatch. Added a `marketedBy` field; a factory-only difference is AMBER, not RED. |
| **Several rows share one reg. no.** | Score every candidate row against the pack and prefer an Active, unexpired one. Fixed false REDs and 23 false "Inactive" results. |
| **Messy registry text** (`##` padding, "** (duplicate NRN)" notes) | Cleaned on load. |
| **The alerts feed is a list to read, not data** | A person reads each alert and enters it by hand; no alert reaches the rules unchecked. The app shows the last alert date (19 Aug 2026) instead of claiming to be live. |
| **Free public APIs that didn't work** (ReliefWeb 410/403, IOM DTM 401, IPC 401, HungerMap 503, EskomSePush 410, healthsites 403, Ghana FDA 404) | They ruled out candidate problems early, which is what the "fetch it or mark it UNVERIFIED" rule was for. See [research](research/02-method-and-options.md#6-dead-ends). |

## Matching

| Challenge | What we did |
|---|---|
| **One-letter fakes** ("Artheqet" for "Artheget") | Near-miss matching flags a word a few letters off a registry word as AMBER "Spelling differs". |
| **…without flagging real variants** ("AstraZeneca" vs "Astra Zeneca", "GlaxoSmithKline") | Joined words must equal the other side's first N words joined, so spacing passes and added letters don't. Measured on ~102k generated variants: made-up fakes slipping through as GREEN fell from 11,500 to 37. |
| **Look-alike characters in reg. nos.** (Cyrillic/Greek letters, invisible marks, O vs 0) | NFKC normalisation, stripping invisible and bidi marks, folding look-alikes. An O/0 swap that still doesn't match gives UNSURE "Check the registration number". |
| **Unbounded input** (edit-distance on very long strings could tie up the server) | Field values capped at 200 characters; per-IP cap on AI reads. |

## Reading photos

| Challenge | What we did |
|---|---|
| **A partial number is worse than none.** "04-77" from a torn box was read as a real, unregistered number | Incomplete numbers are sent as empty with what was read kept beside them, which gives UNSURE, not a false alarm. |
| **Correct fields flagged on every pack** (strength was highlighted on 32 of 32) | The "matches the print" check compared a value with the whole printed line; now it checks each value against its own part of the print. Wrongly flagged correct fields fell from 40 to 6. |
| **Fields are on different sides of the box** | 1–3 photos of one pack, any side; the AI reports which side each photo shows. |
| **Phone cameras** (permission prompt, denied, busy, no camera, plain-http on a phone, tab hidden) | Each state has its own message and a way forward; on http the shutter opens the phone's own camera app. |
| **Slow 2G-era connections** | Photos downsized on the phone before upload; a typed path that needs no AI. |
| **No real-pack accuracy number** | We didn't have 10–15 real packs on the night. We say so instead of quoting the mock-pack result as real-world accuracy ([AI use and validation](ai-use-and-validation.md)). |

## Product and team

| Challenge | What we did |
|---|---|
| **"Too easy"** (Eric's worry about MedCheck vs the Season Planner) | Went deep instead of wide; the depth is the list above. |
| **Saying something useful without overclaiming** | Four tiers, "Not proof of authenticity" on every green, never "genuine" or "safe", sources and dates on every result. |
| **A design that looked "vibecoded"** | Rebuilt in about 20 minutes from real-product references, then audited (accessibility 100). |
| **Two plans for one `client/` folder**, and two AI assistants on one `main` with no PRs | Diffed the plans (25 items) before coding. A misdirected commit was reverted within a minute. One shared build file as the source of truth. |
| **Not putting real companies on a fake** | The hero fake was renamed to invented names (Malacure Forte / Sunrise Pharma). Placeholders don't use real reg. nos. or brands. |
| **Tooling friction** (GitHub access failing several ways, Slides not connected, private AI-hosted pages not opening for teammates) | Worked through git over the session proxy, kept copies of every artifact in Drive and in this repo. |

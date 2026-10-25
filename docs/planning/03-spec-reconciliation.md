# Spec reconciliation: backend spec vs our frontend plan

**Context.** The backend (Eric's agent, `server/` + `shared/`, commit 77bee3b at 7:29 PM ET) shipped with a frontend spec written for another teammate's agent. Our Flow A plan ([user flows](01-user-flows.md)) had been written in parallel, before the backend existed. Two plans, two authors, one `client/` folder on `main`. Before writing any client code we diffed them line by line. 25 items came out.

**The rule we settled on:** the backend spec wins on every contract item (types, field names, tiers, endpoints, status codes). Our plan wins on UX the spec doesn't cover (stepper, error cards, timeouts, typed fallback). This file is kept as written at the time (about 7:30 PM ET); notes in *italics* say how each open item ended.

*Outcomes of the three decisions in §1: one owner for `client/` (Eric's agent); `client/` not `frontend/`; and shadcn-style components on Base UI. The design redo at 8:10 PM later went further, with Eric's approval, than the "middle ground" below ([design decisions](../design/decisions.md)).*

*§4 #18 and #19 were fixed: the real Greenbook snapshot loaded at 7:41 PM (8,943 products), so the "seed registry (1 product)" text left the fixtures. #20: after the snapshot, alert-042 still came back RED. The hero pack was later renamed, so its rows now read Malacure Forte / Sunrise Pharma rather than Lonart Forte / Greenlife (see the [process log](../process-log.md)).*

Checked on 24 Oct 2026 against `main` @ 77bee3b of EricIshekwene/hackohio-2026 (server/, shared/), and our docs in this folder (user-flows.md, flow-a-detailed.md, flow-a-diagram.*).

**Short version:** the spec matches the real `shared/` code closely, and the three fixtures produce exactly the demo verdicts it promises (I re-ran the fixture script; output is byte-identical, and the server's 24 tests pass). Nearly all the gaps are on our side: our Flow A docs predate the backend and use the wrong tiers, field names and JSON shapes. **The backend spec should win on every contract item.** Our docs should win on the UX details the spec doesn't cover (stepper, error cards, timeouts, manual-entry fallback).

## 1. Needs Eric's decision first

| # | Issue | Recommendation |
|---|---|---|
| 1 | **Who builds the frontend?** The spec is a prompt for *Jeremiah's* agent, writing `client/` and pushing straight to main. Project memory says Eric owns the frontend, and Eric has a separate frontend setup in progress. Two agents pushing to `client/` on main will collide. | Settle one owner, or split by screen (e.g. Eric: Capture + Confirm, Jeremiah: Verdict + Report) with one person scaffolding first. |
| 2 | **`client/` vs `frontend/`.** The server hard-codes `../../client/dist` for same-origin prod serving (server/src/app.ts). | **Spec wins: use `client/`.** Renaming only touches our docs and memory; `frontend/` would need a backend change. |
| 3 | **shadcn/ui + Base UI vs "no heavy UI libraries".** | **Middle ground.** shadcn copies components into the repo and Base UI is headless and tree-shaken, so a handful (Dialog for the legend, Input, Button) is not "heavy". Don't pull the whole set, don't add a web font beyond one, and take every verdict colour from `LEGEND`, never from a shadcn theme. Tell the backend team so it isn't a surprise. |

## 2. Our docs are wrong; the spec/code wins

| # | Our plan (flow-a-detailed.md) | Spec + real code | Do this |
|---|---|---|---|
| 4 | 3 tiers: red / amber / green | 4 tiers incl. grey `unsure` (shared/legend.ts) | Spec. Add unsure everywhere (banner, legend, icon `?`). |
| 5 | "Reg no. not in the snapshot" = **amber** | It's **red** (R1). Amber is strength/form mismatch, registration not active/expired, pack expired (R3 partial, R4, R6). Unsure is only "no reg no." (U1) | Spec. Our tier table and diagram give the wrong colour for the most common failure. |
| 6 | Confirm step **requires** a valid reg no. (regex blocks the button) | Backend expects a missing reg no. (`value: null`) and answers `unsure` (U1) | Spec. If we block empty reg nos, the unsure tier can never appear. Allow empty with a warning; keep the regex as a soft hint only. |
| 7 | 5 fields: productName, manufacturer, `regNo`, batchNo, `expiry` | 6 required: productName, **strength**, `nafdacRegNo`, manufacturer, batchNo, `expiryDate`; optional activeIngredient, dosageForm | Spec. Import `StandardizedMedicationInput` from `@shared/types`. |
| 8 | Field = `{ value, confidence, confirmed }`; editing sets confidence 1; per-row ✓ plus "Confirm all" | Field = `{ value \| null, confidence?, sourceText?, editedByUser }`; one top-level `confirmedByUser` | Spec for the payload. Editing sets `editedByUser: true` and leaves confidence alone; manual entry sends no confidence. Use the spec's single "These details match the pack" tap instead of per-row ticks (fewer taps, matches the API). Keep our low-confidence highlight. |
| 9 | `POST /api/check` body = flat values | Body = full `StandardizedMedicationInput`; 400 `invalid_input`, 422 `unconfirmed` | Spec. |
| 10 | Our own `Verdict` type (`level`, `mismatchedFields`, `sources`, `alert`) | `VerificationResult` (`verdict`, `legend`, `reasons: Finding[]`, `comparison`, `alertMatches[]`, `checked`, `notChecked`, `notes`, `dataAsOf`, `caveat`) | Spec. Delete our type; import from shared. |
| 11 | Comparison table only on the red-mismatch case, driven by `mismatchedFields` | Table from `result.comparison` on every verdict, highlight `match === false` | Spec. Showing it on green too (all ✓) also helps the video. |
| 12 | Our headlines ("No problems found in NAFDAC records", "We couldn't confirm…") | Headlines and labels come from `LEGEND` / `result.headline` | Spec. No hard-coded copy or colours. |
| 13 | `/api/extract` designed by us: multipart `image`, `{fields}` response, 422 unreadable, 429 budget | Aldez owns it; it must return `StandardizedMedicationInput` | Spec on ownership and shape. But **send our error cases to Aldez** (unreadable, budget hit, timeout): the spec says nothing about extract errors, and the frontend needs them. Keep our 15 s AbortController timeout. |
| 14 | Resize to 1200 px, JPEG 0.8 | 1000 px long edge, JPEG | Spec (1000 px). |
| 15 | Report = mailto link on red/amber | Report **screen**: `/api/report`, editable subject/body, name/phone/location/where bought, Send email + Call NAFDAC; shown on red, amber **and unsure** | Spec. Add `ReportScreen` to our component list. |
| 16 | `VITE_USE_MOCKS` with our own fake responses | Build against `shared/fixtures/` | **Both.** Keep the flag in `api.ts`, but make mock mode return the shared fixture results instead of hand-written mocks. Mock mode then shows exactly what the backend returns. |
| 17 | Footer "Records as of 20 Oct 2026" | "Registry snapshot: {date} · Last NAFDAC alert: {date}" + caveat on every verdict; never "live" | Spec. |

## 3. Things in our plan the spec doesn't cover (keep them)

- Stepper, Landing, Read loading skeleton, ErrorCard with Retry / Type it in, 15 s timeouts, "Try a sample pack" button. All compatible with the spec. Until extract exists, "Type it instead" is the main path, so the Read step only exists on the photo path.
- "Edit details" from the verdict back to Confirm. Fine, but it must require the confirm tap again before re-sending.
- "Share result" (`navigator.share`). Not in the spec; lowest priority.

## 4. Problems in the spec or backend itself

| # | Problem | Recommendation |
|---|---|---|
| 18 | **No amber or unsure fixture.** Fixtures cover only red, red, green, so two of the four verdict screens can't be built "against fixtures first". | Ask the backend team for an `amber` pack (e.g. strength mismatch on A4-6238) and an `unsure` pack (no reg no.) in `demo-packs.json`. Eric must ask, since the spec forbids frontend edits to `shared/`. |
| 19 | **Seed-data text will show up in the video.** Every fixture's `notes` includes "Running on the seed registry (1 product)…", and `checked` says "against 1 products". The spec says to render notes. | Backend should run `npm run snapshot:registry` and regenerate fixtures before recording, and fix "1 products". Don't filter notes in the client (the frontend must not rewrite results). |
| 20 | **alert-042's R1 depends on the seed registry.** It's red partly because 02-3457 isn't among the 1 seed product. With the full Greenbook loaded that number may exist, which changes its reasons and table. | After the snapshot, re-run `npm run fixtures` and confirm the 3 demo verdicts still hold. |
| 21 | Reg-no-not-found row has `match: false` with `inRegistry: null` (not `match: null`). | Render as "Not in NAFDAC registry" with ✕, not a blank cell; show "couldn't compare" only for `match === null`. |
| 22 | Report: the backend writes name/phone/location into the body. If the user fills those after the draft appears, the body is stale. | Show the optional inputs first, then call `/api/report` ("Draft report"), or re-call it when they change. Build `mailto` client-side from the edited subject/body (the spec already says this). |
| 23 | Error bodies also carry `message` (`ApiError`), which the spec's 400/422 description omits. | Use `ApiError` from shared; show `message`. |
| 24 | Some backend strings use raw dates ("Printed expiry date 2027-09"), against the "19 Aug 2026" rule. | Cosmetic. Ask backend to format; don't rewrite on the client. |
| 25 | Vite alias `@shared` → `../shared` points outside `client/`. Vite's dev server may refuse to serve it, and TS needs the path too. | Add `server.fs.allow: ['..']` in vite.config, a `paths` entry and `include: ['src', '../shared']` in tsconfig. |

## 5. Verified correct

- `shared/types.ts` and `shared/legend.ts` match the spec: 4 tiers, colours, labels, headlines, `GREEN_SUMMARY`, `CAVEAT`, endpoints, 400/422 behaviour, report response fields, `/api/meta` `dataAsOf`.
- Fixtures produce the promised demo verdicts:
  - **hero-cloned:** RED, R3. Rows for product name (Lonart Forte vs Artheget EZ) and manufacturer (Greenlife vs Getz) are `match: false`; reg no. and strength match.
  - **alert-042:** RED, R1 + R2. Alert 042/2026 (19 Aug 2026) with a URL, matched on batch + reg no.
  - **real-green:** GREEN, R5, exact `GREEN_SUMMARY`, caveat, and the note "NAFDAC registration for A4-6238 expires on 1 Dec 2026 (in 36 days)".

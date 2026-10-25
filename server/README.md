# MedCheck backend

Standardized JSON in, sourced verdict out. **No AI decides anything here**: the verdict, the reasons and the report text all come from code.

```bash
cd server && npm install
npm run dev          # API on http://localhost:3001
npm test             # rules engine + the 3 demo packs
npm run fixtures     # rewrite shared/fixtures/*.result.json (mock data for the frontend)
```

## Endpoints

| Method | Path | In | Out |
|---|---|---|---|
| GET | `/api/health` | | `{ ok: true }` |
| GET | `/api/meta` | | data dates, registry size, caveat |
| GET | `/api/legend` | | the 4 verdict tiers (labels, colours, meaning), worst first |
| POST | `/api/check` | `StandardizedMedicationInput` | `VerificationResult` (400 if malformed, 422 if `confirmedByUser` is false) |
| POST | `/api/report` | `{ input, result, reporter?, whereBought?, notes? }` | `ReportDraft` (prefilled NAFDAC email + mailto/tel links) |

`/api/explain` (Claude rewording, Pidgin) is a stretch goal.

## Photo reading: `POST /api/extract` (middleware layer, `src/extract/`)

`multipart/form-data` with one photo as `image` (or 1–3 photos of the same pack as `photos`) → `StandardizedMedicationInput` with `source: "photo"`, `confirmedByUser: false`, and per field `value`, `confidence`, `sourceText` (exactly what was printed) and `notes` (why confidence is low). Optional fields are only included when found. An extra `extraction` key (photoStatus, sidesSeen, model, cost) is ignored by `/api/check`.

- Photos are rotated, stripped of all metadata (GPS), resized to 1568 px and never stored.
- Claude Opus 5.5 transcribes; it never decides anything. Confidence = min(AI's estimate, code checks: reg-no shape, expiry parses, strength has a unit, characters swapped, value vs printed text).
- Status codes match the client: `404` key not set · `422` couldn't read / not medicine / several packs · `429` spend limit reached · `503` AI unavailable · `400`/`413` bad or too-large file.
- `GET /api/extract/status` → `{ enabled, model, spendUsd, spendLimitUsd }`. Spend is tracked in `data/spend.json` (gitignored).

Setup: copy the key to the clipboard, then `powershell -ExecutionPolicy Bypass -File scripts/set-key.ps1` (writes `.env`, never prints the key). Accuracy test: put photos + `expected.json` (see `testImg/expected.example.json`) in `testImg/`, then `npm run eval` (dry run) / `npm run eval -- --yes` (~$0.025 per photo).
Types live in `shared/types.ts`, the legend in `shared/legend.ts`.

## Rules (worst colour wins, every rule that fired is listed)

| Rule | When | Colour |
|---|---|---|
| R1 | Reg no. not in our Greenbook snapshot. Never RED: the snapshot is not exhaustive. Headline is "Unable to verify registration", or "Historical registration record found" / "Product listing found, registration unverified" when `data/references.json` has a record | AMBER |
| R2 | Batch or reg no. on a human-checked alert, and neither the product name nor the company contradicts the alert. A reg no. alone counts only if the number isn't in the registry | RED (AMBER if one detail differs, or only product + manufacturer match and the pack has no batch; no hit if name and company both differ) |
| R3 | Reg no. exists, but product name or active ingredient differs (or the licence holder differs too) | RED |
| R3 | Only the manufacturer differs and the pack names no "marketed by" holder (NAFDAC lists the Nigerian holder, not the factory) | AMBER |
| R3 | Reg no. exists, only strength or dosage form differs | AMBER |
| R3 | Product or company name matches only fuzzily (1–2 letters off, e.g. "Artheqet" vs "Artheget"): "Spelling differs from NAFDAC's record" | AMBER |
| R4 | Registration status not Active, or registration expired | AMBER |
| R6 | Pack's printed expiry has passed | AMBER |
| U1 | No reg no. on the pack | UNSURE |
| U2 | Reg no. had a letter O read as zero and still has no match: "Check the registration number" | UNSURE |
| U3 | Registry file could not be loaded: "Verification temporarily unavailable" | UNSURE |
| R5 | Nothing above fired | GREEN + "Not proof of authenticity" |

Every result also carries a machine-readable `status` (`registry_match_current`, `registry_match_historical`, `external_product_match`, `record_mismatch`, `confirmed_regulatory_alert`, `confirmed_inactive_or_cancelled`, `not_found_in_snapshot`, `lookup_unavailable`, `input_uncertain`), a `severity`, a `code` on every reason, `authenticityVerified: false`, and `evidence`: every source consulted, found or not, with its date and limitations. Precedence: alert > mismatch > inactive > current match > the rest; a listing never overrides an alert or a mismatch. Dates printed on a pack or registration are valid through the end of that day.

Registration expiring within 60 days adds a note but doesn't change the colour. Missing batch or expiry adds a "not checked" line.

## Data

- `data/seed-registry.json`: the one verified record (A4-6238) so everything runs before the snapshot.
- `data/registry.json`: the full Greenbook snapshot. Create it **once**, from a laptop, with `npm run snapshot:registry` (18 polite requests). Never call Greenbook from the browser or during the demo.
- `data/references.json`: non-Greenbook evidence with provenance (official historical NAFDAC documents, GS1 Nigeria, manufacturer catalogues). Only consulted when the number has no Greenbook row; never merged into the registry and never given a current status. Add a row only after reading the source. Coverage note: Greenbook only returns registrations expiring on or after about a year before the download date (27 Oct 2025 in the 24 Oct 2026 snapshot), so older lapsed or renumbered registrations (e.g. B4-0910, Aquamal QS tablets) are missing.
- `data/alerts.json`: human-checked alerts only (Alert 042/2026 is in). `npm run fetch:alerts` writes candidates to `data/raw/` for a person to check and copy across.

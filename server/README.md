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

`/api/extract` (image to JSON) belongs to the middleware layer; mount it in `src/app.ts`. `/api/explain` (Claude rewording, Pidgin) is a stretch goal.
Types live in `shared/types.ts`, the legend in `shared/legend.ts`.

## Rules (worst colour wins, every rule that fired is listed)

| Rule | When | Colour |
|---|---|---|
| R1 | Reg no. not in the registry | RED |
| R2 | Batch or reg no. on a human-checked alert | RED (AMBER if only product + manufacturer match and the pack has no batch) |
| R3 | Reg no. exists, but product name, manufacturer or active ingredient differs | RED |
| R3 | Reg no. exists, only strength or dosage form differs | AMBER |
| R4 | Registration status not Active, or registration expired | AMBER |
| R6 | Pack's printed expiry has passed | AMBER |
| U1 | No reg no. on the pack | UNSURE |
| R5 | Nothing above fired | GREEN + "Not proof of authenticity" |

Registration expiring within 60 days adds a note but doesn't change the colour. Missing batch or expiry adds a "not checked" line.

## Data

- `data/seed-registry.json`: the one verified record (A4-6238) so everything runs before the snapshot.
- `data/registry.json`: the full Greenbook snapshot. Create it **once**, from a laptop, with `npm run snapshot:registry` (18 polite requests). Never call Greenbook from the browser or during the demo.
- `data/alerts.json`: human-checked alerts only (Alert 042/2026 is in). `npm run fetch:alerts` writes candidates to `data/raw/` for a person to check and copy across.

# MedCheck

**Check a medicine pack against NAFDAC's records.** HackOHI/O 2026, Open Challenge track.

Falsified medicines are a daily risk in Nigeria, and a common trick is printing a *real* NAFDAC registration number on a fake product. MedCheck lets a pharmacist or caregiver photograph a pack, confirm what was read, and see whether the pack matches what NAFDAC actually registered, with the evidence side by side.

- **AI reads, code decides.** Claude only transcribes the label from 1–3 photos. The verdict comes from deterministic rules over NAFDAC's own data, and every finding cites its source.
- **The user confirms first.** Nothing is checked until the person has looked at every field the AI read. Low-confidence reads are highlighted and must be looked at.
- **Never says "genuine".** Four tiers: *Do not use* (red), *Check before use* (amber), *We couldn't check this* (unsure), *No problems found* (green, always with "Not proof of authenticity").
- **Reporting built in.** A drafted email or call to NAFDAC's pharmacovigilance line, which the user reviews and sends themselves.

Live demo (mock data, runs in the browser): https://claude.ai/artifact/G3B3z7PSve7DLFKuVQTXHx

**Research, planning and process:** [docs/](docs/README.md) covers how we chose the problem, the user flows, the verdict rules, the design, the pivots, and how we used and validated AI.

## How it works

```
photos ──► /api/extract (Claude: transcribe 9 fields + confidence) ──► Confirm screen (user checks every field)
                                                                              │
typed details ───────────────────────────────────────────────────────────────┤
                                                                              ▼
                        /api/check (rules engine over the Greenbook snapshot + checked alerts)
                                                                              │
                                     verdict, findings with sources, pack vs record ──► /api/report (draft to NAFDAC)
```

Full rules: `server/README.md`.

| Rule | When | Colour |
|---|---|---|
| R1 | Reg. no. not in the registry snapshot (never red: the snapshot isn't exhaustive) | amber |
| R2 | Batch or reg. no. on a human-checked NAFDAC alert | red (amber if a detail contradicts the alert) |
| R3 | Reg. no. exists but the product, ingredient or licence holder differs (the cloned-number case) | red / amber |
| R4 | Registration not active or expired | amber |
| R6 | Pack past its printed expiry | amber |
| U1 | No reg. no. on the pack | unsure |
| R5 | Nothing above fired | green + "Not proof of authenticity" |

## Run it

Needs Node 22+.

```bash
# 1. Backend + photo reading (http://localhost:3001)
cd server && npm install
cp .env.example .env        # optional: add ANTHROPIC_API_KEY to turn on photo reading
npm run dev

# 2. Frontend (http://localhost:5173, proxies /api to :3001)
cd client && npm install
npm run dev
```

- **No server, no key:** `cd client && npm run dev:mocks`. Answers come from the backend's own recorded results for three demo packs.
- **Without `ANTHROPIC_API_KEY`:** everything works except photo reading; the app offers "Type the details" instead.
- **One process:** `cd client && npm run build`, then `cd server && npm start` serves the app and the API on :3001. Add `?demo` to the URL for the demo-pack shortcuts.
- **On a phone:** the live camera needs HTTPS. `cd client && npm run dev:phone` serves over HTTPS on your LAN (accept the certificate once), or tunnel the built app: `npx cloudflared tunnel --url http://localhost:3001`.
- **Tests:** `cd server && npm test` (rules engine, extraction cleanup, demo packs).

## Stack

- **Client** (`client/`): React 19, TypeScript, Vite, Tailwind v4, shadcn-style components on Base UI, Geist. Mobile-first; every step fits one phone screen. Live camera via `getUserMedia`, with fallbacks for blocked, missing or insecure cameras.
- **Server** (`server/`): Node, Express 5, TypeScript. Rules engine, report drafting, and the `/api/extract` middleware (multer + sharp: photos are rotated, stripped of GPS/EXIF, resized and never stored).
- **AI**: Claude via the Anthropic SDK with structured output, used only to transcribe the pack. Confidence is capped by code checks (reg-no shape, dates, units, look-alike characters). Spend is tracked and paused at a budget.
- **Shared** (`shared/`): the TypeScript contracts all three layers import, the verdict legend, and the demo-pack fixtures.

## Data

- **NAFDAC Greenbook** (https://greenbook.nafdac.gov.ng/): a snapshot of 8,943 registered products taken on 25 Oct 2026, in `data/registry.json`. It is refreshed by `npm run snapshot:registry` and a scheduled GitHub Action. The app never calls Greenbook live.
- **NAFDAC public alerts**: human-checked only, in `data/alerts.json`. Currently Public Alert 042/2026 (falsified Artemether/Lumefantrine, 19 Aug 2026). `npm run fetch:alerts` collects candidates for a person to check.
- Every result shows the snapshot and alert dates it was checked against.

## Repo map

- `client/`: the web app (see `client/README.md`)
- `server/`: API, rules and photo reading (see `server/README.md`)
- `shared/`: contracts, legend, fixtures
- `data/`: registry snapshot and checked alerts
- `tools/marketing-media/`: records the real running app into screenshots and videos
- `docs/`: research, planning, design, process log, challenges, AI use and validation (start at `docs/README.md`)

## Limits

MedCheck checks a pack's printed details against NAFDAC's registry and alerts. It cannot see the tablets, the seal or the print quality, so a pack that passes can still be fake. That is why the green result always says "Not proof of authenticity", and why reporting is one tap from every result.

## Team

Built at HackOHI/O 2026 by Eric Ishekwene ([@EricIshekwene](https://github.com/EricIshekwene)), Aldez and Jeremiah.

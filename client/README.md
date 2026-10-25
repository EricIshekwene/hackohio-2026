# MedCheck client

React + TypeScript + Vite + Tailwind v4, mobile-first (430 px column). Types, legend and fixtures come from `../shared`; nothing here redefines them.

```bash
cd client && npm install
npm run dev          # http://localhost:5173, proxies /api to the server on :3001
npm run dev:mocks    # no server needed: /api/check and /api/report answer from shared/fixtures
npm run build        # client/dist, which the server serves on :3001
```

- `VITE_USE_MOCKS=true` serves the backend's own fixture output (and runs the server's report builder), so the demo never depends on the network. Mock mode only knows the three demo packs; the photo path "reads" the hero pack.
- `VITE_API_URL` overrides the API origin (default: same origin).
- `/api/extract` is the middleware's route. Until it exists, the photo path shows "Photo reading isn't switched on yet" with a "Type it in" fallback.
- Screens: Landing (with demo-pack chips) → Snap → Read → Confirm → Verdict → Report. State is one `useReducer` in `src/state.ts`.
- The client never decides or rewrites a verdict: headline, label, summary, reasons and colours are rendered from `/api/check` as sent.

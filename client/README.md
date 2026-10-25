# MedCheck client

React + TypeScript + Vite + Tailwind v4 + shadcn/ui-style components on Base UI (`src/components/ui`), mobile-first (430 px column). Design system: black-and-white UI, Pakistan Green as the brand accent only, Geist; see https://claude.ai/artifact/M7eM2TXosBK6pBmYdPAd2b. Every step fits a 390 × 844 viewport; detail lives in tabs and bottom sheets. Types, legend and fixtures come from `../shared`; nothing here redefines them.

```bash
cd client && npm install
npm run dev          # http://localhost:5173, proxies /api to the server on :3001
npm run dev:mocks    # no server needed: /api/check and /api/report answer from shared/fixtures
npm run build        # client/dist, which the server serves on :3001
npm run dev:phone    # HTTPS on your LAN (self-signed, accept once) so a phone gets the live camera
```

**Demo on a phone.** The live camera needs `https` or `localhost`. Either run `npm run dev:phone` (server on :3001 too) and open the `https://<laptop-ip>:5173` it prints, or `npm run build`, start the server, and `npx cloudflared tunnel --url http://localhost:3001` for a real HTTPS link with no warning. On plain `http://<ip>` the Snap step still works through the phone's camera app, without the live preview.

- `VITE_USE_MOCKS=true` serves the backend's own fixture output (and runs the server's report builder), so the demo never depends on the network. Mock mode only knows the three demo packs; the photo path "reads" the hero pack.
- `VITE_API_URL` overrides the API origin (default: same origin).
- Snap is a live `getUserMedia` preview (asks for permission first; handles blocked, busy, no camera and http) and collects 1 to 3 photos of the pack from any side, from the camera or the photo library (several at once). All of them go to `/api/extract` as `photos` in one call. With no `ANTHROPIC_API_KEY` on the server, Read says photo reading isn't switched on and offers typing.
- Screens: Start → Snap → Read → Confirm → Checking → Result (Compare / Why / Checked tabs) → Report. The typed path is Type → Check → Result. Browser back steps back through the flow. State is one `useReducer` in `src/state.ts`.
- Demo packs show on the start screen only in mock mode.
- The client never decides or rewrites a verdict: headline, label, summary, reasons and colours are rendered from `/api/check` as sent.

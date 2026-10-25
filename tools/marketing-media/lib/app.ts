import { APP_URL } from './config.ts';

// The pipeline records the real app: server/ (rules engine + registry snapshot) serving client/dist.
// Start it with: (cd client && npm run build) && (cd server && npm start)
export async function ensureApp() {
  try {
    const res = await fetch(new URL('/api/meta', APP_URL));
    if (!res.ok) throw new Error(String(res.status));
    const meta = (await res.json()) as { registry: { total: number; isSeed: boolean } };
    if (meta.registry.isSeed) throw new Error('the server is on the 1-record seed registry, not the Greenbook snapshot');
  } catch (e) {
    throw new Error(`MedCheck isn't running at ${APP_URL} (${(e as Error).message}). Build client/ and start server/ first; see README.md.`);
  }
}

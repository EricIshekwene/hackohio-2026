import { appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { ApiError, ReportRequest } from '../../shared/types';
import { CAVEAT, LEGEND_LIST } from '../../shared/legend';
import { extractRouter } from './extract/route';
import { DATA_DIR, getDataset, type Dataset } from './services/data';
import { buildReport } from './services/report';
import { checkMedication } from './services/rules';
import { validateInput } from './services/validate';

function fail(res: Response, status: number, body: ApiError) {
  res.status(status).json(body);
}

const MAX_REPORT_TEXT = 1000;

// The optional free-text parts of a report: strings only, bounded.
function validateReportExtras(body: ReportRequest | undefined): string[] {
  const errors: string[] = [];
  const text = (name: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (typeof v !== 'string') errors.push(`${name} must be a string`);
    else if (v.length > MAX_REPORT_TEXT) errors.push(`${name} must be at most ${MAX_REPORT_TEXT} characters`);
  };
  const reporter = body?.reporter as unknown;
  if (reporter !== undefined && reporter !== null && typeof reporter !== 'object') errors.push('reporter must be an object');
  else if (reporter) for (const k of ['name', 'phone', 'location'] as const) text(`reporter.${k}`, (reporter as Record<string, unknown>)[k]);
  text('whereBought', body?.whereBought);
  text('notes', body?.notes);
  return errors;
}

export function createApp(opts: { dataset?: Dataset; now?: () => Date } = {}) {
  const ds = () => opts.dataset ?? getDataset();
  const now = opts.now ?? (() => new Date());
  const app = express();
  // Behind one hosting proxy (Railway/Render), so req.ip is the visitor, not the proxy. Set TRUST_PROXY=0 when exposed directly.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.use(express.json({ limit: '1mb' }));

  // Dev CORS for the Vite client (prod serves the client from this same origin).
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/meta', (_req, res) => {
    const d = ds();
    res.json({
      dataAsOf: { registrySnapshot: d.registry.snapshotDate, lastAlert: d.lastAlertDate },
      registry: { total: d.registry.total, source: d.registry.source, url: d.registry.sourceUrl, isSeed: d.registry.isSeed },
      alerts: { total: d.alerts.length, humanChecked: true },
      caveat: CAVEAT,
    });
  });

  app.get('/api/legend', (_req, res) => {
    const d = ds();
    res.json({ legend: LEGEND_LIST, caveat: CAVEAT, dataAsOf: { registrySnapshot: d.registry.snapshotDate, lastAlert: d.lastAlertDate } });
  });

  app.post('/api/check', (req, res) => {
    const v = validateInput(req.body);
    if (!v.ok) return fail(res, 400, { error: 'invalid_input', message: 'Input does not match StandardizedMedicationInput.', details: v.errors });
    if (!v.input.confirmedByUser) return fail(res, 422, { error: 'unconfirmed', message: 'Confirm every field before checking.' });
    res.json(checkMedication(v.input, ds(), now()));
  });

  app.post('/api/report', async (req, res) => {
    const body = req.body as ReportRequest;
    const v = validateInput(body?.input);
    const extra = validateReportExtras(body);
    if (!v.ok || extra.length) return fail(res, 400, { error: 'invalid_input', message: 'Send { input, result } from /api/check.', details: v.ok ? extra : [...v.errors, ...extra] });
    // Re-run the check rather than trust the posted result: the reasons in the email are always code-produced,
    // and a stale or hand-made result can't crash the draft.
    const result = checkMedication(v.input, ds(), now());
    const draft = buildReport({ ...body, result });
    // Log the draft only: no photos, no reporter contact details.
    const log = { at: now().toISOString(), verdict: result.verdict, rules: result.reasons.map((r) => r.rule), fields: Object.fromEntries(Object.entries(v.input.fields).map(([k, f]) => [k, f?.value ?? null])), location: body.reporter?.location ?? null };
    appendFile(path.join(DATA_DIR, 'reports.ndjson'), `${JSON.stringify(log)}\n`).catch(() => {});
    res.json(draft);
  });

  // Middleware layer: photo -> StandardizedMedicationInput (see src/extract/).
  app.use('/api', extractRouter);
  // /api/explain (Claude rewording) is a stretch goal.

  // Production: serve the built client from the same origin.
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use('/api', (_req, res) => fail(res, 404, { error: 'not_found', message: 'No such endpoint.' }));
  app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') return fail(res, 400, { error: 'invalid_input', message: 'Body is not valid JSON.' });
    console.error(err);
    fail(res, 500, { error: 'server_error', message: 'Something went wrong.' });
  });
  return app;
}

// POST /api/extract: 1–3 photos of one pack -> StandardizedMedicationInput (unconfirmed).
// Status codes follow what the client expects (client/src/screens/Read.tsx):
// 404 photo reading not switched on · 422 couldn't read the pack · 429 paused (budget) · 503 AI unavailable.
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type { ApiError, ExtractResponse } from '../../../shared/types';
import { aiConfigured, ExtractError, extractFromImages, modelName } from './claude';
import { toMedicationInput } from './fields';
import { ACCEPTED_MIME, prepareImage } from './images';
import { overLimit, spendLimit, totalSpend } from './spend';

const MAX_MB = 10;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
}).fields([
  { name: 'image', maxCount: 1 }, // what the client sends today
  { name: 'photos', maxCount: 3 }, // front + back + flap
]);

const fail = (res: Response, status: number, body: ApiError) => res.status(status).json(body);

// Per-IP cap on AI calls so one visitor can't spend the whole budget. In memory: resets on restart.
const WINDOW_MS = 60 * 60 * 1000;
const perHour = () => Number(process.env.EXTRACT_PER_IP_PER_HOUR) || 30;
const calls = new Map<string, number[]>();

export function takeExtractSlot(ip: string, at = Date.now()): boolean {
  const recent = (calls.get(ip) ?? []).filter((t) => at - t < WINDOW_MS);
  if (recent.length >= perHour()) {
    calls.set(ip, recent);
    return false;
  }
  recent.push(at);
  calls.set(ip, recent);
  if (calls.size > 10_000) for (const [k, ts] of calls) if (!ts.some((t) => at - t < WINDOW_MS)) calls.delete(k);
  return true;
}

export const resetExtractSlots = () => calls.clear();

export const extractRouter = Router();

extractRouter.get('/extract/status', (_req, res) => {
  res.json({ enabled: aiConfigured() && !overLimit(), model: modelName(), spendUsd: Number(totalSpend().toFixed(4)), spendLimitUsd: spendLimit() });
});

extractRouter.post(
  '/extract',
  (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 413, { error: 'invalid_input', message: `Photo is too large (max ${MAX_MB} MB).` });
        if (err.code === 'LIMIT_FILE_COUNT') return fail(res, 400, { error: 'invalid_input', message: 'Send at most 3 photos.' });
        return fail(res, 400, { error: 'invalid_input', message: 'Send a JPEG, PNG or WebP photo.' });
      }
      if (err) return next(err);
      next();
    });
  },
  async (req: Request, res: Response) => {
    const groups = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const files = [...(groups.image ?? []), ...(groups.photos ?? [])];
    if (files.length === 0) return fail(res, 400, { error: 'invalid_input', message: 'Attach a photo as "image".' });
    if (files.length > 3) return fail(res, 400, { error: 'invalid_input', message: 'Send at most 3 photos.' });
    if (!aiConfigured()) return fail(res, 404, { error: 'not_found', message: "Photo reading isn't switched on." });
    if (overLimit()) return fail(res, 429, { error: 'server_error', message: 'Photo reading is paused (AI budget reached).' });
    if (!takeExtractSlot(req.ip ?? 'unknown')) return fail(res, 429, { error: 'server_error', message: 'Too many photos from this device. Type the details from the pack instead, or try again later.' });

    let images: Buffer[];
    try {
      images = await Promise.all(files.map((f) => prepareImage(f.buffer)));
    } catch {
      return fail(res, 400, { error: 'invalid_input', message: "That file couldn't be opened as a photo." });
    }

    try {
      const { raw, costUsd, model } = await extractFromImages(images);
      if (raw.photoStatus === 'multiple_packs') {
        return fail(res, 422, { error: 'invalid_input', message: 'Photograph one pack at a time.' });
      }
      if (raw.photoStatus === 'not_medicine') {
        return fail(res, 422, { error: 'invalid_input', message: "This doesn't look like a medicine pack." });
      }
      // Extra `extraction` key is ignored by /api/check's validator.
      return res.json({ ...toMedicationInput(raw), extraction: { photoStatus: raw.photoStatus, sidesSeen: raw.sidesSeen, model, costUsd } } satisfies ExtractResponse);
    } catch (err) {
      if (!(err instanceof ExtractError)) throw err;
      console.warn(`[extract] ${err.reason}: ${err.message}`);
      if (err.reason === 'not_configured') return fail(res, 404, { error: 'not_found', message: "Photo reading isn't switched on." });
      if (err.reason === 'api_error') return fail(res, 503, { error: 'server_error', message: 'Photo reading is unavailable right now. Type the details from the pack instead.' });
      return fail(res, 422, { error: 'invalid_input', message: "We couldn't read the pack." });
    }
  },
);

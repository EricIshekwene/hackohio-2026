import type {
  ApiError,
  ExtractionInfo,
  ExtractResponse,
  LegendEntry,
  ReportDraft,
  ReportRequest,
  StandardizedMedicationInput,
  VerificationResult,
} from '@shared/types';
import { LEGEND_LIST } from '@shared/legend';
import demoPacks from '@shared/fixtures/demo-packs.json';
import heroCloned from '@shared/fixtures/hero-cloned.result.json';
import alert042 from '@shared/fixtures/alert-042.result.json';
import realGreen from '@shared/fixtures/real-green.result.json';
import type { Photo } from '@/lib/photos';

// VITE_USE_MOCKS=true serves the backend's own fixture output, so the demo video never depends on the network.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const TIMEOUT_MS = 15_000;
const EXTRACT_TIMEOUT_MS = 45_000; // one AI call reads up to three photos

export type DemoPackId = 'hero-cloned' | 'alert-042' | 'real-green';

export const DEMO_PACKS: { id: DemoPackId; label: string; input: StandardizedMedicationInput }[] = [
  { id: 'hero-cloned', label: 'Cloned reg. no.', input: demoPacks['hero-cloned'] as StandardizedMedicationInput },
  { id: 'alert-042', label: 'On NAFDAC alert', input: demoPacks['alert-042'] as StandardizedMedicationInput },
  { id: 'real-green', label: 'Registered pack', input: demoPacks['real-green'] as StandardizedMedicationInput },
];

const FIXTURE_RESULTS: Record<DemoPackId, VerificationResult> = {
  'hero-cloned': heroCloned as VerificationResult,
  'alert-042': alert042 as VerificationResult,
  'real-green': realGreen as VerificationResult,
};

export class RequestError extends Error {
  constructor(
    public kind: 'network' | 'timeout' | 'api' | 'cancelled',
    message: string,
    public status?: number,
    public body?: ApiError,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // The caller can cancel too (the user left the screen); that is not a timeout.
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (signal?.aborted) throw new RequestError('cancelled', 'Cancelled.');
    if ((e as Error).name === 'AbortError') throw new RequestError('timeout', 'That took too long. Check your connection and try again.');
    throw new RequestError('network', "We couldn't reach MedCheck. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const body = data as ApiError | null;
    throw new RequestError('api', body?.message ?? 'Something went wrong.', res.status, body ?? undefined);
  }
  return data as T;
}

const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function matchDemoPack(input: StandardizedMedicationInput): DemoPackId | null {
  const keys = ['productName', 'nafdacRegNo', 'manufacturer', 'batchNo'] as const;
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const hit = DEMO_PACKS.find((p) => keys.every((k) => norm(p.input.fields[k].value) === norm(input.fields[k]?.value)));
  return hit?.id ?? null;
}

export async function checkMedication(input: StandardizedMedicationInput): Promise<VerificationResult> {
  if (!USE_MOCKS) return postJson('/api/check', input);
  await delay(700);
  if (!input.confirmedByUser) throw new RequestError('api', 'Confirm every field before checking.', 422);
  const id = matchDemoPack(input);
  if (!id) throw new RequestError('api', 'Mock mode only knows the three demo packs. Start the server for real checks.', 400);
  return clone(FIXTURE_RESULTS[id]);
}

export async function draftReport(req: ReportRequest): Promise<ReportDraft> {
  if (!USE_MOCKS) return postJson('/api/report', req);
  // Same code the server runs, so the mock draft is word-for-word what /api/report returns.
  const { buildReport } = await import('../../../server/src/services/report');
  return buildReport(req);
}

// /api/extract is the middleware's route: 1–3 photos of one pack -> StandardizedMedicationInput.
// In mock mode it "reads" the hero pack, with one low-confidence field so the review step shows.
export async function extractFromPhotos(photos: Photo[], signal?: AbortSignal): Promise<{ input: StandardizedMedicationInput; extraction: ExtractionInfo | null }> {
  if (USE_MOCKS) {
    await delay(1800);
    if (signal?.aborted) throw new RequestError('cancelled', 'Cancelled.');
    const input = clone(DEMO_PACKS[0].input);
    input.source = 'photo';
    input.confirmedByUser = false;
    const conf: Record<string, number> = { productName: 0.97, strength: 0.93, nafdacRegNo: 0.95, manufacturer: 0.91, batchNo: 0.64, expiryDate: 0.88 };
    for (const [k, f] of Object.entries(input.fields)) {
      if (!f) continue;
      f.confidence = conf[k] ?? 0.9;
      f.sourceText = k === 'batchNo' ? 'BATCH N0: GL22I0' : (f.value ?? '');
    }
    if (input.fields.batchNo) input.fields.batchNo.notes = ['AI\'s value differs from the printed text "BATCH N0: GL22I0"'];
    const sides = ['front', 'back', 'side'] as const;
    return { input, extraction: { photoStatus: 'ok', sidesSeen: photos.map((_, i) => ({ photo: i + 1, side: sides[i] })), model: 'mock', costUsd: 0 } };
  }
  const form = new FormData();
  photos.forEach((p, i) => form.append('photos', p.blob, `photo-${i + 1}.jpg`));
  // Reading takes ~6–15 s (one AI call for the whole set), so give it more room than the other endpoints.
  const { extraction, ...input } = await request<ExtractResponse>('/api/extract', { method: 'POST', body: form }, EXTRACT_TIMEOUT_MS, signal);
  return { input: { ...input, source: 'photo', confirmedByUser: false }, extraction: extraction ?? null };
}

export interface Meta {
  dataAsOf: { registrySnapshot: string; lastAlert: string };
}

export async function getMeta(): Promise<Meta> {
  if (USE_MOCKS) return { dataAsOf: (heroCloned as VerificationResult).dataAsOf };
  return request('/api/meta');
}

export const LEGEND: LegendEntry[] = LEGEND_LIST;

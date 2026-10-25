import type {
  ApiError,
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

// VITE_USE_MOCKS=true serves the backend's own fixture output, so the demo video never depends on the network.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const TIMEOUT_MS = 15_000;

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
    public kind: 'network' | 'timeout' | 'api',
    message: string,
    public status?: number,
    public body?: ApiError,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, signal: ctrl.signal });
  } catch (e) {
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

// /api/extract is the middleware's route (photo -> StandardizedMedicationInput). In mock mode it
// "reads" the hero pack, with one low-confidence field so the review step shows.
export async function extractFromPhoto(photo: Blob): Promise<StandardizedMedicationInput> {
  if (USE_MOCKS) {
    await delay(1800);
    const input = clone(DEMO_PACKS[0].input);
    input.source = 'photo';
    input.confirmedByUser = false;
    const conf: Record<string, number> = { productName: 0.97, strength: 0.93, nafdacRegNo: 0.95, manufacturer: 0.91, batchNo: 0.64, expiryDate: 0.88 };
    for (const [k, f] of Object.entries(input.fields)) {
      if (!f) continue;
      f.confidence = conf[k] ?? 0.9;
      f.sourceText = k === 'batchNo' ? 'BATCH N0: GL22I0' : (f.value ?? '');
    }
    return input;
  }
  const form = new FormData();
  form.append('image', photo, 'pack.jpg');
  const result = await request<StandardizedMedicationInput>('/api/extract', { method: 'POST', body: form });
  return { ...result, source: 'photo', confirmedByUser: false };
}

export interface Meta {
  dataAsOf: { registrySnapshot: string; lastAlert: string };
}

export async function getMeta(): Promise<Meta> {
  if (USE_MOCKS) return { dataAsOf: (heroCloned as VerificationResult).dataAsOf };
  return request('/api/meta');
}

export const LEGEND: LegendEntry[] = LEGEND_LIST;

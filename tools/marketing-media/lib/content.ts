import fs from 'node:fs';
import path from 'node:path';
import type { ExtractResponse, FieldKey, PackSide, StandardizedMedicationInput, Verdict } from '../../../shared/types.ts';
import { ROOT } from './config.ts';

// A real pack photographed by someone else, used under its licence (see DECISIONS.md).
export interface PackPhoto {
  file: string; // content/photos/<file>
  side: PackSide;
  title: string;
  author: string;
  licence: string;
  sourceUrl: string;
}

// One pack the media shows. `printed` is exactly what the pack says, transcribed by a person from the photo.
// The verdict is never stored here: it comes from the real /api/check at render time. `expect` only guards the
// story (a scene titled "caught it" must really come back red); a mismatch fails the render.
export interface Pack {
  id: string;
  title: string;
  story: string;
  expect: Verdict;
  photos: PackPhoto[];
  printed: Partial<Record<FieldKey, string>>;
  // How sure the photo reader would be per field. Only used by the extract stand-in (see DECISIONS.md D6).
  confidence?: Partial<Record<FieldKey, number>>;
  provenance?: string;
}

const DIR = path.join(ROOT, 'content');

export function loadPacks(): Pack[] {
  const file = path.join(DIR, 'packs.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { packs: Pack[] };
  return raw.packs;
}

export function getPack(id: string): Pack {
  const p = loadPacks().find((x) => x.id === id);
  if (!p) throw new Error(`No pack "${id}" in content/packs.json`);
  return p;
}

export const photoPath = (p: PackPhoto) => path.join(DIR, 'photos', p.file);

const REQUIRED: FieldKey[] = ['productName', 'strength', 'nafdacRegNo', 'manufacturer', 'batchNo', 'expiryDate'];

// What the confirmed form sends, built from the printed text (the typed path and the verdict provenance check).
export function packInput(pack: Pack, source: 'photo' | 'manual' = 'manual'): StandardizedMedicationInput {
  const fields = {} as StandardizedMedicationInput['fields'];
  for (const k of REQUIRED) fields[k] = { value: pack.printed[k] ?? null, editedByUser: false };
  for (const [k, v] of Object.entries(pack.printed) as [FieldKey, string][]) {
    if (!REQUIRED.includes(k)) fields[k] = { value: v, editedByUser: false };
  }
  return { source, confirmedByUser: true, fields };
}

// Stand-in for /api/extract when no AI key is set: returns the person's transcription in the
// exact shape the real middleware returns. It never changes a value; the verdict still comes from /api/check.
export function standInExtract(pack: Pack): ExtractResponse {
  const input = packInput(pack, 'photo');
  input.confirmedByUser = false;
  for (const [k, f] of Object.entries(input.fields) as [FieldKey, NonNullable<StandardizedMedicationInput['fields'][FieldKey]>][]) {
    if (f.value == null) continue;
    f.confidence = pack.confidence?.[k] ?? 0.95;
    f.sourceText = f.value;
  }
  return {
    ...input,
    extraction: {
      photoStatus: 'ok',
      sidesSeen: pack.photos.map((p, i) => ({ photo: i + 1, side: p.side })),
      model: 'stand-in (human transcription)',
      costUsd: 0,
    },
  };
}

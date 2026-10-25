// Loads the registry snapshot and the alert list once at startup. Never calls Greenbook at runtime.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { EvidenceRecord, RegistryRecord, SourceType } from '../../../shared/types';
import { normalizeBatch, regNoKey } from './normalize';

export interface AlertProduct {
  productName?: string;
  activeIngredient?: string;
  strength?: string;
  manufacturer?: string;
  batches?: string[];
  regNo?: string;
}

export interface Alert {
  id: string;
  source: 'NAFDAC' | 'WHO';
  alertNo: string;
  title: string;
  date: string;
  url: string;
  location?: string;
  products: AlertProduct[];
  humanChecked: boolean;
}

// A product record from outside the Greenbook (historical NAFDAC document, GS1, manufacturer catalogue).
// Evidence only: never merged into the registry, never given a current status.
export interface ReferenceRecord extends Omit<EvidenceRecord, 'found' | 'sourcePublishedAt'> {
  sourceType: SourceType;
  registrationNumber: string;
  sourcePublishedAt?: string | null;
}

export interface Dataset {
  registry: {
    snapshotDate: string; // the day the snapshot was downloaded, not a NAFDAC publication date
    total: number;
    source: string;
    sourceUrl: string;
    isSeed: boolean;
    available: boolean; // false = the registry file could not be loaded; never treat that as "not found"
    earliestRegExpiry: string | null; // Greenbook drops registrations that lapsed before roughly this date
  };
  byRegNo: Map<string, RegistryRecord[]>;
  products: RegistryRecord[];
  references: Map<string, ReferenceRecord[]>;
  alerts: Alert[];
  lastAlertDate: string;
  alertsByBatch: Map<string, Alert[]>;
  alertsByRegNo: Map<string, Alert[]>;
}

export const DATA_DIR = process.env.MEDCHECK_DATA_DIR ?? path.resolve(__dirname, '../../../data');

function readJson(file: string) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function push<K, V>(map: Map<K, V[]>, key: K | null, value: V) {
  if (key == null) return;
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function loadRegistry(dir: string) {
  const snapshotFile = path.join(dir, 'registry.json');
  const isSeed = !existsSync(snapshotFile);
  try {
    return { reg: readJson(isSeed ? path.join(dir, 'seed-registry.json') : snapshotFile), isSeed, available: true };
  } catch (e) {
    console.error('registry could not be loaded; checks will say "verification unavailable"', e);
    return { reg: { snapshotDate: 'unknown', products: [] }, isSeed, available: false };
  }
}

// A trailing Greenbook editor's note in brackets. Real name parts in brackets ("(Medium)", "(IM)") are kept.
const EDITOR_NOTE = /[\s*_]*\((duplicate|updates needed|smpc|incorrect|incomplete|wrong smpc|check |needs info|no applicant|nrn )[^)]*\)?\s*$/i;

export function loadDataset(dir = DATA_DIR): Dataset {
  const { reg, isSeed, available } = loadRegistry(dir);
  // Greenbook pads names with "##"/"_" and marks some with "**", a leading "#" or a trailing "$"; strip them.
  // Some carry an editor's note ("Eutram 100 Capsules** (duplicate NRN)", "Loranax Tablets_ (duplicate)",
  // "(incorrect SMPC)"): not part of the name, so it must not reach messages or name matching.
  const products: RegistryRecord[] = (reg.products as RegistryRecord[])
    .filter((p) => p && typeof p.regNo === 'string')
    .map((p) => ({
      ...p,
      productName: String(p.productName ?? '')
        .replace(/\*\*+\s*(\(.*)?$/, '')
        .replace(EDITOR_NOTE, '')
        .replace(/^[#*\s]+|[#*_$\s]+$/g, ''),
      applicant: String(p.applicant ?? '').replace(/&amp;/g, '&'),
      strength: String(p.strength ?? ''),
      status: String(p.status ?? 'unknown'),
    }));
  const earliestRegExpiry = products.map((p) => p.expiryDate).filter((d): d is string => !!d).sort()[0] ?? null;

  const references = new Map<string, ReferenceRecord[]>();
  const refFile = path.join(dir, 'references.json');
  if (existsSync(refFile)) {
    for (const r of readJson(refFile).records as ReferenceRecord[]) push(references, regNoKey(r.registrationNumber), r);
  }

  const byRegNo = new Map<string, RegistryRecord[]>();
  for (const p of products) push(byRegNo, regNoKey(p.regNo), p);

  const al = readJson(path.join(dir, 'alerts.json'));
  // Only human-checked rows go live.
  const alerts: Alert[] = (al.alerts as Alert[]).filter((a) => a.humanChecked);
  const alertsByBatch = new Map<string, Alert[]>();
  const alertsByRegNo = new Map<string, Alert[]>();
  for (const a of alerts) {
    for (const p of a.products) {
      for (const b of p.batches ?? []) push(alertsByBatch, normalizeBatch(b), a);
      push(alertsByRegNo, regNoKey(p.regNo), a);
    }
  }

  const lastAlertDate =
    al.lastAlertDate ?? alerts.filter((a) => a.source === 'NAFDAC').map((a) => a.date).sort().at(-1) ?? 'unknown';

  return {
    registry: {
      snapshotDate: reg.snapshotDate,
      total: reg.total ?? products.length,
      source: reg.source ?? 'NAFDAC Greenbook',
      sourceUrl: reg.sourceUrl ?? 'https://greenbook.nafdac.gov.ng/',
      isSeed,
      available,
      earliestRegExpiry,
    },
    byRegNo,
    products,
    references,
    alerts,
    lastAlertDate,
    alertsByBatch,
    alertsByRegNo,
  };
}

let cached: Dataset | null = null;
export function getDataset(): Dataset {
  if (!cached) cached = loadDataset();
  return cached;
}

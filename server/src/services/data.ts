// Loads the registry snapshot and the alert list once at startup. Never calls Greenbook at runtime.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RegistryRecord } from '../../../shared/types';
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

export interface Dataset {
  registry: { snapshotDate: string; total: number; source: string; sourceUrl: string; isSeed: boolean };
  byRegNo: Map<string, RegistryRecord[]>;
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

export function loadDataset(dir = DATA_DIR): Dataset {
  const snapshotFile = path.join(dir, 'registry.json');
  const isSeed = !existsSync(snapshotFile);
  const reg = readJson(isSeed ? path.join(dir, 'seed-registry.json') : snapshotFile);
  // Greenbook pads names with "##" and marks some with "**"; strip both for display and matching.
  const products: RegistryRecord[] = (reg.products as RegistryRecord[]).map((p) => ({
    ...p,
    productName: p.productName.replace(/[#*]+\s*$/, '').trim(),
  }));

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
    },
    byRegNo,
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

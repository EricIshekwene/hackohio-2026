// One-time Greenbook snapshot -> data/registry.json. Run ONCE, from a laptop, never during the demo.
// Greenbook has no CORS and runs in debug mode: ~18 polite requests, 1.5 s apart, no other probing.
//   npm run snapshot:registry
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RegistryRecord } from '../../shared/types';
import { DATA_DIR } from '../src/services/data';
import { snapshotProblems } from './snapshot-check';

const BASE = 'https://greenbook.nafdac.gov.ng/';
const PAGE = 500;
const DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Greenbook pads some values with "##" separators ("Artheget EZ##"); keep the first non-empty part.
function clean(v: string): string {
  return v.replace(/<[^>]+>/g, '').split('##').map((p) => p.trim()).find(Boolean) ?? '';
}

// Rows may be flat ({ applicant_name }) or nested ({ applicant: { name } }); accept either.
function pick(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const parts = k.split('.');
    let v: any = row;
    for (const p of parts) v = v?.[p];
    if (v != null && v !== '') return clean(String(v));
  }
  return '';
}

function toRecord(row: Record<string, any>): RegistryRecord {
  return {
    regNo: pick(row, 'NAFDAC', 'nafdac', 'nafdac_no', 'reg_no', 'registration_number'),
    productName: pick(row, 'product_name', 'product.name', 'name'),
    strength: pick(row, 'strength'),
    composition: pick(row, 'composition') || undefined,
    ingredient: pick(row, 'ingredient_name', 'ingredient.name', 'ingredient.ingredient_name', 'active_ingredient') || undefined,
    applicant: pick(row, 'applicant_name', 'applicant.name', 'applicant.applicant_name', 'manufacturer'),
    form: pick(row, 'form_name', 'form.name', 'form.form_name', 'dosage_form') || undefined,
    approvalDate: pick(row, 'approval_date') || undefined,
    expiryDate: pick(row, 'expiry_date') || undefined,
    status: pick(row, 'status', 'status_name') || 'unknown',
  };
}

async function fetchPage(start: number, draw: number) {
  const url = `${BASE}?draw=${draw}&start=${start}&length=${PAGE}&search%5Bvalue%5D=`;
  const res = await fetch(url, {
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'MedCheck-HackOHIO-2026 (one-time snapshot)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} at start=${start}`);
  const json = (await res.json()) as Record<string, any>;
  delete json.queries; // debug SQL echo; never keep it
  if (!Array.isArray(json.data)) throw new Error(`no data array at start=${start} (keys: ${Object.keys(json).join(', ')})`);
  return json as unknown as { recordsTotal: number; data: Record<string, any>[] };
}

async function main() {
  const rawDir = path.join(DATA_DIR, 'raw');
  mkdirSync(rawDir, { recursive: true });
  const first = await fetchPage(0, 1);
  const total = first.recordsTotal;
  console.log(`recordsTotal ${total}; first row keys: ${Object.keys(first.data[0] ?? {}).join(', ')}`);
  const rows = [...first.data];
  writeFileSync(path.join(rawDir, 'greenbook-0.json'), JSON.stringify(first));
  for (let start = PAGE, draw = 2; start < total; start += PAGE, draw++) {
    await sleep(DELAY_MS);
    const page = await fetchPage(start, draw);
    writeFileSync(path.join(rawDir, `greenbook-${start}.json`), JSON.stringify(page));
    rows.push(...page.data);
    console.log(`${rows.length}/${total}`);
  }
  const products = rows.map(toRecord).filter((p) => p.regNo);
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const registryFile = path.join(DATA_DIR, 'registry.json');
  const previousTotal = existsSync(registryFile) ? Number(JSON.parse(readFileSync(registryFile, 'utf8')).total) || null : null;
  const problems = snapshotProblems({ recordsTotal: total, rowsFetched: rows.length, products: products.length, previousTotal });
  if (problems.length) throw new Error(`refusing to replace registry.json: ${problems.join('; ')}`);
  writeFileSync(
    registryFile,
    JSON.stringify({ source: 'NAFDAC Greenbook', sourceUrl: BASE, snapshotDate, total: products.length, products }, null, 0),
  );
  const a4 = products.filter((p) => p.regNo.replace(/\s/g, '').toUpperCase() === 'A4-6238');
  console.log(`wrote ${products.length} products (snapshot ${snapshotDate}). A4-6238 ->`, a4);
  // GitHub annotations, so the raw shape is visible without downloading logs.
  if (process.env.GITHUB_ACTIONS) {
    const rawA4 = rows.find((r) => JSON.stringify(r).includes('A4-6238'));
    console.log(`::notice title=Greenbook raw A4-6238 row::${JSON.stringify(rawA4 ?? null).slice(0, 3500)}`);
    console.log(`::notice title=Mapped A4-6238::${JSON.stringify(a4).slice(0, 3500)}`);
    console.log(`::notice title=Snapshot::${products.length} products of ${total}; keys: ${Object.keys(rows[0] ?? {}).join(', ')}`);
  }
  if (!a4.length) console.warn('WARNING: A4-6238 missing. Check the field mapping in toRecord() against data/raw/greenbook-0.json.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

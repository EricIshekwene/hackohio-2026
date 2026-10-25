// Scores /api/extract's reader on the team's test packs (testImg/ground-truth.json + <nn>_<ID>*.png).
// For every image: field accuracy vs ground truth, and the verdict the real rules engine gives if the
// user accepts the AI's reading unchanged. Costs real money (~$0.026 per image). Dry run unless --yes.
//   npx tsx scripts/eval-groundtruth.ts [--yes] [--only C01,H09]
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type { StandardizedMedicationInput } from '../../shared/types';
import { extractFromImages } from '../src/extract/claude';
import { clean, toMedicationInput } from '../src/extract/fields';
import { prepareImage } from '../src/extract/images';
import { loadDataset } from '../src/services/data';
import { parsePackDate } from '../src/services/dates';
import { normalizeRegNo, normalizeText, strengthNumbers } from '../src/services/normalize';
import { checkMedication } from '../src/services/rules';

const DIR = path.resolve(__dirname, '../testImg');
const SCORED = ['productName', 'strength', 'nafdacRegNo', 'manufacturer', 'marketedBy', 'batchNo', 'expiryDate'] as const;
type Key = (typeof SCORED)[number];
const LOW = 0.8; // client highlights below this

const same: Record<Key, (got: string, want: string) => boolean> = {
  nafdacRegNo: (a, b) => normalizeRegNo(a) === normalizeRegNo(b),
  batchNo: (a, b) => clean('batchNo', a).value === clean('batchNo', b).value,
  expiryDate: (a, b) => {
    const x = parsePackDate(a), y = parsePackDate(b);
    return !!x && !!y && x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth();
  },
  strength: (a, b) => JSON.stringify(strengthNumbers(a)) === JSON.stringify(strengthNumbers(b)),
  // names: allow an address or suffix on one side ("Getz Pharma Nigeria Limited, Lagos, Nigeria")
  productName: (a, b) => contains(a, b),
  manufacturer: (a, b) => contains(a, b),
  marketedBy: (a, b) => contains(a, b),
};
function contains(a: string, b: string) {
  const x = ` ${normalizeText(a)} `, y = ` ${normalizeText(b)} `;
  return x === y || x.includes(y) || y.includes(x);
}

type Outcome = 'right' | 'wrong_flagged' | 'wrong_unflagged';

async function main() {
  const gt = JSON.parse(fs.readFileSync(path.join(DIR, 'ground-truth.json'), 'utf8'));
  const byId = new Map<string, any>(gt.images.map((x: any) => [x.id, x]));
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
  const files = fs
    .readdirSync(DIR)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && /_([CVH]\d{2})/.test(f))
    .map((f) => ({ file: f, id: f.match(/_([CVH]\d{2})/)![1] }))
    .filter((x) => byId.has(x.id) && (!only || only.includes(x.id)))
    .sort((a, b) => a.file.localeCompare(b.file));

  if (!process.argv.includes('--yes')) {
    console.log(`${files.length} images. Estimated cost ≈ $${(files.length * 0.026).toFixed(2)}. Add --yes to run.`);
    return;
  }

  const ds = loadDataset();
  const now = new Date(`${gt.today}T12:00:00Z`);
  const results: any[] = [];
  let cost = 0;

  const queue = [...files];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const g = byId.get(item.id);
        const img = await prepareImage(fs.readFileSync(path.join(DIR, item.file)));
        const t0 = Date.now();
        let r: any = { file: item.file, id: item.id, expected: g.expectedVerdict.toLowerCase() };
        try {
          const { raw, costUsd } = await extractFromImages([img]);
          cost += costUsd;
          r.seconds = (Date.now() - t0) / 1000;
          r.photoStatus = raw.photoStatus;
          const input = toMedicationInput(raw);
          r.fields = {};
          for (const k of SCORED) {
            const want: string | null = g.groundTruth[k] ?? null;
            const f = (input.fields as any)[k] as { value: string | null; confidence?: number; sourceText?: string; notes?: string[] } | undefined;
            const got = f?.value ?? null;
            const conf = f?.confidence ?? 0;
            const ok = want === null ? got === null : got !== null && same[k](got, want);
            const outcome: Outcome = ok ? 'right' : conf < LOW ? 'wrong_flagged' : 'wrong_unflagged';
            r.fields[k] = { want, got, conf, outcome, falseFlag: ok && got !== null && conf < LOW, sourceText: f?.sourceText, notes: f?.notes };
          }
          if (raw.photoStatus === 'multiple_packs' || raw.photoStatus === 'not_medicine') {
            r.verdict = `422:${raw.photoStatus}`;
          } else {
            const confirmed: StandardizedMedicationInput = { ...input, confirmedByUser: true };
            r.verdict = checkMedication(confirmed, ds, now).verdict;
          }
        } catch (e) {
          r.error = (e as Error).message;
        }
        results.push(r);
        console.log(`${r.id} ${r.file.padEnd(32)} expected ${r.expected.padEnd(6)} got ${String(r.verdict ?? r.error).padEnd(22)} ${r.photoStatus ?? ''}`);
      }
    }),
  );

  results.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(path.join(DIR, 'eval-results.json'), JSON.stringify({ ranAt: new Date().toISOString(), cost, results }, null, 2));

  const tally: Record<string, Record<Outcome | 'falseFlag', number>> = {};
  for (const r of results) for (const [k, v] of Object.entries<any>(r.fields ?? {})) {
    tally[k] ??= { right: 0, wrong_flagged: 0, wrong_unflagged: 0, falseFlag: 0 };
    tally[k][v.outcome as Outcome]++;
    if (v.falseFlag) tally[k].falseFlag++;
  }
  console.log('\nField accuracy (wrong_flagged = user is made to look; wrong_unflagged = slips through;');
  console.log('right_but_flagged = read correctly yet highlighted anyway):');
  for (const k of SCORED) {
    const t = tally[k];
    if (t) console.log(`  ${k.padEnd(13)} right ${t.right}  wrong_flagged ${t.wrong_flagged}  wrong_unflagged ${t.wrong_unflagged}  right_but_flagged ${t.falseFlag}`);
  }
  console.log('\nRight but flagged (why):');
  for (const r of results) for (const [k, v] of Object.entries<any>(r.fields ?? {}))
    if (v.falseFlag) console.log(`  ${r.id} ${k}: ${JSON.stringify(v.got)} conf ${v.conf} · printed ${JSON.stringify(v.sourceText)} · ${(v.notes ?? ['AI\'s own low score']).join('; ')}`);
  console.log('\nUnflagged mistakes:');
  for (const r of results) for (const [k, v] of Object.entries<any>(r.fields ?? {}))
    if (v.outcome === 'wrong_unflagged') console.log(`  ${r.id} ${k}: got ${JSON.stringify(v.got)} (conf ${v.conf}) want ${JSON.stringify(v.want)}`);
  const verdictOk = results.filter((r) => r.verdict === r.expected).length;
  console.log(`\nVerdict matches expected (user accepts AI reading unchanged): ${verdictOk}/${results.length}`);
  for (const r of results) if (r.verdict !== r.expected) console.log(`  ${r.id} (${r.file}): expected ${r.expected}, got ${r.verdict ?? r.error}`);
  console.log(`\nRun cost: $${cost.toFixed(2)}  ·  details: testImg/eval-results.json`);
}

main();

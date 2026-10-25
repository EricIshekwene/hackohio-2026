// Accuracy test: runs every pack in testImg/expected.json through the real AI reader.
// Costs real money (~$0.02 per photo on Opus 5.5). Dry run by default; pass --yes to run.
//   npm run eval            -> shows what would run and the estimated cost
//   npm run eval -- --yes   -> runs it
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT_KEYS, extractFromImages, type ExtractKey } from '../src/extract/claude';
import { clean, toMedicationInput } from '../src/extract/fields';
import { prepareImage } from '../src/extract/images';
import { normalizeText } from '../src/services/normalize';

const DIR = path.resolve(__dirname, '../testImg');
type Pack = { photos: string[] } & Partial<Record<ExtractKey, string | null>>;

async function main() {
  const expected = JSON.parse(fs.readFileSync(path.join(DIR, 'expected.json'), 'utf8')) as Record<string, Pack>;
  const packs = Object.entries(expected);
  const photoCount = packs.reduce((n, [, p]) => n + p.photos.length, 0);
  if (!process.argv.includes('--yes')) {
    console.log(`${packs.length} packs, ${photoCount} photos. Estimated cost ≈ $${(photoCount * 0.025).toFixed(2)}.`);
    console.log('Run with: npm run eval -- --yes');
    return;
  }

  const FREE = new Set<ExtractKey>(['productName', 'manufacturer', 'activeIngredient', 'dosageForm', 'marketedBy']);
  const same = (k: ExtractKey, a: string | null, b: string | null) =>
    a === null || b === null ? a === b : FREE.has(k) ? normalizeText(a) === normalizeText(b) : a === b;

  const score = new Map<ExtractKey, { right: number; total: number }>();
  const confRight: number[] = [];
  const confWrong: number[] = [];
  let cost = 0;

  for (const [id, pack] of packs) {
    const images = await Promise.all(pack.photos.map((p) => prepareImage(fs.readFileSync(path.join(DIR, p)))));
    const { raw, costUsd } = await extractFromImages(images);
    cost += costUsd;
    const fields = toMedicationInput(raw).fields as Record<string, { value: string | null; confidence?: number } | undefined>;
    console.log(`\n${id} (photoStatus: ${raw.photoStatus})`);
    for (const k of EXTRACT_KEYS) {
      if (!(k in pack)) continue; // only score fields the answer file covers
      const want = clean(k, pack[k] ?? null).value;
      const got = fields[k] ?? { value: null, confidence: 0 };
      const ok = same(k, got.value, want);
      const s = score.get(k) ?? { right: 0, total: 0 };
      s.total++;
      if (ok) s.right++;
      score.set(k, s);
      (ok ? confRight : confWrong).push(got.confidence ?? 0);
      if (!ok) console.log(`  ✗ ${k}: got ${JSON.stringify(got.value)} (conf ${got.confidence}), want ${JSON.stringify(want)}`);
    }
  }

  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : 'n/a');
  console.log('\nPer-field accuracy:');
  for (const [k, s] of score) console.log(`  ${k.padEnd(17)} ${s.right}/${s.total}`);
  console.log(`\nAvg confidence when right: ${avg(confRight)}  |  when wrong: ${avg(confWrong)}`);
  console.log("(If 'when wrong' isn't clearly lower, confidence can't be trusted to spot mistakes.)");
  console.log(`Run cost: $${cost.toFixed(2)}`);
}

main();

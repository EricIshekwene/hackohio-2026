// Writes the real /api/check output for each demo pack to shared/fixtures/, so the frontend can build on mocks.
//   npm run fixtures
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import packs from '../../shared/fixtures/demo-packs.json';
import type { StandardizedMedicationInput } from '../../shared/types';
import { loadDataset } from '../src/services/data';
import { checkMedication } from '../src/services/rules';

const ds = loadDataset();
const now = new Date('2026-10-25T12:00:00Z');
const out = path.resolve(__dirname, '../../shared/fixtures');
for (const [name, input] of Object.entries(packs)) {
  if (name === 'note') continue;
  const result = checkMedication(input as StandardizedMedicationInput, ds, now);
  writeFileSync(path.join(out, `${name}.result.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${name}: ${result.verdict} (${result.reasons.map((r) => r.rule).join(', ')})`);
}

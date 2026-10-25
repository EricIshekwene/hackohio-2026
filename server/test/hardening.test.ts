// Edge cases found in the backend hard review (2026-10-25).
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import packs from '../../shared/fixtures/demo-packs.json';
import type { StandardizedMedicationInput } from '../../shared/types';
import { createApp } from '../src/app';
import { clean } from '../src/extract/fields';
import { resetExtractSlots, takeExtractSlot } from '../src/extract/route';
import { spendLimit } from '../src/extract/spend';
import { loadDataset } from '../src/services/data';
import { parsePackDate } from '../src/services/dates';
import { ingredientMatches, productNameMatches } from '../src/services/match';
import { normalizeRegNo, strengthNumbers } from '../src/services/normalize';
import { checkMedication } from '../src/services/rules';
import { snapshotProblems } from '../scripts/snapshot-check';

const ds = loadDataset();
const NOW = new Date('2026-10-25T12:00:00Z');
const pack = (k: keyof typeof packs) => structuredClone(packs[k]) as StandardizedMedicationInput;
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe('registration numbers', () => {
  it.each(['N/A', 'none', 'NA', 'nil', '-'])('"%s" is not a number', (raw) => expect(normalizeRegNo(raw)).toBeNull());

  it('"N/A" typed as the reg no. is UNSURE (U1), not "not registered" (R1)', () => {
    const p = pack('real-green');
    p.fields.nafdacRegNo.value = 'N/A';
    const r = checkMedication(p, ds, NOW);
    expect(r.reasons.map((f) => f.rule)).toContain('U1');
    expect(r.reasons.map((f) => f.rule)).not.toContain('R1');
  });
});

describe('strength numbers', () => {
  it('reads thousands commas as one number', () => {
    expect(strengthNumbers('100,000 IU')).toEqual([100000]);
    expect(strengthNumbers('100,000 IU; 35 mg; 35,000 IU')).toEqual([100000, 35, 35000]);
  });
  it('reads a decimal comma', () => expect(strengthNumbers('2,5 mg')).toEqual([2.5]));
  it('scales every spelling of micrograms', () => {
    for (const s of ['500 mcg', '500 µg', '500 μg', '500 ug']) expect(strengthNumbers(s)).toEqual([0.5]);
  });
  it('extractor cleanup keeps "100,000 IU" whole', () => expect(clean('strength', '100,000 IU').value).toBe('100000 iu'));
});

describe('pack dates', () => {
  it('strips "Exp. Date", "Expires" and "Use by" labels', () => {
    expect(iso(parsePackDate('Exp. Date: 03/2027'))).toBe('2027-03-31');
    expect(iso(parsePackDate('Expires 03/2027'))).toBe('2027-03-31');
    expect(iso(parsePackDate('Use by 31/03/2027'))).toBe('2027-03-31');
    expect(clean('expiryDate', 'Expires 03/2027').value).toBe('03/2027');
  });
  it('rejects impossible dates instead of rolling them over', () => {
    expect(parsePackDate('31/02/2027')).toBeNull();
    expect(parsePackDate('13/2027')).toBeNull();
    expect(parsePackDate('2027-00')).toBeNull();
    expect(parsePackDate('0/03/2027')).toBeNull();
  });
  it('accepts month names only as real month prefixes', () => {
    expect(iso(parsePackDate('Sept 2027'))).toBe('2027-09-30');
    expect(iso(parsePackDate('March 2027'))).toBe('2027-03-31');
    expect(parsePackDate('Junk 2027')).toBeNull();
    expect(parsePackDate('Marx 2027')).toBeNull();
  });
  it('rejects a 3-digit year', () => expect(parsePackDate('03/202')).toBeNull());
});

describe('name matching', () => {
  it('a pharmacopoeia suffix on the pack is not an ingredient mismatch', () => {
    expect(ingredientMatches('Paracetamol BP', 'Paracetamol')).toBe(true);
    expect(ingredientMatches('Losartan Potassium USP', 'Losartan Potassium')).toBe(true);
  });
  it('two different brands do not match on a shared dosage-form word', () => {
    expect(productNameMatches('Lonart Cream', 'Norbarc Aciclovir Cream')).toBe(false);
    expect(productNameMatches('Lonart Forte', 'Malacure Forte')).toBe(false);
  });
  it('the same brand still matches', () => expect(productNameMatches('Artheget EZ Tablets', 'Artheget EZ')).toBe(true));
});

describe('registry loading', () => {
  it('strips Greenbook padding from names and survives missing fields', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'medcheck-ds-'));
    writeFileSync(path.join(dir, 'registry.json'), JSON.stringify({
      snapshotDate: '2026-10-24',
      products: [
        { regNo: 'A4-0001', productName: 'KP Cotrimoxazole Suspension_', strength: '200 mg', applicant: 'KP', status: 'Active' },
        { regNo: 'A4-0002', productName: '#Skin Beauty Sanitizer**', strength: 'NA', applicant: 'SB', status: 'Active' },
        { regNo: 'A4-0003' },
        { productName: 'no number' },
      ],
    }));
    writeFileSync(path.join(dir, 'alerts.json'), JSON.stringify({ alerts: [] }));
    const d = loadDataset(dir);
    expect(d.byRegNo.get('A40001')?.[0].productName).toBe('KP Cotrimoxazole Suspension');
    expect(d.byRegNo.get('A40002')?.[0].productName).toBe('Skin Beauty Sanitizer');
    expect(d.byRegNo.get('A40003')?.[0]).toMatchObject({ productName: '', applicant: '', status: 'unknown' });
    expect(d.lastAlertDate).toBe('unknown');
  });
});

describe('API input limits', () => {
  const app = createApp({ dataset: ds, now: () => NOW });

  it('rejects an oversized field value before matching', async () => {
    const p = pack('real-green');
    p.fields.productName.value = 'x'.repeat(5000);
    const res = await request(app).post('/api/check').send(p);
    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toContain('at most 200');
  });

  it('/api/report recomputes the result instead of trusting the posted one', async () => {
    const input = pack('alert-042');
    const res = await request(app).post('/api/report').send({ input, result: { verdict: 'green' } });
    expect(res.status).toBe(200);
    expect(res.body.body).toContain('DO NOT USE');
    expect(res.body.body).toContain('042/2026');
  });

  it('/api/report works with no result at all', async () => {
    const res = await request(app).post('/api/report').send({ input: pack('hero-cloned') });
    expect(res.status).toBe(200);
    expect(res.body.body).toContain('R3');
  });

  it('/api/report rejects non-string reporter details', async () => {
    const res = await request(app).post('/api/report').send({ input: pack('alert-042'), reporter: { location: { $gt: '' } }, notes: 7 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining(['reporter.location must be a string', 'notes must be a string']));
  });
});

describe('AI budget guards', () => {
  afterEach(() => {
    resetExtractSlots();
    delete process.env.EXTRACT_PER_IP_PER_HOUR;
    delete process.env.SPEND_LIMIT_USD;
  });

  it('caps photo reads per IP per hour', () => {
    process.env.EXTRACT_PER_IP_PER_HOUR = '2';
    const t = 1_000_000;
    expect(takeExtractSlot('1.1.1.1', t)).toBe(true);
    expect(takeExtractSlot('1.1.1.1', t + 1)).toBe(true);
    expect(takeExtractSlot('1.1.1.1', t + 2)).toBe(false);
    expect(takeExtractSlot('2.2.2.2', t + 2)).toBe(true);
    expect(takeExtractSlot('1.1.1.1', t + 60 * 60 * 1000 + 1)).toBe(true);
  });

  it('a malformed SPEND_LIMIT_USD falls back to $30 instead of disabling the guard', () => {
    process.env.SPEND_LIMIT_USD = '30usd';
    expect(spendLimit()).toBe(30);
  });
});

describe('Greenbook snapshot guard', () => {
  const ok = { recordsTotal: 8946, rowsFetched: 8946, products: 8943, previousTotal: 8943 };
  it('accepts a full snapshot', () => expect(snapshotProblems(ok)).toEqual([]));
  it('accepts a first snapshot with nothing to compare', () => expect(snapshotProblems({ ...ok, previousTotal: null })).toEqual([]));
  it('refuses a partial scrape', () => expect(snapshotProblems({ ...ok, rowsFetched: 4000, products: 4000 }).length).toBeGreaterThan(0));
  it('refuses a missing or zero total', () => {
    expect(snapshotProblems({ ...ok, recordsTotal: undefined })).toHaveLength(1);
    expect(snapshotProblems({ ...ok, recordsTotal: 0, rowsFetched: 0, products: 0 }).length).toBeGreaterThan(0);
  });
  it('refuses when the field mapping drops reg nos', () => expect(snapshotProblems({ ...ok, products: 100 }).length).toBeGreaterThan(0));
  it('refuses a big drop from the current snapshot', () =>
    expect(snapshotProblems({ recordsTotal: 5000, rowsFetched: 5000, products: 5000, previousTotal: 8943 })).toHaveLength(1));
});

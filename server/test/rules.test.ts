import { describe, expect, it } from 'vitest';
import request from 'supertest';
import packs from '../../shared/fixtures/demo-packs.json';
import type { StandardizedMedicationInput } from '../../shared/types';
import { createApp } from '../src/app';
import { loadDataset } from '../src/services/data';
import { normalizeBatch, normalizeRegNo, strengthNumbers } from '../src/services/normalize';
import { parsePackDate } from '../src/services/dates';
import { checkMedication } from '../src/services/rules';

const ds = loadDataset();
const NOW = new Date('2026-10-25T12:00:00Z'); // demo day
const pack = (k: keyof typeof packs) => structuredClone(packs[k]) as StandardizedMedicationInput;
const check = (input: StandardizedMedicationInput) => checkMedication(input, ds, NOW);

describe('demo packs', () => {
  it('(a) hero: real number on the wrong product is RED via R3 with name + manufacturer rows', () => {
    const r = check(pack('hero-cloned'));
    expect(r.verdict).toBe('red');
    expect(r.reasons[0].rule).toBe('R3');
    const bad = r.comparison.filter((c) => c.match === false).map((c) => c.field);
    expect(bad).toEqual(['productName', 'manufacturer']);
    expect(r.comparison.find((c) => c.field === 'strength')?.match).toBe(true);
    expect(r.registryRecord?.productName).toBe('Artheget EZ');
  });

  it('(b) Alert 042 pack is RED with R1 and R2 both listed, alert cited', () => {
    const r = check(pack('alert-042'));
    expect(r.verdict).toBe('red');
    expect(r.reasons.map((f) => f.rule).sort()).toEqual(['R1', 'R2']);
    expect(r.alertMatches[0]).toMatchObject({ alertNo: '042/2026', date: '2026-08-19' });
    expect(r.alertMatches[0].matchedOn).toEqual(expect.arrayContaining(['batchNo', 'nafdacRegNo']));
  });

  it('(c) real pack is GREEN with the exact caveat and a registration-expiry note', () => {
    const r = check(pack('real-green'));
    expect(r.verdict).toBe('green');
    expect(r.reasons.map((f) => f.rule)).toEqual(['R5']);
    expect(r.summary).toBe('Registered, no active alert, details consistent. Not proof of authenticity.');
    expect(r.caveat).toBe('Not proof of authenticity');
    expect(r.notes.some((n) => n.includes('expires on 1 Dec 2026'))).toBe(true);
    expect(r.dataAsOf.lastAlert).toBe('2026-08-19');
  });
});

describe('other rules', () => {
  it('strength-only mismatch is AMBER (R3)', () => {
    const p = pack('real-green');
    p.fields.strength.value = '20/120 mg';
    const r = check(p);
    expect(r.verdict).toBe('amber');
    expect(r.reasons[0]).toMatchObject({ rule: 'R3', verdict: 'amber' });
  });

  it('missing reg no. is UNSURE (U1)', () => {
    const p = pack('real-green');
    p.fields.nafdacRegNo.value = null;
    const r = check(p);
    expect(r.verdict).toBe('unsure');
    expect(r.reasons[0].rule).toBe('U1');
  });

  it('missing reg no. but batch on an alert is still RED (worst wins)', () => {
    const p = pack('alert-042');
    p.fields.nafdacRegNo.value = '';
    const r = check(p);
    expect(r.verdict).toBe('red');
    expect(r.reasons.map((f) => f.rule)).toEqual(['R2', 'U1']);
  });

  it('expired pack is AMBER (R6)', () => {
    const p = pack('real-green');
    p.fields.expiryDate.value = '03/2026';
    const r = check(p);
    expect(r.verdict).toBe('amber');
    expect(r.reasons[0].rule).toBe('R6');
  });

  it('expired registration is AMBER (R4)', () => {
    const r = checkMedication(pack('real-green'), ds, new Date('2027-01-15T00:00:00Z'));
    expect(r.reasons.map((f) => f.rule)).toContain('R4');
    expect(r.verdict).toBe('amber');
  });

  it('missing batch adds a not-checked line without changing the colour', () => {
    const p = pack('real-green');
    p.fields.batchNo.value = null;
    const r = check(p);
    expect(r.verdict).toBe('green');
    expect(r.notChecked).toContain('Batch number (not on the pack)');
  });

  it('every non-green finding carries evidence, a source and a next step', () => {
    for (const k of ['hero-cloned', 'alert-042'] as const) {
      for (const f of check(pack(k)).reasons) {
        expect(f.evidence.length).toBeGreaterThan(0);
        expect(f.source.name).toBeTruthy();
        expect(f.nextStep).toBeTruthy();
      }
    }
  });
});

describe('licence holder vs factory (R3) and real inactive registrations (R4)', () => {
  const coartem = (): StandardizedMedicationInput => ({
    source: 'manual',
    confirmedByUser: true,
    fields: {
      productName: { value: 'Coartem 80/480', editedByUser: false },
      strength: { value: '80mg/480mg', editedByUser: false },
      nafdacRegNo: { value: 'B4-0262', editedByUser: false },
      manufacturer: { value: 'Novartis Pharma AG, Basel, Switzerland', editedByUser: false },
      marketedBy: { value: 'Novartis Nigeria Limited', editedByUser: false },
      batchNo: { value: 'KN1234', editedByUser: false },
      expiryDate: { value: '2027-01', editedByUser: false },
    },
  });
  const full = ds.registry.isSeed ? it.skip : it;

  full('B4-0262 (Coartem, Inactive, expired 2026-03-28) is AMBER via R4, not R3', () => {
    const r = check(coartem());
    expect(r.verdict).toBe('amber');
    expect(r.reasons.map((f) => f.rule)).toEqual(['R4']);
    expect(r.registryRecord?.productName).toBe('Coartem 80/480 Tablets');
  });

  full('foreign factory with a matching "marketed by" holder is not flagged', () => {
    const p = coartem();
    p.fields.manufacturer.value = 'Some Contract Factory Pvt, India';
    expect(check(p).reasons.map((f) => f.rule)).toEqual(['R4']);
  });

  it('foreign factory with no "marketed by" on the pack is AMBER, not RED', () => {
    const p = pack('real-green');
    p.fields.manufacturer.value = 'Acme Contract Manufacturing, Karachi';
    const r = check(p);
    expect(r.verdict).toBe('amber');
    expect(r.reasons[0]).toMatchObject({ rule: 'R3', verdict: 'amber' });
  });

  it('a real factory name does not rescue a fake "marketed by" holder (RED)', () => {
    const p = pack('real-green');
    p.fields.manufacturer.value = 'Getz Pharma (Pvt) Ltd, Karachi';
    p.fields.marketedBy = { value: 'Sunrise Meds Distributors Ltd', editedByUser: false };
    const r = check(p);
    expect(r.verdict).toBe('red');
    expect(r.reasons[0]).toMatchObject({ rule: 'R3', verdict: 'red' });
  });

  full('V11: Novartis factory with a fake "marketed by" on B4-0262 is RED', () => {
    const p = coartem();
    p.fields.marketedBy!.value = 'Kingsway Pharma Ventures Ltd';
    const r = check(p);
    expect(r.verdict).toBe('red');
    expect(r.reasons.map((f) => f.rule)).toEqual(['R3', 'R4']);
  });

  it('a "marketed by" holder that also differs is RED', () => {
    const p = pack('real-green');
    p.fields.manufacturer.value = 'Acme Contract Manufacturing, Karachi';
    p.fields.marketedBy = { value: 'Greenlife Pharmaceuticals Ltd', editedByUser: false };
    expect(check(p).reasons[0]).toMatchObject({ rule: 'R3', verdict: 'red' });
  });
});

describe('near-miss spellings (R3 AMBER, never a silent match)', () => {
  const spelling = (r: ReturnType<typeof check>) => r.reasons.find((f) => f.title === "Spelling differs from NAFDAC's record");
  it.each(['Artheqet EZ', 'Arthegat EZ', 'Artheqet'])('"%s" on A4-6238 is AMBER, not green', (name) => {
    const p = pack('real-green');
    p.fields.productName.value = name;
    const r = check(p);
    expect(r.verdict).toBe('amber');
    expect(spelling(r)).toMatchObject({ rule: 'R3', verdict: 'amber' });
    expect(r.comparison.find((c) => c.field === 'productName')?.match).toBe(false);
  });
  it.each(['Artheget', 'ARTHEGET EZ', 'Artheget-EZ'])('"%s" is the same brand: no spelling finding', (name) => {
    const p = pack('real-green');
    p.fields.productName.value = name;
    const r = check(p);
    expect(spelling(r)).toBeUndefined();
    expect(r.verdict).toBe('green');
  });
  (ds.registry.isSeed ? it.skip : it)('a near-miss holder ("Novartls" for "Novartis") is flagged AMBER, not RED', () => {
    const input: StandardizedMedicationInput = {
      source: 'manual',
      confirmedByUser: true,
      fields: {
        productName: { value: 'Coartem 80/480', editedByUser: false },
        strength: { value: '80mg/480mg', editedByUser: false },
        nafdacRegNo: { value: 'B4-0262', editedByUser: false },
        manufacturer: { value: 'Novartis Pharma AG, Basel, Switzerland', editedByUser: false },
        marketedBy: { value: 'Novartls Nigeria Limited', editedByUser: false },
        batchNo: { value: 'KN1234', editedByUser: false },
        expiryDate: { value: '2027-01', editedByUser: false },
      },
    };
    const r = check(input);
    expect(spelling(r)?.evidence.map((e) => e.field)).toContain('manufacturer');
    expect(r.verdict).toBe('amber'); // R4 (inactive) + spelling, but no RED from the holder rule
  });
  it('a short company word that differs is a plain mismatch, not a near-miss', () => {
    const p = pack('real-green');
    p.fields.manufacturer.value = 'Getx Pharma Nigeria Limited';
    const r = check(p);
    expect(spelling(r)).toBeUndefined();
    expect(r.verdict).toBe('amber');
  });
  it('the hero (different product) is still RED', () => expect(check(pack('hero-cloned')).verdict).toBe('red'));
});

describe('normalisation', () => {
  it.each([
    ['A4-6238', 'A4-6238'], ['a4 6238', 'A4-6238'], ['A46238', 'A4-6238'], ['A4–6238', 'A4-6238'],
    ['A4-62O8', 'A4-6208'], ['O2-3457', '02-3457'], ['NAFDAC Reg. No: 02-3457', '02-3457'],
    ['NAFDAC REG NO. A4 6238', 'A4-6238'], ['RegNo: 04-9927', '04-9927'], ['No.04-1234', '04-1234'],
  ])('%s -> %s', (raw, want) => expect(normalizeRegNo(raw)).toBe(want));

  it('does not cut "NO" out of the middle of a number', () => expect(normalizeRegNo('A4-NO12')).not.toBe('A4-12'));

  it.each([
    ['B.No: BP5203', 'BP5203'], ['B/N BP5203', 'BP5203'], ['Batch No. BP5203', 'BP5203'], ['Lot No. GL2210', 'GL2210'],
    ['bp 5203', 'BP5203'], ['NO5012', 'NO5012'], ['LOT NO1234', 'NO1234'],
  ])('batch %s -> %s', (raw, want) => expect(normalizeBatch(raw)).toBe(want));

  it('a typed "B.No: BP5203" still hits Alert 042 (RED)', () => {
    const p = pack('alert-042');
    p.fields.batchNo.value = 'B.No: BP5203';
    p.fields.nafdacRegNo.value = null; // only the batch can find the alert now
    const r = check(p);
    expect(r.verdict).toBe('red');
    expect(r.reasons.find((f) => f.rule === 'R2')?.verdict).toBe('red');
  });

  it('reads strengths', () => {
    expect(strengthNumbers('80 mg; 480 mg')).toEqual([80, 480]);
    expect(strengthNumbers('80/480mg')).toEqual([80, 480]);
    expect(strengthNumbers('0.5 g')).toEqual([500]);
  });

  it('reads pack dates', () => {
    expect(parsePackDate('2027-09')?.toISOString().slice(0, 10)).toBe('2027-09-30');
    expect(parsePackDate('MAR 2027')?.toISOString().slice(0, 10)).toBe('2027-03-31');
    expect(parsePackDate('31/03/2027')?.toISOString().slice(0, 10)).toBe('2027-03-31');
    expect(parsePackDate('EXP: 03/27')?.toISOString().slice(0, 10)).toBe('2027-03-31');
    expect(parsePackDate('soon')).toBeNull();
  });
});

describe('HTTP', () => {
  const app = createApp({ dataset: ds, now: () => NOW });

  it('POST /api/check returns a VerificationResult', async () => {
    const res = await request(app).post('/api/check').send(pack('hero-cloned'));
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('red');
    expect(res.body.legend.label).toBe('Do not use');
  });

  it('refuses unconfirmed input with 422', async () => {
    const p = pack('real-green');
    p.confirmedByUser = false;
    const res = await request(app).post('/api/check').send(p);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('unconfirmed');
  });

  it('rejects malformed input with 400', async () => {
    const res = await request(app).post('/api/check').send({ source: 'photo' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('GET /api/legend lists four tiers worst first', async () => {
    const res = await request(app).get('/api/legend');
    expect(res.body.legend.map((l: { verdict: string }) => l.verdict)).toEqual(['red', 'amber', 'unsure', 'green']);
  });

  it('POST /api/report builds a prefilled NAFDAC draft', async () => {
    const input = pack('alert-042');
    const result = (await request(app).post('/api/check').send(input)).body;
    const res = await request(app).post('/api/report').send({ input, result, reporter: { location: 'Kano' } });
    expect(res.status).toBe(200);
    expect(res.body.to).toBe('pharmacovigilance@nafdac.gov.ng');
    expect(res.body.body).toContain('042/2026');
    expect(res.body.mailto.startsWith('mailto:pharmacovigilance@nafdac.gov.ng?subject=')).toBe(true);
  });
});

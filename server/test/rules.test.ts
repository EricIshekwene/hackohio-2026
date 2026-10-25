import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import packs from '../../shared/fixtures/demo-packs.json';
import type { StandardizedMedicationInput } from '../../shared/types';
import { createApp } from '../src/app';
import { loadDataset } from '../src/services/data';
import { manufacturerMatches, manufacturerNearMiss, productNameMatches, productNameNearMiss } from '../src/services/match';
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
    p.fields.marketedBy = { value: 'Sunrise Pharma Nig. Ltd', editedByUser: false };
    expect(check(p).reasons[0]).toMatchObject({ rule: 'R3', verdict: 'red' });
  });
});

describe('photo wording never claims a field is missing from the pack', () => {
  it('no reg no. found in a photo', () => {
    const p = pack('real-green');
    p.source = 'photo';
    p.fields.nafdacRegNo.value = null;
    p.fields.batchNo.value = null;
    const r = check(p);
    expect(r.reasons.find((f) => f.rule === 'U1')?.title).toBe('No NAFDAC registration number found in the photo');
    expect(r.notChecked.join(' | ')).toMatch(/Batch number \(not found in the photo\)/);
    expect(JSON.stringify(r)).not.toMatch(/not on the pack/);
  });
  it('typed entry keeps "not on the pack"', () => {
    const p = pack('real-green');
    p.fields.nafdacRegNo.value = null;
    expect(check(p).reasons.find((f) => f.rule === 'U1')?.title).toBe('No NAFDAC registration number');
  });
});

describe('near-miss spellings 2–3 letters off (re-test regression)', () => {
  it.each([
    ['Micyotox Eye Drops', 'Micromox Eye Drops'],
    ['Emianra 50 Tablets', 'Embagra 50 Tablets'],
    ['Rocawhin 1G Powder for injection I.M.', 'Rocephin 1G Powder for injection I.M.'],
    ['Etpigat Tablet 25 mg', 'Empiget Tablet 25 mg'],
    ['Betaklne Germicide Gargle', 'Betadine Germicide Gargle'],
  ])('"%s" vs "%s" is a near miss', (pack, reg) => expect(productNameNearMiss(pack, reg)).toBe(true));
  it.each([
    ['Easy-Caye Medical Ltd', 'Easy-Care Medical Ltd'],
    ['Jimmi-dell Pharmaceuticals', 'Jimmy-Dell Pharmaceuticals'],
  ])('company "%s" vs "%s" is a near miss', (pack, reg) => expect(manufacturerNearMiss(pack, reg)).toBe(true));
  it.each([
    ['Betadine Germicide Gargle Mouthwash', 'Betadine Germicide Gargle'], // extra word
    ['Germicide Gargle', 'Betadine Germicide Gargle'], // word left out
    ['ARTHEGET-EZ', 'Artheget EZ'], // punctuation/case
    ['Artheget', 'Artheget EZ'],
  ])('"%s" vs "%s" is NOT a near miss', (pack, reg) => expect(productNameNearMiss(pack, reg)).toBe(false));
  it.each([
    ['GlaxoSmithKline', 'Glaxo SmithKline Consumer Nigeria PLC'],
    ['MicroNova', 'Micro Nova Pharmaceuticals Ind Ltd'],
    ['SJS Lifesciences', 'SJS Life Sciences'],
    ['AstraZeneca', 'Astra Zeneca'],
  ])('joined/split company "%s" vs "%s" matches with no spelling flag', (pack, reg) => {
    expect(manufacturerMatches(pack, reg)).toBe(true);
    expect(manufacturerNearMiss(pack, reg)).toBe(false);
  });
  it.each([
    ['Karifieldline Pharmaceutical Ltd', 'Karifield Pharmaceutical Ltd'], // letters added
    ['Greenlifeco Pharmaceutical Limited', 'Greenlife Pharmaceutical Limited'],
  ])('made-up company "%s" vs real "%s" is never treated as the same', (pack, reg) => {
    expect(manufacturerMatches(pack, reg) === true && !manufacturerNearMiss(pack, reg)).toBe(false);
  });
  it.each([
    ['Crushmalex', 'Crushmal'],
    ['Albendazo', 'Albendazole'],
  ])('made-up brand "%s" vs real "%s" is never a clean match', (pack, reg) => {
    expect(productNameMatches(pack, reg) === true && !productNameNearMiss(pack, reg)).toBe(false);
  });
  it('companies that are the same word split differently still match', () => {
    const pack = 'Micro Nova', reg = 'MicroNova Pharmaceuticals Ind Ltd';
    expect(manufacturerMatches(pack, reg)).toBe(true);
    expect(manufacturerNearMiss(pack, reg)).toBe(false);
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

// ---- Bug-bash fixes (real NAFDAC rows from data/registry.json)
const full = ds.registry.isSeed ? it.skip : it;
const fld = (value: string | null, sourceText?: string) => ({ value, editedByUser: false, ...(sourceText ? { sourceText } : {}) });
// A genuine pack built from a registry row: what the pack prints, field by field.
function genuine(p: { name: string; strength: string; regNo: string; maker: string; ingredient?: string; form?: string }): StandardizedMedicationInput {
  return {
    source: 'manual',
    confirmedByUser: true,
    fields: {
      productName: fld(p.name), strength: fld(p.strength), nafdacRegNo: fld(p.regNo), manufacturer: fld(p.maker),
      batchNo: fld('ZZ12345'), expiryDate: fld('2028-01'),
      ...(p.ingredient ? { activeIngredient: fld(p.ingredient) } : {}),
      ...(p.form ? { dosageForm: fld(p.form) } : {}),
    },
  };
}
const rules = (r: ReturnType<typeof check>) => r.reasons.map((f) => f.rule);
const spellingOf = (r: ReturnType<typeof check>) => r.reasons.find((f) => f.code === 'NAME_NEAR_MISS');

describe('near misses next to exact words (bug 1)', () => {
  const betadine = { name: 'Betadine Germicide Gargle', strength: '2%', regNo: '04-4013', maker: 'Phillips Pharmaceuticals (Nigeria) Limited' };
  full('genuine Betadine pack is GREEN', () => expect(check(genuine(betadine)).verdict).toBe('green'));
  full('"Betadlne Germicide Gargle" is a spelling near miss (AMBER), even though two words match exactly', () => {
    const r = check(genuine({ ...betadine, name: 'Betadlne Germicide Gargle' }));
    expect(r.verdict).toBe('amber');
    expect(spellingOf(r)?.evidence.map((e) => e.field)).toContain('productName');
  });
  full('a pack that leaves a word out ("Germicide Gargle") is not a near miss', () => {
    expect(spellingOf(check(genuine({ ...betadine, name: 'Germicide Gargle' })))).toBeUndefined();
  });
  full.each([
    ['B4-0601', 'Embagra 50 Tablets', '50 mg', 'Embessy Pharmaceutical and Chemicals'],
    ['A4-2911', 'Clincap 150 Capsules', '150 mg', 'Embessy Pharmaceutical and Chemicals'],
    ['B4-2649', 'Glylow SR 1000 Tablet', '1000 mg', 'Genarics and Specialities'],
    ['04-7302', 'Rocephin 1G Powder for injection I.M.', '1 g', 'Roche Prokucts'],
  ])('%s with a misspelt company "%s / %s" is a spelling near miss', (regNo, name, strength, maker) => {
    const r = check(genuine({ name, strength, regNo, maker }));
    expect(r.verdict).toBe('amber');
    expect(spellingOf(r)?.evidence.map((e) => e.field)).toContain('manufacturer');
  });
  full('the correctly spelt company on B4-0601 is GREEN', () => {
    expect(check(genuine({ name: 'Embagra 50 Tablets', strength: '50 mg', regNo: 'B4-0601', maker: 'Embassy Pharmaceutical and Chemicals Limited' })).verdict).toBe('green');
  });
});

describe('several rows on one reg no. (bugs 2 and 3)', () => {
  full('A4-101681: the "1 Mega" pack with ingredient "Crystalline Penicillin" matches its own row', () => {
    const r = check(genuine({ name: 'Global Young Crystalline Penicillin G. Injection 1 Mega', strength: '1 Mega', regNo: 'A4-101681', maker: 'Global Young Pharma Limited', ingredient: 'Crystalline Penicillin', form: 'Injection' }));
    expect(rules(r)).toEqual(['R5']);
    expect(r.registryRecord?.ingredient).toBe('Crystalline Penicillin');
  });
  full('A4-2789: "Finamin Syrup" with ingredient "Amino acids; Vitamins" is not RED', () => {
    const r = check(genuine({ name: 'Finamin Syrup', strength: '15 mL', regNo: 'A4-2789', maker: 'Franphino Pharmaceuticals Nigeria Limited', ingredient: 'Amino acids; Vitamins', form: 'Syrup' }));
    expect(r.verdict).toBe('green');
    expect(r.registryRecord?.ingredient).toBe('Amino acids; Vitamins');
  });
  full('A4-7301: a genuine Eutram capsule pack gets no R3 and no R4 (the Active row is used)', () => {
    const r = check(genuine({ name: 'Eutram 100 Capsules', strength: '100 mg', regNo: 'A4-7301', maker: 'Eutrix Pharmaceuticals Limited', ingredient: 'Tramadol Hydrochloride', form: 'Capsule' }));
    expect(rules(r)).toEqual(['R5']);
    expect(r.registryRecord?.productName).toBe('Eutram 100 Capsules');
  });
  full.each([
    ['A4-1503', 'Co-Diovan 160 mg/12.5 mg Tablet', '160 mg; 12.5 mg', 'Novartis Nigeria Limited'],
    ['04-8143', 'Lisiofil 10 Tablets', '10 mg', 'Unique Pharmaceuticals Limited'],
    ['04-8872', 'Perglim 2 Tablets', '2 mg', 'Mega Lifesciences Nigeria Limited'],
    ['03-8108', 'Standard Q HIV/Syphilis Combo', 'NA', 'Codix Pharma Limited'],
  ])('%s: a pack matching the Active row is not called Inactive (no R4)', (regNo, name, strength, maker) => {
    const r = check(genuine({ name, strength, regNo, maker }));
    expect(rules(r)).not.toContain('R4');
    expect(r.registryRecord?.status).toBe('Active');
    expect(r.verdict).toBe('green');
  });
  full('Greenbook "** (duplicate NRN)" notes are stripped from product names', () => {
    const names = ds.byRegNo.get('A47301')!.map((p) => p.productName);
    expect(names).toEqual(['Amadol Retard Tablet', 'Eutram 100 Capsules']);
    expect(ds.products.some((p) => p.productName.includes('**') || /\(duplicate/.test(p.productName))).toBe(false);
  });
});

describe('alert batch on a different product (bug 4)', () => {
  full.each([
    ['A4-6238', 'Artheget EZ', '80 mg; 480 mg', 'Getz Pharma Nigeria Limited'],
    ['04-9927', 'Lonart-DS Tablets', '80 mg; 480 mg', 'Greenlife Pharmaceutical Limited'],
  ])('batch BP5203 printed on %s (%s) is AMBER, not GREEN or RED', (regNo, name, strength, maker) => {
    const p = genuine({ name, strength, regNo, maker });
    p.fields.batchNo.value = 'BP5203';
    const r = check(p);
    expect(r.verdict).toBe('amber');
    const f = r.reasons.find((x) => x.rule === 'R2')!;
    expect(f).toMatchObject({ verdict: 'amber', title: 'Batch number appears on a NAFDAC alert for a different product' });
    expect(f.message).toContain('042/2026');
    expect(f.message).toContain('19 Aug 2026');
    expect(f.message).toContain('https://nafdac.gov.ng/');
    expect(f.nextStep).toMatch(/pharmacist/);
  });
});

describe('unreadable vs missing fields (bug 5)', () => {
  it('a torn reg no. (null value, sourceText "04-77") says it could not be read, not that it is missing', () => {
    const p = pack('real-green');
    p.fields.nafdacRegNo = fld(null, '04-77');
    const r = check(p);
    expect(r.reasons[0]).toMatchObject({ rule: 'U1', title: "Registration number couldn't be read clearly" });
    expect(r.notChecked).toContain("Registration number (couldn't be read from the photo)");
    expect(r.notChecked.join(' ')).not.toContain('Registration number (not on the pack)');
  });
  it('an unreadable batch says so in notChecked', () => {
    const p = pack('real-green');
    p.fields.batchNo = fld(null, 'BP5');
    expect(check(p).notChecked).toContain("Batch number (couldn't be read from the photo)");
  });
  it('a truly absent reg no. keeps the old wording', () => {
    const p = pack('real-green');
    p.fields.nafdacRegNo = fld(null);
    const r = check(p);
    expect(r.reasons[0].title).toBe('No NAFDAC registration number');
    expect(r.notChecked).toContain('Registration number (not on the pack)');
  });
});

describe('look-alike and invisible characters in reg nos (bug 6)', () => {
  it.each([
    ['А4-6238', 'A4-6238'], // Cyrillic A
    ['Α4-6238', 'A4-6238'], // Greek Alpha
    ['В4-0601', 'B4-0601'], // Cyrillic Ve
    ['а4-6238', 'A4-6238'], // Cyrillic lowercase a
    ['A4-62З8', 'A4-6238'], // Cyrillic Ze read as 3
    ['A4-​6238', 'A4-6238'], // zero-width space
    ['‫A4-6238‬', 'A4-6238'], // RTL embedding
    ['⁦A4-6238⁩﻿', 'A4-6238'], // isolate + BOM
    ['‏A4‎-6238', 'A4-6238'], // RLM / LRM
  ])('%j -> %s', (raw, want) => expect(normalizeRegNo(raw)).toBe(want));
  it('a Cyrillic-A reg no. on the real pack is GREEN, with no "corrected" note', () => {
    const p = pack('real-green');
    p.fields.nafdacRegNo.value = 'А4-6238';
    const r = check(p);
    expect(r.verdict).toBe('green');
    expect(r.notes.join(' ')).not.toContain('letter O');
  });
});

describe('HTTP hardening (bugs 7-10)', () => {
  const app = createApp({ dataset: ds, now: () => NOW });
  type TrustFn = (addr: string, i: number) => boolean;
  const withTrustProxy = (value: string | undefined, fn: () => void) => {
    const prev = process.env.TRUST_PROXY;
    if (value === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = value;
    try { fn(); } finally {
      if (prev === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prev;
    }
  };

  it('an oversized body is 413 JSON, not 500', async () => {
    const res = await request(app).post('/api/check').set('Content-Type', 'application/json').send(JSON.stringify({ pad: 'x'.repeat(1_100_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at \w+ \(/);
  });

  it('an unsupported charset is 415 JSON', async () => {
    const res = await request(app).post('/api/check').set('Content-Type', 'application/json; charset=klingon').send('{}');
    expect(res.status).toBe(415);
    expect(res.body.error).toBeTruthy();
  });

  it('an unsupported content encoding is 415 JSON', async () => {
    const res = await request(app).post('/api/check').set('Content-Type', 'application/json').set('Content-Encoding', 'bogus').send('{}');
    expect(res.status).toBe(415);
    expect(res.body.error).toBeTruthy();
  });

  it('trust proxy defaults to loopback only (a direct client cannot spoof X-Forwarded-For)', () => withTrustProxy(undefined, () => {
    const trust = createApp({ dataset: ds }).get('trust proxy fn') as TrustFn;
    expect(trust('127.0.0.1', 0)).toBe(true);
    expect(trust('203.0.113.7', 0)).toBe(false);
  }));

  it('TRUST_PROXY still overrides, as a number or a string', () => {
    withTrustProxy('1', () => expect((createApp({ dataset: ds }).get('trust proxy fn') as TrustFn)('203.0.113.7', 0)).toBe(true));
    withTrustProxy('10.0.0.0/8', () => {
      const t = createApp({ dataset: ds }).get('trust proxy fn') as TrustFn;
      expect(t('10.1.2.3', 0)).toBe(true);
      expect(t('203.0.113.7', 0)).toBe(false);
    });
  });

  describe('with a built client', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'medcheck-client-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>MedCheck</title>');
    writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
    const web = createApp({ dataset: ds, now: () => NOW, clientDist: dir });

    it('does not send X-Powered-By', async () => {
      expect((await request(web).get('/api/health')).headers['x-powered-by']).toBeUndefined();
    });
    it.each(['/api', '/api/', '/api/nope'])('GET %s is the 404 JSON, not index.html', async (url) => {
      const res = await request(web).get(url);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
    it('a missing /assets/*.js is 404; an existing one is served', async () => {
      expect((await request(web).get('/assets/missing-abc123.js')).status).toBe(404);
      expect((await request(web).get('/assets/app.js')).status).toBe(200);
    });
    it('client routes still get index.html', async () => {
      const res = await request(web).get('/check/result');
      expect(res.status).toBe(200);
      expect(res.text).toContain('MedCheck');
    });
  });

  it('/api/report refuses unconfirmed input with 422', async () => {
    const input = pack('alert-042');
    input.confirmedByUser = false;
    const res = await request(app).post('/api/report').send({ input });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('unconfirmed');
  });
});

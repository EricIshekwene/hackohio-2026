// Regression tests for the B4-0910 false "not registered" verdict: a number missing from our data is a
// coverage gap, never proof of a fake. Each case asserts the machine status, reason codes, evidence,
// severity, the displayed headline, and that no unsupported claim (not registered / authentic) appears.
import { mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import packs from '../../shared/fixtures/demo-packs.json';
import type { StandardizedMedicationInput, VerificationResult } from '../../shared/types';
import { createApp } from '../src/app';
import { DATA_DIR, loadDataset, type Alert, type Dataset, type ReferenceRecord } from '../src/services/data';
import { normalizeRegNo, regNoKey } from '../src/services/normalize';
import { buildReport } from '../src/services/report';
import { checkMedication } from '../src/services/rules';

const ds = loadDataset();
const NOW = new Date('2026-10-25T12:00:00Z');
const full = ds.registry.isSeed ? it.skip : it;
const f = (v: string | null) => ({ value: v, editedByUser: false });

const aquamal = (reg = 'B4-0910', over: Partial<Record<string, string | null>> = {}): StandardizedMedicationInput => ({
  source: 'manual',
  confirmedByUser: true,
  fields: {
    productName: f(over.productName ?? 'Aquamal QS'),
    strength: f(over.strength ?? '80/480 mg'),
    nafdacRegNo: f(reg),
    manufacturer: f(over.manufacturer ?? 'Pinnacle Health Pharmaceutical & Stores Ltd'),
    batchNo: f(over.batchNo ?? 'AQ2301'),
    expiryDate: f(over.expiryDate ?? '2027-06'),
    activeIngredient: f('Artemether + Lumefantrine'),
    dosageForm: f('Tablets'),
  },
});
const pack = (k: 'hero-cloned' | 'alert-042' | 'real-green') => structuredClone(packs[k]) as StandardizedMedicationInput;
const codes = (r: VerificationResult) => r.reasons.map((x) => x.code);

// Words a lookup alone can never justify.
function noUnsupportedClaims(r: VerificationResult) {
  const text = [r.headline, r.summary, ...r.reasons.flatMap((x) => [x.title, x.message, x.nextStep]), ...r.notes].join(' ');
  expect(text).not.toMatch(/not in NAFDAC's registry|not registered|is unregistered|(number|registration) does not exist|is (genuine|authentic)|Registration number not found/i);
  expect(r.authenticityVerified).toBe(false);
}

// A copy of the dataset with extra references / alerts, so tests never edit data/.
function withExtras(extra: { refs?: ReferenceRecord[]; alerts?: Alert[] }): Dataset {
  const references = new Map(ds.references);
  for (const r of extra.refs ?? []) references.set(regNoKey(r.registrationNumber)!, [...(references.get(regNoKey(r.registrationNumber)!) ?? []), r]);
  const alertsByRegNo = new Map(ds.alertsByRegNo);
  const alertsByBatch = new Map(ds.alertsByBatch);
  for (const a of extra.alerts ?? []) {
    for (const p of a.products) {
      if (p.regNo) alertsByRegNo.set(regNoKey(p.regNo)!, [a]);
      for (const b of p.batches ?? []) alertsByBatch.set(b.toUpperCase(), [a]);
    }
  }
  return { ...ds, references, alertsByRegNo, alertsByBatch, alerts: [...ds.alerts, ...(extra.alerts ?? [])] };
}

describe('B4-0910 (Aquamal QS): the reported false negative', () => {
  full('is not in the Greenbook snapshot (the coverage gap behind the bug)', () => {
    expect(ds.byRegNo.get('B40910')).toBeUndefined();
  });

  full('finds the GS1 product listing; current status unverified; amber caution, never red', () => {
    const r = checkMedication(aquamal(), ds, NOW);
    expect(r.status).toBe('external_product_match');
    expect(r.verdict).toBe('amber');
    expect(r.severity).toBe('caution');
    expect(r.currentRegistrationStatus).toBe('unknown');
    expect(codes(r)).toEqual(['EXTERNAL_PRODUCT_RECORD_FOUND']);
    expect(r.headline).toBe('Product listing found, registration unverified');
    expect(r.registrationNumber).toBe('B4-0910');
    expect(r.comparisonSource).toBe('GS1 Nigeria listing');
    const gb = r.evidence.find((e) => e.sourceType === 'nafdac_greenbook')!;
    expect(gb).toMatchObject({ found: false, official: true, registrationStatus: 'unknown' });
    expect(gb.evidenceLimitations.join(' ')).toMatch(/expiring on or after/);
    const gs1 = r.evidence.find((e) => e.sourceType === 'gs1_listing')!;
    expect(gs1).toMatchObject({ found: true, official: false, registrationNumber: 'B4-0910', registrationStatus: 'unknown' });
    // Name, ingredient, strength, form and company all agree with the listing.
    expect(r.comparison.filter((c) => c.match === false)).toEqual([]);
    expect(r.comparison[0]).toMatchObject({ inRegistry: 'B4-0910', match: true });
    expect(r.notes.some((n) => n.startsWith('Current NAFDAC registration status: unavailable'))).toBe(true);
    noUnsupportedClaims(r);
  });

  full('shows the same brand registered under another number without treating it as a match', () => {
    const r = checkMedication(aquamal(), ds, NOW);
    expect(r.notes.some((n) => n.includes('B4-3100') && n.includes('not the number on this pack'))).toBe(true);
    expect(r.registryRecord).toBeNull();
  });

  it.each(['b4-0910', 'B4 0910', 'B4‐0910', 'B4–0910', 'B4−0910', 'B40910', 'NAFDAC Reg. No. B4-0910'])('"%s" normalises to B4-0910', (raw) => {
    expect(normalizeRegNo(raw)).toBe('B4-0910');
    expect(checkMedication(aquamal(raw), ds, NOW).registrationNumber).toBe('B4-0910');
  });
});

describe('not in any data we hold', () => {
  it('is "Unable to verify registration" (amber), with the spec wording and no fake/illegal claim', () => {
    const r = checkMedication(aquamal('A4-9150', { productName: 'Zentrimal' }), ds, NOW);
    expect(r.status).toBe('not_found_in_snapshot');
    expect(r.verdict).toBe('amber');
    expect(r.severity).toBe('caution');
    expect(codes(r)).toEqual(['NOT_IN_LOCAL_SNAPSHOT']);
    expect(r.headline).toBe('Unable to verify registration');
    expect(r.summary).toBe("We couldn't find this number in the registration data currently available to MedCheck.");
    expect(r.reasons[0].message).toContain('This does not establish that the medicine is fake or that its registration never existed.');
    expect(r.comparison[0]).toMatchObject({ inRegistry: 'No match in current local dataset', match: null });
    noUnsupportedClaims(r);
  });

  it('the report draft asks NAFDAC to verify instead of alleging falsification', () => {
    const input = aquamal('A4-9150', { productName: 'Zentrimal' });
    const d = buildReport({ input, result: checkMedication(input, ds, NOW) });
    expect(d.subject.startsWith('Please verify registration')).toBe(true);
    expect(d.body).not.toMatch(/substandard or falsified/);
  });
});

describe('historical official record (fixture reference, not real data)', () => {
  const hist: ReferenceRecord = {
    sourceType: 'nafdac_historical_document',
    sourceName: 'NAFDAC test document',
    recordType: 'Historical laboratory document',
    official: true,
    sourceUrl: 'https://example.invalid/historical.pdf',
    sourcePublishedAt: '2020-12-31',
    retrievedAt: '2026-10-25',
    registrationNumber: 'Z9-0001',
    productName: 'Testomal',
    activeIngredients: 'Artemether; Lumefantrine',
    strength: '80 mg; 480 mg',
    dosageForm: 'Tablet',
    manufacturer: 'Example Pharma Ltd',
    registrationStatus: 'unknown',
    evidenceLimitations: ['Test fixture.'],
  };
  const d = withExtras({ refs: [hist] });
  const input = () => aquamal('Z9-0001', { productName: 'Testomal', manufacturer: 'Example Pharma Ltd' });

  it('is "Historical registration record found", current status unverified', () => {
    const r = checkMedication(input(), d, NOW);
    expect(r.status).toBe('registry_match_historical');
    expect(r.verdict).toBe('amber');
    expect(r.currentRegistrationStatus).toBe('unknown');
    expect(codes(r)).toEqual(['HISTORICAL_RECORD_FOUND']);
    expect(r.headline).toBe('Historical registration record found');
    expect(r.summary).toMatch(/We have not confirmed whether its registration is currently active/);
    expect(r.comparisonSource).toBe('NAFDAC historical record');
    expect(r.evidence.find((e) => e.sourceType === 'nafdac_historical_document')).toMatchObject({ found: true, sourcePublishedAt: '2020-12-31' });
    noUnsupportedClaims(r);
  });

  it('an official historical record outranks a GS1 listing for the same number', () => {
    const both = withExtras({ refs: [hist, { ...hist, sourceType: 'gs1_listing', sourceName: 'GS1 Nigeria product registry', official: false }] });
    expect(checkMedication(input(), both, NOW).status).toBe('registry_match_historical');
  });
});

describe('mismatches stay visible', () => {
  it('valid number with the wrong medicine name is a mismatch (RED vs Greenbook)', () => {
    const p = pack('real-green');
    p.fields.productName.value = 'Malacure Forte';
    const r = checkMedication(p, ds, NOW);
    expect(r.status).toBe('record_mismatch');
    expect(r.severity).toBe('high');
    expect(codes(r)).toContain('FIELD_MISMATCH');
  });

  it('valid number with the wrong strength is a mismatch warning', () => {
    const p = pack('real-green');
    p.fields.strength.value = '20/120 mg';
    const r = checkMedication(p, ds, NOW);
    expect(r).toMatchObject({ status: 'record_mismatch', verdict: 'amber', severity: 'warning' });
  });

  full('B4-0910 with an unrelated brand conflicts with the GS1 listing: the listing does not vouch for it', () => {
    const r = checkMedication(aquamal('B4-0910', { productName: 'Malacure Forte', manufacturer: 'Sunrise Pharma Nig. Ltd' }), ds, NOW);
    expect(r.status).toBe('record_mismatch');
    expect(r.verdict).toBe('amber');
    expect(codes(r)).toContain('REFERENCE_FIELD_MISMATCH');
    expect(r.comparison.filter((c) => c.match === false).map((c) => c.field)).toEqual(['productName', 'manufacturer']);
  });

  full('B4-0910 with the wrong strength conflicts with the GS1 listing', () => {
    const r = checkMedication(aquamal('B4-0910', { strength: '20/120 mg' }), ds, NOW);
    expect(r.status).toBe('record_mismatch');
    expect(codes(r)).toContain('REFERENCE_FIELD_MISMATCH');
  });
});

describe('alerts still win', () => {
  it('Alert 042 (exact batch and number) is high-severity RED with the alert cited', () => {
    const r = checkMedication(pack('alert-042'), ds, NOW);
    expect(r).toMatchObject({ status: 'confirmed_regulatory_alert', verdict: 'red', severity: 'high' });
    expect(r.headline).toBe('Do not use this medicine');
    expect(r.reasons[0]).toMatchObject({ code: 'REGULATORY_ALERT' });
    expect(r.reasons[0].source.ref).toBe('042/2026');
    expect(r.evidence.find((e) => e.sourceType === 'nafdac_alert')?.found).toBe(true);
  });

  it('an alert on a number that also matches a registry record: alert wins', () => {
    const alert: Alert = {
      id: 'test-a4', source: 'NAFDAC', alertNo: 'T01/2026', title: 'Test alert on A4-6238', date: '2026-09-01',
      url: 'https://example.invalid/alert', products: [{ productName: 'Artheget EZ', regNo: 'A4-6238', batches: ['AG1042'] }], humanChecked: true,
    };
    const r = checkMedication(pack('real-green'), withExtras({ alerts: [alert] }), NOW);
    expect(r.status).toBe('confirmed_regulatory_alert');
    expect(r.verdict).toBe('red');
    expect(r.registryRecord?.regNo).toBe('A4-6238');
  });

  full('an alert on B4-0910 beats the matching GS1 listing', () => {
    const alert: Alert = {
      id: 'test-b4', source: 'NAFDAC', alertNo: 'T02/2026', title: 'Test alert', date: '2026-09-01',
      url: 'https://example.invalid/alert', products: [{ productName: 'Aquamal QS', regNo: 'B4-0910' }], humanChecked: true,
    };
    const r = checkMedication(aquamal(), withExtras({ alerts: [alert] }), NOW);
    expect(r).toMatchObject({ status: 'confirmed_regulatory_alert', verdict: 'red', severity: 'high' });
  });
});

describe('registration status, expiry, data problems', () => {
  full('Greenbook "Inactive" is stated with its source and date', () => {
    const p = aquamal('B4-0262', { productName: 'Coartem 80/480', manufacturer: 'Novartis Nigeria Limited' });
    const r = checkMedication(p, ds, NOW);
    expect(r.status).toBe('confirmed_inactive_or_cancelled');
    expect(r.currentRegistrationStatus).toBe('inactive');
    expect(codes(r)).toContain('REGISTRATION_INACTIVE');
    const gb = r.evidence.find((e) => e.sourceType === 'nafdac_greenbook')!;
    expect(gb.registrationStatus).toMatch(/^Inactive, registration expired 28 Mar 2026/);
    expect(gb.registrationStatusVerifiedAt).toBe(ds.registry.snapshotDate);
  });

  it('an expired printed pack is warned about independently of the registry result', () => {
    const p = pack('real-green');
    p.fields.expiryDate.value = '03/2026';
    expect(codes(checkMedication(p, ds, NOW))).toContain('PACK_EXPIRED');
    const q = aquamal('A4-9150', { productName: 'Zentrimal', expiryDate: '03/2026' });
    const r = checkMedication(q, ds, NOW);
    expect(codes(r)).toEqual(expect.arrayContaining(['PACK_EXPIRED', 'NOT_IN_LOCAL_SNAPSHOT']));
    expect(r.severity).toBe('warning');
  });

  it('registry unavailable: "Verification temporarily unavailable", never "not registered"', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'medcheck-'));
    writeFileSync(path.join(dir, 'registry.json'), '{ broken');
    copyFileSync(path.join(DATA_DIR, 'alerts.json'), path.join(dir, 'alerts.json'));
    const broken = loadDataset(dir);
    expect(broken.registry.available).toBe(false);
    const r = checkMedication(aquamal(), broken, NOW);
    expect(r).toMatchObject({ status: 'lookup_unavailable', verdict: 'unsure', headline: 'Verification temporarily unavailable' });
    expect(codes(r)).toEqual(['LOOKUP_UNAVAILABLE']);
    noUnsupportedClaims(r);
  });

  it('OCR letter O for zero with no match: ask the user to check, no substitution verdict', () => {
    const r = checkMedication(aquamal('A4-915O', { productName: 'Zentrimal' }), ds, NOW);
    expect(r).toMatchObject({ status: 'input_uncertain', verdict: 'unsure' });
    expect(codes(r)).toEqual(['REG_NO_CHARACTER_CORRECTED']);
    expect(r.reasons[0].message).toContain('"A4-915O"');
    noUnsupportedClaims(r);
  });

  full('OCR letter O that does match is checked but called out in a note', () => {
    const r = checkMedication(aquamal('B4-O262', { productName: 'Coartem 80/480', manufacturer: 'Novartis Nigeria Limited' }), ds, NOW);
    expect(r.registryRecord?.regNo).toBe('B4-0262');
    expect(r.notes.some((n) => n.includes('letter O as a zero'))).toBe(true);
  });

  it('stale data gets an explicit freshness note', () => {
    const r = checkMedication(pack('real-green'), ds, new Date('2026-12-15T00:00:00Z'));
    expect(r.notes.some((n) => /registry snapshot is \d+ days old/.test(n))).toBe(true);
  });

  it('a current match is "registry_match_current" and still says authenticity is not verified', () => {
    const r = checkMedication(pack('real-green'), ds, NOW);
    expect(r).toMatchObject({ status: 'registry_match_current', verdict: 'green', severity: 'none', currentRegistrationStatus: 'active', authenticityVerified: false });
    expect(r.caveat).toBe('Not proof of authenticity');
  });
});

describe('HTTP contract', () => {
  full('POST /api/check returns the structured decision for B4-0910', async () => {
    const res = await request(createApp({ dataset: ds, now: () => NOW })).post('/api/check').send(aquamal());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'external_product_match', severity: 'caution', registrationNumber: 'B4-0910', currentRegistrationStatus: 'unknown', authenticityVerified: false });
    expect(res.body.reasons[0].code).toBe('EXTERNAL_PRODUCT_RECORD_FOUND');
  });
});

describe('alert matching (review fixes)', () => {
  const multi: Alert = {
    id: 'test-multi', source: 'NAFDAC', alertNo: 'T03/2026', title: 'Two products', date: '2026-09-01', url: 'https://example.invalid/m',
    products: [
      { productName: 'Other Syrup', manufacturer: 'Other Co Ltd', batches: ['X1'], regNo: 'Z1-1111' },
      { productName: 'Artheget EZ', manufacturer: 'Getz Pharma Nigeria Limited', batches: ['AG1042'], regNo: 'A4-6238' },
    ],
    humanChecked: true,
  };

  it('evidence cites the alert product that actually matched, not the first one', () => {
    const r = checkMedication(pack('real-green'), withExtras({ alerts: [multi] }), NOW);
    const r2 = r.reasons.find((x) => x.rule === 'R2')!;
    expect(r2.verdict).toBe('red');
    expect(r2.evidence.find((e) => e.field === 'batchNo')?.inRegistry).toBe('AG1042');
    expect(r2.evidence.find((e) => e.field === 'nafdacRegNo')?.inRegistry).toBe('A4-6238');
  });

  it('a batch string shared with an unrelated product (different name and company) is AMBER, never RED and never silently GREEN', () => {
    const p = pack('real-green');
    p.fields.batchNo.value = 'BP5203'; // Alert 042's batch, on a different product
    const r = checkMedication(p, ds, NOW);
    // Not RED: batch strings collide across manufacturers. Not GREEN: a fake can copy a real brand onto a seized batch.
    expect(r.verdict).toBe('amber');
    expect(r.reasons.find((x) => x.rule === 'R2')?.title).toBe('Batch number appears on a NAFDAC alert for a different product');
  });

  it('a shared batch with only one detail differing is AMBER, not RED', () => {
    const p = pack('alert-042');
    p.fields.nafdacRegNo.value = null;
    p.fields.productName.value = 'Zentrimal';
    const r = checkMedication(p, ds, NOW);
    expect(r.reasons.find((x) => x.rule === 'R2')).toMatchObject({ verdict: 'amber', code: 'SIMILAR_PRODUCT_ALERT' });
  });

  it('an alert naming a genuine registered number does not turn a genuine pack (other batch) RED', () => {
    const alert: Alert = { ...multi, id: 'test-genuine', products: [{ productName: 'Artheget EZ', regNo: 'A4-6238', batches: ['FAKE01'] }] };
    const r = checkMedication(pack('real-green'), withExtras({ alerts: [alert] }), NOW);
    expect(r.verdict).toBe('amber');
    expect(r.reasons[0]).toMatchObject({ rule: 'R2', code: 'SIMILAR_PRODUCT_ALERT' });
  });

  it('a fake number named in an alert is RED on the number alone', () => {
    const p = pack('alert-042');
    p.fields.batchNo.value = 'ZZ999';
    expect(checkMedication(p, ds, NOW).reasons.find((x) => x.rule === 'R2')?.verdict).toBe('red');
  });
});

describe('expiry boundaries (review fixes)', () => {
  it('a pack is not expired on its last valid day', () => {
    const p = pack('real-green');
    p.fields.expiryDate.value = '10/2026';
    expect(codes(checkMedication(p, ds, new Date('2026-10-31T18:00:00Z')))).not.toContain('PACK_EXPIRED');
    expect(codes(checkMedication(p, ds, new Date('2026-11-01T00:00:00Z')))).toContain('PACK_EXPIRED');
    p.fields.expiryDate.value = '25/10/2026';
    expect(codes(checkMedication(p, ds, NOW))).not.toContain('PACK_EXPIRED');
  });

  it('a registration is not expired on its expiry day (A4-6238 expires 2026-12-01)', () => {
    expect(codes(checkMedication(pack('real-green'), ds, new Date('2026-12-01T15:00:00Z')))).not.toContain('REGISTRATION_EXPIRED');
    expect(codes(checkMedication(pack('real-green'), ds, new Date('2026-12-02T00:00:00Z')))).toContain('REGISTRATION_EXPIRED');
  });
});

it('no empty "against NAFDAC\'s record" line when nothing could be compared', () => {
  const p = pack('real-green');
  p.fields.productName.value = null;
  p.fields.strength.value = null;
  p.fields.manufacturer.value = null;
  const r = checkMedication(p, ds, NOW);
  expect(r.checked.some((c) => c.startsWith(' against'))).toBe(false);
});

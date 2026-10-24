// The verdict engine. Deterministic code only: no AI decides or words anything here.
import type {
  AlertMatch, ComparisonRow, FieldKey, Finding, RegistryRecord, StandardizedMedicationInput,
  Verdict, VerificationResult,
} from '../../../shared/types';
import { CAVEAT, GREEN_SUMMARY, LEGEND, NAFDAC_PHONE, VERDICT_ORDER } from '../../../shared/legend';
import type { Alert, Dataset } from './data';
import { daysBetween, formatDate, parseIsoDate, parsePackDate } from './dates';
import {
  formMatches, ingredientMatches, manufacturerMatches, productNameMatches, strengthMatches,
} from './match';
import { normalizeBatch, normalizeRegNo, regNoKey } from './normalize';

const LABELS: Record<FieldKey, string> = {
  productName: 'Product name',
  activeIngredient: 'Active ingredient',
  strength: 'Strength',
  dosageForm: 'Dosage form',
  nafdacRegNo: 'NAFDAC reg. no.',
  manufacturer: 'Manufacturer / licence holder',
  marketedBy: 'Marketed by',
  batchNo: 'Batch no.',
  expiryDate: 'Expiry date',
};

// R3: which mismatches mean a cloned number (RED) and which only need a closer look (AMBER).
// The manufacturer row is RED only when the pack also names a "marketed by" holder that doesn't match,
// or the product name is wrong too: NAFDAC lists the Nigerian holder, and genuine imports name a foreign factory.
const R3_RED_FIELDS: FieldKey[] = ['productName', 'activeIngredient'];
const R3_AMBER_FIELDS: FieldKey[] = ['strength', 'dosageForm'];

const REG_EXPIRY_WARN_DAYS = 60;

function val(input: StandardizedMedicationInput, key: FieldKey): string | null {
  const v = input.fields[key]?.value;
  return v && v.trim() ? v.trim() : null;
}

function worst(verdicts: Verdict[]): Verdict {
  for (const v of VERDICT_ORDER) if (verdicts.includes(v)) return v;
  return 'green';
}

function row(field: FieldKey, onPack: string | null, inRegistry: string | null, match: boolean | null): ComparisonRow {
  return { field, label: LABELS[field], onPack, inRegistry, match };
}

// Pick the record that best fits the pack when several share a number.
function bestRecord(records: RegistryRecord[], input: StandardizedMedicationInput): RegistryRecord {
  const score = (r: RegistryRecord) =>
    [productNameMatches(val(input, 'productName'), r.productName),
      manufacturerMatches(val(input, 'manufacturer'), r.applicant),
      strengthMatches(val(input, 'strength'), r.strength)].filter((m) => m === true).length;
  return [...records].sort((a, b) => score(b) - score(a))[0];
}

// Pack says "Made by X (abroad), marketed by Y (Nigeria)"; the registry lists Y. Either may match.
function holderRow(input: StandardizedMedicationInput, rec: RegistryRecord): ComparisonRow {
  const made = val(input, 'manufacturer');
  const marketed = val(input, 'marketedBy');
  const onPack = [made, marketed && `marketed by ${marketed}`].filter(Boolean).join(', ') || null;
  const m1 = manufacturerMatches(made, rec.applicant);
  const m2 = manufacturerMatches(marketed, rec.applicant);
  const match = m1 === true || m2 === true ? true : m1 === false || m2 === false ? false : null;
  return row('manufacturer', onPack, rec.applicant, match);
}

function compare(input: StandardizedMedicationInput, rec: RegistryRecord | null): ComparisonRow[] {
  const regOnPack = normalizeRegNo(val(input, 'nafdacRegNo'));
  const rows: ComparisonRow[] = [
    row('nafdacRegNo', regOnPack, rec?.regNo ?? null, rec ? true : regOnPack ? false : null),
  ];
  if (!rec) return rows;
  const pairs: [FieldKey, string | undefined, (a: string | null, b: string | null) => boolean | null][] = [
    ['productName', rec.productName, productNameMatches],
    ['activeIngredient', rec.ingredient ?? rec.composition, ingredientMatches],
    ['strength', rec.strength, strengthMatches],
    ['dosageForm', rec.form, formMatches],
  ];
  for (const [key, regValue, fn] of pairs) {
    const onPack = val(input, key);
    // Optional fields the pack didn't give are left out of the table rather than shown blank.
    if (!onPack && (key === 'activeIngredient' || key === 'dosageForm')) continue;
    rows.push(row(key, onPack, regValue ?? null, fn(onPack, regValue ?? null)));
  }
  rows.push(holderRow(input, rec));
  return rows;
}

function greenbookSource(ds: Dataset, regNo?: string) {
  return {
    name: `NAFDAC Greenbook (snapshot ${formatDate(ds.registry.snapshotDate)})`,
    ref: regNo,
    url: ds.registry.sourceUrl,
    date: ds.registry.snapshotDate,
  };
}

function alertSource(a: Alert) {
  return { name: `${a.source} ${a.source === 'NAFDAC' ? 'Public Alert' : 'Medical Product Alert'} ${a.alertNo}`, ref: a.alertNo, url: a.url, date: a.date };
}

function findAlerts(input: StandardizedMedicationInput, ds: Dataset) {
  const matches = new Map<string, { alert: Alert; on: Set<AlertMatch['matchedOn'][number]> }>();
  const add = (a: Alert, on: AlertMatch['matchedOn'][number]) => {
    const m = matches.get(a.id) ?? { alert: a, on: new Set() };
    m.on.add(on);
    matches.set(a.id, m);
  };
  const batch = normalizeBatch(val(input, 'batchNo'));
  if (batch) for (const a of ds.alertsByBatch.get(batch) ?? []) add(a, 'batchNo');
  const reg = regNoKey(val(input, 'nafdacRegNo'));
  if (reg) for (const a of ds.alertsByRegNo.get(reg) ?? []) add(a, 'nafdacRegNo');
  // No batch on the pack: a product + manufacturer match on an alert is worth a closer look.
  if (!batch) {
    for (const a of ds.alerts) {
      for (const p of a.products) {
        if (productNameMatches(val(input, 'productName'), p.productName ?? null)
          && manufacturerMatches(val(input, 'manufacturer'), p.manufacturer ?? null)) add(a, 'productName');
      }
    }
  }
  return [...matches.values()];
}

export function checkMedication(
  input: StandardizedMedicationInput,
  ds: Dataset,
  now: Date = new Date(),
): VerificationResult {
  const findings: Finding[] = [];
  const checked: string[] = [];
  const notChecked: string[] = [];
  const notes: string[] = [];

  const regRaw = val(input, 'nafdacRegNo');
  const regNo = normalizeRegNo(regRaw);
  const records = regNo ? ds.byRegNo.get(regNoKey(regNo)!) ?? [] : [];
  const rec = records.length ? bestRecord(records, input) : null;
  const comparison = compare(input, rec);
  const registryLine = `${ds.registry.total.toLocaleString('en-US')} products in the NAFDAC Greenbook (snapshot ${formatDate(ds.registry.snapshotDate)})`;

  // ---- U1: no registration number on the pack
  if (!regNo) {
    findings.push({
      rule: 'U1',
      verdict: 'unsure',
      title: 'No NAFDAC registration number',
      message: 'The pack has no NAFDAC registration number we could use, so we could not look it up in the registry.',
      evidence: [row('nafdacRegNo', null, null, null)],
      source: greenbookSource(ds),
      nextStep: 'Look for "NAFDAC Reg. No." on every side of the pack and near the barcode. A medicine sold in Nigeria must show one. If there is none, treat it with suspicion and ask a pharmacist.',
    });
    notChecked.push('Registration number (not on the pack)');
  } else {
    checked.push(`Registration number ${regNo} against ${registryLine}`);
  }

  // ---- R1: number not in the registry
  if (regNo && !rec) {
    findings.push({
      rule: 'R1',
      verdict: 'red',
      title: 'Registration number not found',
      message: `${regNo} is not in NAFDAC's registry. A medicine sold in Nigeria must carry a real NAFDAC number.`,
      evidence: [row('nafdacRegNo', regNo, null, false)],
      source: greenbookSource(ds, regNo),
      nextStep: `Check you entered the number exactly as printed. If it is right, don't use the medicine and report it to NAFDAC (${NAFDAC_PHONE}).`,
    });
  }

  // ---- R2: on an alert
  const alertHits = findAlerts(input, ds);
  for (const { alert, on } of alertHits) {
    const onBatchOrReg = on.has('batchNo') || on.has('nafdacRegNo');
    const p = alert.products[0];
    const evidence: ComparisonRow[] = [];
    if (on.has('batchNo')) evidence.push(row('batchNo', val(input, 'batchNo'), (p?.batches ?? []).join(', ') || null, true));
    if (on.has('nafdacRegNo')) evidence.push(row('nafdacRegNo', regNo, p?.regNo ?? null, true));
    if (on.has('productName')) {
      evidence.push(row('productName', val(input, 'productName'), p?.productName ?? null, true));
      evidence.push(row('manufacturer', val(input, 'manufacturer'), p?.manufacturer ?? null, true));
    }
    findings.push({
      rule: 'R2',
      verdict: onBatchOrReg ? 'red' : 'amber',
      title: onBatchOrReg ? `On ${alertSource(alert).name}` : `Similar product on ${alertSource(alert).name}`,
      message: onBatchOrReg
        ? `${alert.source} warned about this ${on.has('batchNo') ? 'batch' : 'registration number'} on ${formatDate(alert.date)}${alert.location ? ` (${alert.location})` : ''}: ${alert.title}.`
        : `The same product from the same manufacturer is named in an alert from ${formatDate(alert.date)}, and the pack shows no batch number to rule it out.`,
      evidence,
      source: alertSource(alert),
      nextStep: onBatchOrReg
        ? `Don't use it. Keep the pack and report it to NAFDAC (${NAFDAC_PHONE}), quoting alert ${alert.alertNo}.`
        : 'Find the batch number on the pack and check again, or ask a pharmacist.',
    });
  }
  const batch = val(input, 'batchNo');
  if (batch) checked.push(`Batch ${batch} against ${ds.alerts.length} human-checked alerts (last NAFDAC alert ${formatDate(ds.lastAlertDate)})`);
  else notChecked.push('Batch number (not on the pack)');
  if (regNo) checked.push(`Registration number against the same alerts`);

  if (rec) {
    // ---- R3: number exists but the details belong to another product
    const mismatches = comparison.filter((r) => r.match === false && r.field !== 'nafdacRegNo');
    const holderBad = mismatches.find((r) => r.field === 'manufacturer');
    const nameBad = mismatches.some((r) => R3_RED_FIELDS.includes(r.field));
    const holderIsRed = !!holderBad && (nameBad || !!val(input, 'marketedBy'));
    const redRows = mismatches.filter((r) => R3_RED_FIELDS.includes(r.field) || (r.field === 'manufacturer' && holderIsRed));
    const amberRows = mismatches.filter((r) => R3_AMBER_FIELDS.includes(r.field) || (r.field === 'manufacturer' && !holderIsRed));
    if (redRows.length) {
      findings.push({
        rule: 'R3',
        verdict: 'red',
        title: 'Registration number belongs to a different product',
        message: `${regNo} is registered to ${rec.productName} by ${rec.applicant}, but this pack shows ${redRows.map((r) => `${r.label.toLowerCase()} "${r.onPack}"`).join(' and ')}. A real number on the wrong product is a common sign of a falsified medicine.`,
        evidence: [row('nafdacRegNo', regNo, rec.regNo, true), ...mismatches],
        source: greenbookSource(ds, rec.regNo),
        nextStep: `Don't use it. Show the pack to a pharmacist and report it to NAFDAC (${NAFDAC_PHONE}).`,
      });
    } else if (amberRows.length) {
      findings.push({
        rule: 'R3',
        verdict: 'amber',
        title: `${amberRows.map((r) => r.label).join(' and ')} differ${amberRows.length === 1 ? 's' : ''} from the registered product`,
        message: `${regNo} is registered as ${rec.productName} ${rec.strength}${rec.form ? ` (${rec.form})` : ''} held by ${rec.applicant}, but this pack shows ${amberRows.map((r) => `${r.label.toLowerCase()} "${r.onPack}"`).join(' and ')}.${amberRows.some((r) => r.field === 'manufacturer') ? ` NAFDAC lists the Nigerian licence holder, not the factory, so look for "Marketed by" or "Imported by" ${rec.applicant} on the pack.` : ''}`,
        evidence: [row('nafdacRegNo', regNo, rec.regNo, true), ...amberRows],
        source: greenbookSource(ds, rec.regNo),
        nextStep: amberRows.some((r) => r.field === 'manufacturer')
          ? `Look for "Marketed by" or "Imported by" on the pack and add it, or ask a pharmacist.`
          : 'Ask a pharmacist to compare the pack with what was prescribed before using it.',
      });
    }
    checked.push(`${comparison.filter((r) => r.match !== null && r.field !== 'nafdacRegNo').map((r) => r.label.toLowerCase()).join(', ')} against NAFDAC's record for ${rec.regNo}`);
    for (const r of comparison) if (r.match === null && r.field !== 'nafdacRegNo') notChecked.push(`${r.label} (${r.onPack ? 'not in the registry record' : 'not on the pack'})`);

    // ---- R4: registration not active or expired
    const regExpiry = parseIsoDate(rec.expiryDate);
    const inactive = rec.status && rec.status.trim().toLowerCase() !== 'active';
    const expired = regExpiry ? regExpiry < now : false;
    if (inactive || expired) {
      findings.push({
        rule: 'R4',
        verdict: 'amber',
        title: inactive ? `Registration status is "${rec.status}"` : 'Registration has expired',
        message: inactive
          ? `NAFDAC lists ${rec.regNo} as "${rec.status}", not Active.`
          : `NAFDAC's registration for ${rec.regNo} expired on ${formatDate(regExpiry!)}.`,
        evidence: [row('nafdacRegNo', regNo, `${rec.regNo} (${rec.status}${rec.expiryDate ? `, registration expires ${rec.expiryDate}` : ''})`, false)],
        source: greenbookSource(ds, rec.regNo),
        nextStep: 'Ask a pharmacist whether this product can still be sold. Packs made while it was registered may still be fine.',
      });
    } else if (regExpiry) {
      const days = daysBetween(now, regExpiry);
      if (days <= REG_EXPIRY_WARN_DAYS) notes.push(`NAFDAC registration for ${rec.regNo} expires on ${formatDate(regExpiry)} (in ${days} days).`);
    }
    checked.push('Registration status and registration expiry');
  }

  // ---- R6: pack past its printed expiry
  const expRaw = val(input, 'expiryDate');
  const packExpiry = parsePackDate(expRaw);
  if (!expRaw) notChecked.push('Expiry date (not on the pack)');
  else if (!packExpiry) notChecked.push(`Expiry date ("${expRaw}" is not a date format we can read; check it by eye)`);
  else {
    checked.push(`Printed expiry date ${expRaw}`);
    if (packExpiry < now) {
      findings.push({
        rule: 'R6',
        verdict: 'amber',
        title: 'Pack is past its expiry date',
        message: `The pack says it expires ${expRaw}, which has passed.`,
        evidence: [row('expiryDate', expRaw, null, false)],
        source: { name: 'Expiry date printed on the pack' },
        nextStep: "Don't use expired medicine. Return it to the seller or ask a pharmacist how to dispose of it.",
      });
    }
  }

  // ---- R5: nothing fired
  if (!findings.length) {
    findings.push({
      rule: 'R5',
      verdict: 'green',
      title: 'Registered, no active alert, details consistent',
      message: GREEN_SUMMARY,
      evidence: comparison,
      source: greenbookSource(ds, rec?.regNo),
      nextStep: LEGEND.green.nextStep,
    });
  }

  const order = (v: Verdict) => VERDICT_ORDER.indexOf(v);
  findings.sort((a, b) => order(a.verdict) - order(b.verdict));
  const verdict = worst(findings.map((f) => f.verdict));
  const legend = LEGEND[verdict];

  if (ds.registry.isSeed) notes.push('Running on the seed registry (1 product). Load data/registry.json for the full Greenbook snapshot.');

  return {
    verdict,
    legend,
    headline: legend.headline,
    summary: verdict === 'green' ? GREEN_SUMMARY : findings[0].title,
    reasons: findings,
    comparison,
    registryRecord: rec,
    alertMatches: alertHits.map(({ alert, on }) => ({
      alertNo: alert.alertNo, title: alert.title, date: alert.date, url: alert.url, matchedOn: [...on],
    })),
    checked,
    notChecked,
    notes,
    dataAsOf: { registrySnapshot: ds.registry.snapshotDate, lastAlert: ds.lastAlertDate },
    caveat: CAVEAT,
    checkedAt: now.toISOString(),
  };
}

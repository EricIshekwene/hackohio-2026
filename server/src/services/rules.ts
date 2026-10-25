// The verdict engine. Deterministic code only: no AI decides or words anything here.
import type {
  AlertMatch, ComparisonRow, DecisionStatus, EvidenceRecord, FieldKey, Finding, RegistryRecord, Severity,
  StandardizedMedicationInput, Verdict, VerificationResult,
} from '../../../shared/types';
import {
  CAVEAT, EXTERNAL_EXPLANATION, GREEN_SUMMARY, HISTORICAL_EXPLANATION, LEGEND, NAFDAC_PHONE, NOT_FOUND_EXPLANATION,
  NOT_FOUND_REASON, STATUS_HEADLINE, VERDICT_ORDER,
} from '../../../shared/legend';
import type { Alert, AlertProduct, Dataset, ReferenceRecord } from './data';
import { daysBetween, formatDate, parseIsoDate, parsePackDate } from './dates';
import {
  formMatches, ingredientMatches, manufacturerMatches, manufacturerNearMiss, productNameMatches,
  productNameNearMiss, strengthMatches,
} from './match';
import { normalizeBatch, normalizeRegNo, normalizeText, regNoKey, regNoWasCorrected } from './normalize';

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

// Empty but the photo showed something there (torn, smudged, cut off): "unreadable", not "missing".
function unreadable(input: StandardizedMedicationInput, key: FieldKey): boolean {
  return !val(input, key) && !!input.fields[key]?.sourceText?.trim();
}

// Why a field has no value, for "not checked" lines.
function absentWhy(input: StandardizedMedicationInput, key: FieldKey): string {
  if (unreadable(input, key)) return "couldn't be read from the photo";
  // From a photo we can't tell "not printed" from "not in frame / not read": don't claim the pack lacks it.
  return input.source === 'photo' ? 'not found in the photo' : 'not on the pack';
}

function worst(verdicts: Verdict[]): Verdict {
  for (const v of VERDICT_ORDER) if (verdicts.includes(v)) return v;
  return 'green';
}

function row(field: FieldKey, onPack: string | null, inRegistry: string | null, match: boolean | null): ComparisonRow {
  return { field, label: LABELS[field], onPack, inRegistry, match };
}

// Pick the record that best fits the pack when several share a number (Greenbook keeps renewals and
// duplicates side by side). Name counts most (exact > clean match > near miss); every other field adds a
// point when it matches and loses one when it contradicts. Ties go to an Active, unexpired registration,
// so a genuine pack is never judged against the lapsed row of its own renewal.
function bestRecord(records: RegistryRecord[], input: StandardizedMedicationInput, now: Date): RegistryRecord {
  const pt = (m: boolean | null) => (m === true ? 1 : m === false ? -1 : 0);
  const packName = val(input, 'productName');
  const nameScore = (r: RegistryRecord) => {
    if (packName && normalizeText(packName) === normalizeText(r.productName)) return 4;
    const m = productNameMatches(packName, r.productName);
    return m !== true ? pt(m) : productNameNearMiss(packName, r.productName) ? 1 : 3;
  };
  const holder = (r: RegistryRecord) => {
    const made = manufacturerMatches(val(input, 'manufacturer'), r.applicant);
    const marketed = manufacturerMatches(val(input, 'marketedBy'), r.applicant);
    return made === true || marketed === true ? 1 : pt(marketed ?? made);
  };
  const score = (r: RegistryRecord) => nameScore(r)
    + pt(ingredientMatches(val(input, 'activeIngredient'), r.ingredient ?? r.composition ?? null))
    + pt(strengthMatches(val(input, 'strength'), r.strength))
    + pt(formMatches(val(input, 'dosageForm'), r.form ?? null))
    + holder(r);
  const current = (r: RegistryRecord) => {
    const exp = parseIsoDate(r.expiryDate);
    const unexpired = !exp || !pastDay(exp, now);
    return (r.status?.trim().toLowerCase() === 'active' ? 2 : 0) + (unexpired ? 1 : 0);
  };
  // Array.prototype.sort is stable, so remaining ties keep file order.
  return [...records].sort((a, b) => score(b) - score(a) || current(b) - current(a))[0];
}

// Pack says "Made by X (abroad), marketed by Y (Nigeria)"; the registry lists Y. Either may match.
function holderRow(input: StandardizedMedicationInput, rec: RegistryRecord): ComparisonRow {
  const made = val(input, 'manufacturer');
  const marketed = val(input, 'marketedBy');
  const onPack = [made, marketed && `marketed by ${marketed}`].filter(Boolean).join(', ') || null;
  // When the pack names a holder, that is what NAFDAC registered: judge it alone, so a real
  // factory name can't vouch for a fake "marketed by" company.
  const judged = marketed ?? made;
  const match = manufacturerMatches(judged, rec.applicant);
  return row('manufacturer', onPack, rec.applicant, match);
}

// Fields whose match was fuzzy only (a near-miss spelling). They show as mismatches in the table but get
// their own AMBER finding instead of feeding the RED/AMBER R3 split.
function nearMisses(input: StandardizedMedicationInput, rec: RegistryRecord): Set<FieldKey> {
  const out = new Set<FieldKey>();
  if (productNameNearMiss(val(input, 'productName'), rec.productName)) out.add('productName');
  if (manufacturerNearMiss(val(input, 'marketedBy') ?? val(input, 'manufacturer'), rec.applicant)) out.add('manufacturer');
  return out;
}

// What the right-hand column says when there is no record to compare against. Never "No record" on its own:
// the absence is a fact about our data, not about NAFDAC.
const NO_LOCAL_MATCH = 'No match in current local dataset';

// A reference (GS1, historical document) in the registry record's shape, for comparison only.
function refAsRecord(ref: ReferenceRecord): RegistryRecord {
  return {
    regNo: ref.registrationNumber,
    productName: ref.productName ?? '',
    strength: ref.strength ?? '',
    ingredient: ref.activeIngredients,
    applicant: ref.manufacturer ?? '',
    form: ref.dosageForm,
    status: 'unknown',
  };
}

function compare(input: StandardizedMedicationInput, rec: RegistryRecord | null): ComparisonRow[] {
  const regOnPack = normalizeRegNo(val(input, 'nafdacRegNo'));
  const rows: ComparisonRow[] = [
    row('nafdacRegNo', regOnPack, rec ? rec.regNo : regOnPack ? NO_LOCAL_MATCH : null, rec ? true : null),
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
  const near = nearMisses(input, rec);
  return rows.map((r) => (near.has(r.field) ? { ...r, match: false } : r));
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

type AlertKey = AlertMatch['matchedOn'][number];
// unrelated: only the batch string is shared, and both name and company differ (another product's batch code).
interface AlertHit { alert: Alert; product: AlertProduct; on: Set<AlertKey>; strong: boolean; unrelated: boolean }

// Does the pack contradict the alert's product? Batch codes ("001", "B2401") are not globally unique, so a
// shared batch is RED only when neither name nor company disagrees, and AMBER otherwise (never silently GREEN).
function contradicts(input: StandardizedMedicationInput, p: AlertProduct) {
  const name = productNameMatches(val(input, 'productName'), p.productName ?? null);
  const maker = manufacturerMatches(val(input, 'marketedBy') ?? val(input, 'manufacturer'), p.manufacturer ?? null)
    ?? manufacturerMatches(val(input, 'manufacturer'), p.manufacturer ?? null);
  return { name: name === false, maker: maker === false, any: name === false || maker === false, both: name === false && maker === false };
}

function findAlerts(input: StandardizedMedicationInput, ds: Dataset): AlertHit[] {
  const hits = new Map<string, AlertHit>();
  const add = (a: Alert, p: AlertProduct, on: AlertKey) => {
    const key = `${a.id}:${a.products.indexOf(p)}`;
    const h = hits.get(key) ?? { alert: a, product: p, on: new Set<AlertKey>(), strong: false, unrelated: false };
    h.on.add(on);
    hits.set(key, h);
  };
  const batch = normalizeBatch(val(input, 'batchNo'));
  const reg = regNoKey(val(input, 'nafdacRegNo'));
  for (const a of batch ? ds.alertsByBatch.get(batch) ?? [] : []) {
    for (const p of a.products) if ((p.batches ?? []).some((b) => normalizeBatch(b) === batch)) add(a, p, 'batchNo');
  }
  for (const a of reg ? ds.alertsByRegNo.get(reg) ?? [] : []) {
    for (const p of a.products) if (regNoKey(p.regNo) === reg) add(a, p, 'nafdacRegNo');
  }
  // No batch on the pack: a product + manufacturer match on an alert is worth a closer look.
  if (!batch) {
    for (const a of ds.alerts) {
      for (const p of a.products) {
        if (productNameMatches(val(input, 'productName'), p.productName ?? null)
          && manufacturerMatches(val(input, 'manufacturer'), p.manufacturer ?? null)) add(a, p, 'productName');
      }
    }
  }
  const out: AlertHit[] = [];
  for (const h of hits.values()) {
    const c = contradicts(input, h.product);
    const batchOk = h.on.has('batchNo') && !c.any;
    // An alert that names a genuine registered number (falsified copies of a real brand) must not turn
    // every genuine pack RED: the number alone counts only when NAFDAC doesn't list it, or the batch matches too.
    const regIsFake = !!reg && !ds.byRegNo.has(reg);
    const regOk = h.on.has('nafdacRegNo') && (regIsFake || batchOk);
    h.strong = batchOk || regOk;
    // A batch string shared with an unrelated product is not RED (batch codes repeat across makers), but a
    // copied alert batch on another brand's pack still needs a closer look, so it stays an AMBER hit.
    h.unrelated = h.on.size === 1 && h.on.has('batchNo') && c.both;
    out.push(h);
  }
  return out;
}

// A date printed as a day (or month-end) is valid through that whole day.
function pastDay(d: Date, now: Date) {
  return d.getTime() + 86_400_000 <= now.getTime();
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
  const rec = records.length ? bestRecord(records, input, now) : null;
  const corrected = regNoWasCorrected(regRaw);
  const lookupDown = !ds.registry.available;
  // No Greenbook row: look for other evidence about the number. Official NAFDAC documents outrank listings.
  const refs = regNo && !rec ? ds.references.get(regNoKey(regNo)!) ?? [] : [];
  const ref = refs.find((r) => r.official) ?? refs[0] ?? null;
  const target = rec ?? (ref ? refAsRecord(ref) : null);
  const comparison = compare(input, target);
  const comparisonSource = rec ? 'NAFDAC record' : ref ? (ref.official ? 'NAFDAC historical record' : `${ref.sourceName.replace(/ product registry$/, '')} listing`) : 'NAFDAC record';
  const registryLine = `${ds.registry.total.toLocaleString('en-US')} products in the NAFDAC Greenbook (snapshot downloaded ${formatDate(ds.registry.snapshotDate)})`;

  // ---- U1: no registration number on the pack (or one the photo showed but couldn't be read)
  if (!regNo) {
    const torn = unreadable(input, 'nafdacRegNo');
    findings.push({
      rule: 'U1',
      code: 'NO_REG_NO',
      verdict: 'unsure',
      title: torn
        ? "Registration number couldn't be read clearly"
        : input.source === 'photo' ? 'No NAFDAC registration number found in the photo' : 'No NAFDAC registration number',
      message: torn
        ? `Part of a NAFDAC registration number is visible ("${input.fields.nafdacRegNo.sourceText!.trim()}"), but it couldn't be read in full from the photo, so we could not look it up in the registry.`
        : input.source === 'photo'
          ? "We couldn't find a NAFDAC registration number in the photo (it may be on another side or out of frame), so we could not look it up in the registry."
          : 'The pack has no NAFDAC registration number we could use, so we could not look it up in the registry.',
      evidence: [row('nafdacRegNo', null, null, null)],
      source: greenbookSource(ds),
      nextStep: torn
        ? 'Read the number off the pack yourself (it often starts with a letter and has a dash, like A4-1234), type it in, and check again.'
        : 'Look for "NAFDAC Reg. No." on every side of the pack and near the barcode. A medicine sold in Nigeria must show one. If there is none, treat it with suspicion and ask a pharmacist.',
    });
    notChecked.push(`Registration number (${absentWhy(input, 'nafdacRegNo')})`);
  } else {
    checked.push(`Registration number ${regNo} against ${registryLine}`);
  }

  // ---- U3 / U2 / R1: no Greenbook row for the number. Absence from our snapshot is a coverage gap, never proof
  // that the registration never existed, so none of these can be RED on their own.
  if (regNo && !rec && lookupDown) {
    findings.push({
      rule: 'U3',
      code: 'LOOKUP_UNAVAILABLE',
      verdict: 'unsure',
      title: 'Verification temporarily unavailable',
      message: "MedCheck's copy of the NAFDAC registry could not be loaded, so this number was not checked. This says nothing about the medicine itself.",
      evidence: [row('nafdacRegNo', regNo, null, null)],
      source: greenbookSource(ds, regNo),
      nextStep: `Try again later, or verify the number with NAFDAC (${NAFDAC_PHONE}) or a licensed pharmacist.`,
    });
  } else if (regNo && !rec && corrected && !ref) {
    findings.push({
      rule: 'U2',
      code: 'REG_NO_CHARACTER_CORRECTED',
      verdict: 'unsure',
      title: 'Check the registration number',
      message: `"${regRaw}" has a letter O where NAFDAC numbers only use digits. We tried ${regNo} and found no match, so the number may have been misread.`,
      evidence: [row('nafdacRegNo', regRaw, null, null)],
      source: greenbookSource(ds, regNo),
      nextStep: 'Compare the number letter by letter with the pack, correct it, and check again.',
    });
  } else if (regNo && !rec) {
    const official = !!ref?.official;
    const refMsg = ref
      ? ` ${ref.sourceName} (${ref.recordType.toLowerCase()}${ref.sourcePublishedAt ? `, ${formatDate(ref.sourcePublishedAt)}` : ''}) lists ${ref.registrationNumber} as ${[ref.productName, ref.strength, ref.dosageForm].filter(Boolean).join(', ')}${ref.manufacturer ? ` from ${ref.manufacturer}` : ''}.`
      : '';
    findings.push({
      rule: 'R1',
      code: ref ? (official ? 'HISTORICAL_RECORD_FOUND' : 'EXTERNAL_PRODUCT_RECORD_FOUND') : 'NOT_IN_LOCAL_SNAPSHOT',
      verdict: 'amber',
      title: ref ? (official ? 'Historical registration record found' : 'Product listing found, registration unverified') : 'Unable to verify registration',
      message: ref
        ? `${official ? HISTORICAL_EXPLANATION : EXTERNAL_EXPLANATION}${refMsg} ${regNo} is not in our current Greenbook snapshot.`
        : `${NOT_FOUND_REASON} ${NOT_FOUND_EXPLANATION}`,
      evidence: [row('nafdacRegNo', regNo, ref ? `${ref.registrationNumber} (${ref.sourceName})` : NO_LOCAL_MATCH, ref ? true : null)],
      source: ref
        ? { name: ref.sourceName, ref: ref.registrationNumber, url: ref.sourceUrl, date: ref.sourcePublishedAt ?? ref.retrievedAt }
        : greenbookSource(ds, regNo),
      nextStep: `Check the printed number, then verify it with NAFDAC (${NAFDAC_PHONE}) or a licensed pharmacist before relying on the product.`,
    });
  }

  // ---- R2: on an alert
  const alertHits = findAlerts(input, ds);
  for (const { alert, product: p, on, strong, unrelated } of alertHits) {
    const evidence: ComparisonRow[] = [];
    if (on.has('batchNo')) evidence.push(row('batchNo', val(input, 'batchNo'), (p.batches ?? []).join(', ') || null, true));
    if (on.has('nafdacRegNo')) evidence.push(row('nafdacRegNo', regNo, p.regNo ?? null, true));
    if (on.has('productName') || !strong) {
      evidence.push(row('productName', val(input, 'productName'), p.productName ?? null, productNameMatches(val(input, 'productName'), p.productName ?? null)));
      evidence.push(row('manufacturer', val(input, 'manufacturer'), p.manufacturer ?? null, manufacturerMatches(val(input, 'manufacturer'), p.manufacturer ?? null)));
    }
    const what = on.has('batchNo') ? 'batch' : on.has('nafdacRegNo') ? 'registration number' : 'product';
    if (unrelated) {
      findings.push({
        rule: 'R2',
        code: 'SIMILAR_PRODUCT_ALERT',
        verdict: 'amber',
        title: 'Batch number appears on a NAFDAC alert for a different product',
        message: `Batch ${val(input, 'batchNo')} is listed in ${alertSource(alert).name} (${formatDate(alert.date)}, ${alert.url}) for ${p.productName ?? 'another product'}${p.manufacturer ? ` from ${p.manufacturer}` : ''}. The name and company on this pack are different, so it may be a coincidence, but fakers also copy batch numbers from other packs.`,
        evidence,
        source: alertSource(alert),
        nextStep: `Compare the batch number on the pack carefully with alert ${alert.alertNo}, and ask a pharmacist before using it.`,
      });
      continue;
    }
    findings.push({
      rule: 'R2',
      code: strong ? 'REGULATORY_ALERT' : 'SIMILAR_PRODUCT_ALERT',
      verdict: strong ? 'red' : 'amber',
      title: strong ? `On ${alertSource(alert).name}` : `Similar product on ${alertSource(alert).name}`,
      message: strong
        ? `${alert.source} warned about this ${what} on ${formatDate(alert.date)}${alert.location ? ` (${alert.location})` : ''}: ${alert.title}.`
        : on.has('productName')
          ? `The same product from the same manufacturer is named in an alert from ${formatDate(alert.date)}, and the pack shows no batch number to rule it out.`
          : `An alert from ${formatDate(alert.date)} names this ${what}, but other details on the pack differ from the product in the alert, so it may not be the same product.`,
      evidence,
      source: alertSource(alert),
      nextStep: strong
        ? `Don't use it. Keep the pack and report it to NAFDAC (${NAFDAC_PHONE}), quoting alert ${alert.alertNo}.`
        : 'Check the batch number on the pack against the alert, or ask a pharmacist.',
    });
  }
  const batch = val(input, 'batchNo');
  if (batch) checked.push(`Batch ${batch} against ${ds.alerts.length} human-checked alert${ds.alerts.length === 1 ? '' : 's'} (last NAFDAC alert ${formatDate(ds.lastAlertDate)})`);
  else notChecked.push(`Batch number (${absentWhy(input, 'batchNo')})`);
  if (regNo) checked.push(`Registration number against the same alerts`);

  if (rec) {
    // ---- R3: number exists but the details belong to another product
    const near = nearMisses(input, rec);
    const nearRows = comparison.filter((r) => near.has(r.field));
    const mismatches = comparison.filter((r) => r.match === false && r.field !== 'nafdacRegNo' && !near.has(r.field));
    const holderBad = mismatches.find((r) => r.field === 'manufacturer');
    const nameBad = mismatches.some((r) => R3_RED_FIELDS.includes(r.field));
    const holderIsRed = !!holderBad && (nameBad || !!val(input, 'marketedBy'));
    const redRows = mismatches.filter((r) => R3_RED_FIELDS.includes(r.field) || (r.field === 'manufacturer' && holderIsRed));
    const amberRows = mismatches.filter((r) => R3_AMBER_FIELDS.includes(r.field) || (r.field === 'manufacturer' && !holderIsRed));
    if (redRows.length) {
      findings.push({
        rule: 'R3',
        code: 'FIELD_MISMATCH',
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
        code: 'FIELD_MISMATCH',
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
    if (nearRows.length) {
      findings.push({
        rule: 'R3',
        code: 'NAME_NEAR_MISS',
        verdict: 'amber',
        title: "Spelling differs from NAFDAC's record",
        message: `${nearRows.map((r) => `The pack's ${r.label.toLowerCase()} "${r.onPack}" is close to, but not the same as, NAFDAC's "${r.inRegistry}"`).join('. ')}. A slightly misspelled brand or company name is a common sign of a fake pack.`,
        evidence: [row('nafdacRegNo', regNo, rec.regNo, true), ...nearRows],
        source: greenbookSource(ds, rec.regNo),
        nextStep: 'Compare the spelling on the pack letter by letter. If it really differs, ask a pharmacist before using it.',
      });
    }
    const comparedFields = comparison.filter((r) => r.match !== null && r.field !== 'nafdacRegNo').map((r) => r.label.toLowerCase());
    if (comparedFields.length) checked.push(`${comparedFields.join(', ')} against NAFDAC's record for ${rec.regNo}`);
    for (const r of comparison) if (r.match === null && r.field !== 'nafdacRegNo') notChecked.push(`${r.label} (${r.onPack ? 'not in the registry record' : absentWhy(input, r.field)})`);

    // ---- R4: registration not active or expired
    const regExpiry = parseIsoDate(rec.expiryDate);
    const inactive = rec.status && rec.status.trim().toLowerCase() !== 'active';
    const expired = regExpiry ? pastDay(regExpiry, now) : false;
    if (inactive || expired) {
      findings.push({
        rule: 'R4',
        code: inactive ? 'REGISTRATION_INACTIVE' : 'REGISTRATION_EXPIRED',
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

  // ---- R3 against a non-Greenbook reference: same number, different product details. AMBER, not RED:
  // these sources are weaker than the registry, but a conflict must stay visible and actionable.
  if (!rec && ref && target) {
    const refBad = comparison.filter((r) => r.match === false && r.field !== 'nafdacRegNo');
    if (refBad.length) {
      findings.push({
        rule: 'R3',
        code: 'REFERENCE_FIELD_MISMATCH',
        verdict: 'amber',
        title: 'Packaging details conflict with the reference record',
        message: `${ref.sourceName} lists ${ref.registrationNumber} as ${[ref.productName, ref.strength, ref.dosageForm].filter(Boolean).join(', ')}${ref.manufacturer ? ` from ${ref.manufacturer}` : ''}, but this pack shows ${refBad.map((r) => `${r.label.toLowerCase()} "${r.onPack}"`).join(' and ')}.`,
        evidence: [row('nafdacRegNo', regNo, ref.registrationNumber, true), ...refBad],
        source: { name: ref.sourceName, ref: ref.registrationNumber, url: ref.sourceUrl, date: ref.sourcePublishedAt ?? ref.retrievedAt },
        nextStep: `Don't rely on this pack until a pharmacist or NAFDAC (${NAFDAC_PHONE}) has checked it.`,
      });
    }
    const compared = comparison.filter((r) => r.match !== null && r.field !== 'nafdacRegNo').map((r) => r.label.toLowerCase());
    if (compared.length) checked.push(`${compared.join(', ')} against ${ref.sourceName}'s record for ${ref.registrationNumber}`);
  }

  if (regNo && corrected && (rec || ref)) notes.push(`The number was entered as "${regRaw}". We read the letter O as a zero (${regNo}); check that matches the pack.`);

  // Same brand name registered under a different number: useful context, never a match.
  if (regNo && !rec && !lookupDown) {
    const packName = val(input, 'productName');
    const same = packName
      ? ds.products
        .filter((p) => productNameMatches(packName, p.productName) === true && !productNameNearMiss(packName, p.productName))
        // Closest first: same strength, then Active.
        .sort((a, b) => Number(strengthMatches(val(input, 'strength'), b.strength) === true) - Number(strengthMatches(val(input, 'strength'), a.strength) === true)
          || Number(b.status === 'Active') - Number(a.status === 'Active'))
        .slice(0, 1)
      : [];
    for (const p of same) {
      notes.push(`NAFDAC's registry lists "${p.productName}" (${p.strength}${p.form ? `, ${p.form}` : ''}) from ${p.applicant} under a different number, ${p.regNo} (${p.status}). That is not the number on this pack.`);
    }
  }

  // ---- R6: pack past its printed expiry
  const expRaw = val(input, 'expiryDate');
  const packExpiry = parsePackDate(expRaw);
  if (!expRaw) notChecked.push(`Expiry date (${absentWhy(input, 'expiryDate')})`);
  else if (!packExpiry) notChecked.push(`Expiry date ("${expRaw}" is not a date format we can read; check it by eye)`);
  else {
    checked.push(`Printed expiry date ${expRaw}`);
    if (pastDay(packExpiry, now)) {
      findings.push({
        rule: 'R6',
        code: 'PACK_EXPIRED',
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
      code: 'REGISTRY_MATCH_CURRENT',
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

  // ---- Decision status: alerts and documented mismatches outrank everything; a listing never overrides them.
  const has = (code: Finding['code'], v?: Verdict) => findings.some((f) => f.code === code && (!v || f.verdict === v));
  const regExpired = !!rec && !!parseIsoDate(rec.expiryDate) && pastDay(parseIsoDate(rec.expiryDate)!, now);
  const status: DecisionStatus =
    has('REGULATORY_ALERT') ? 'confirmed_regulatory_alert'
      : has('FIELD_MISMATCH') || has('NAME_NEAR_MISS') || has('REFERENCE_FIELD_MISMATCH') ? 'record_mismatch'
        : has('REGISTRATION_INACTIVE') || has('REGISTRATION_EXPIRED') ? 'confirmed_inactive_or_cancelled'
          : rec ? 'registry_match_current'
            : has('LOOKUP_UNAVAILABLE') ? 'lookup_unavailable'
              : !regNo || has('REG_NO_CHARACTER_CORRECTED') ? 'input_uncertain'
                : has('HISTORICAL_RECORD_FOUND') ? 'registry_match_historical'
                  : has('EXTERNAL_PRODUCT_RECORD_FOUND') ? 'external_product_match'
                    : 'not_found_in_snapshot';
  const severity: Severity =
    verdict === 'red' ? 'high'
      : verdict === 'green' ? 'none'
        : status === 'record_mismatch' || status === 'confirmed_inactive_or_cancelled' || has('PACK_EXPIRED') || has('SIMILAR_PRODUCT_ALERT') ? 'warning'
          : 'caution';
  // The status headline only applies when the status is what set the colour (e.g. an expired pack on an
  // unverified number still leads with the expiry).
  const statusFinding = findings.find((f) => f.rule === 'R1' || f.rule === 'U3');
  const statusLeads = !!statusFinding && findings[0] === statusFinding;
  const headline = (statusLeads && STATUS_HEADLINE[status]) || legend.headline;
  const summary = verdict === 'green' ? GREEN_SUMMARY
    : statusLeads && status === 'not_found_in_snapshot' ? NOT_FOUND_REASON
      : statusLeads && status === 'registry_match_historical' ? HISTORICAL_EXPLANATION
        : statusLeads && status === 'external_product_match' ? EXTERNAL_EXPLANATION
          : findings[0].title;

  // ---- Evidence: every source consulted, with what it does and does not establish.
  const coverage = [
    'A snapshot of what Greenbook listed on the download date, not a live lookup.',
    ds.registry.earliestRegExpiry
      ? `Greenbook only returned registrations expiring on or after ${formatDate(ds.registry.earliestRegExpiry)}; older lapsed or renumbered registrations are missing, so absence here does not mean a number never existed.`
      : 'Coverage of older or lapsed registrations is unknown.',
  ];
  const evidence: EvidenceRecord[] = [{
    sourceType: 'nafdac_greenbook',
    sourceName: 'NAFDAC Greenbook',
    recordType: 'Registry snapshot',
    official: true,
    found: !!rec,
    sourceUrl: ds.registry.sourceUrl,
    retrievedAt: ds.registry.available ? ds.registry.snapshotDate : undefined,
    registrationNumber: rec?.regNo ?? null,
    productName: rec?.productName,
    activeIngredients: rec?.ingredient,
    strength: rec?.strength,
    dosageForm: rec?.form,
    manufacturer: rec?.applicant,
    registrationStatus: rec ? `${rec.status}${rec.expiryDate ? `, registration ${regExpired ? 'expired' : 'expires'} ${formatDate(rec.expiryDate)}` : ''}` : 'unknown',
    registrationStatusVerifiedAt: rec ? ds.registry.snapshotDate : undefined,
    evidenceLimitations: lookupDown ? ['The registry file could not be loaded for this check.'] : coverage,
  }];
  for (const r of refs) {
    evidence.push({ ...r, sourcePublishedAt: r.sourcePublishedAt ?? undefined, found: true });
  }
  evidence.push({
    sourceType: 'nafdac_alert',
    sourceName: 'NAFDAC and WHO alerts',
    recordType: `${ds.alerts.length} human-checked alert${ds.alerts.length === 1 ? '' : 's'}`,
    official: true,
    found: alertHits.length > 0,
    sourcePublishedAt: ds.lastAlertDate,
    registrationNumber: alertHits.length ? regNo : null,
    registrationStatus: 'unknown',
    evidenceLimitations: ['Only alerts a person has checked and entered; newer alerts may be missing.'],
  });

  if (regNo && !rec && !lookupDown) {
    notes.push(`Current NAFDAC registration status: unavailable. ${regNo} is not in our Greenbook snapshot (downloaded ${formatDate(ds.registry.snapshotDate)}), which ${coverage[1].replace(/^Greenbook /, '').replace(/^only returned/, 'only holds')}`);
  }
  const ageDays = parseIsoDate(ds.registry.snapshotDate) ? daysBetween(parseIsoDate(ds.registry.snapshotDate)!, now) : null;
  if (ageDays !== null && ageDays > 30) notes.push(`The registry snapshot is ${ageDays} days old (downloaded ${formatDate(ds.registry.snapshotDate)}). Registrations may have changed since.`);
  if (ds.registry.isSeed) notes.push('Running on the seed registry (1 product). Load data/registry.json for the full Greenbook snapshot.');

  return {
    status,
    severity,
    registrationNumber: regNo,
    productName: rec?.productName ?? ref?.productName ?? val(input, 'productName'),
    currentRegistrationStatus: !rec ? 'unknown' : rec.status?.trim().toLowerCase() !== 'active' ? 'inactive' : regExpired ? 'expired' : 'active',
    authenticityVerified: false,
    evidence,
    comparisonSource,
    verdict,
    legend,
    headline,
    summary,
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

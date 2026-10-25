// AI reading -> StandardizedMedicationInput fields, with display cleanup and confidence capped by code checks.
// Reuses the backend's normalisers where they exist so both layers clean values the same way.
import type { ExtractedField, StandardizedMedicationInput } from '../../../shared/types';
import { parsePackDate } from '../services/dates';
import { nameTokens, normalizeBatch, normalizeRegNo, normalizeText, strengthNumbers } from '../services/normalize';
import { EXTRACT_KEYS, type ExtractKey, type RawExtraction } from './claude';

const REQUIRED: ExtractKey[] = ['productName', 'strength', 'nafdacRegNo', 'manufacturer', 'batchNo', 'expiryDate'];
// Same shape the client hints on (client/src/lib/fields.ts).
const REG_NO = /^[A-Z0-9]{2,3}-\d{3,6}(?:[A-Z])?$/;

// Look-alike characters from other alphabets that AI/OCR output sometimes contains.
const HOMOGLYPHS: Record<string, string> = {
  З: '3', з: '3', О: 'O', о: 'o', А: 'A', а: 'a', В: 'B', Е: 'E', е: 'e', К: 'K', к: 'k', М: 'M', Н: 'H',
  Р: 'P', р: 'p', С: 'C', с: 'c', Т: 'T', Х: 'X', х: 'x', І: 'I', і: 'i', Ο: 'O', ο: 'o', Α: 'A', Β: 'B',
  Ε: 'E', Κ: 'K', Μ: 'M', Ν: 'N', Ρ: 'P', Τ: 'T', Χ: 'X',
};

function base(raw: string): { text: string; swapped: boolean } {
  let swapped = false;
  const text = [...raw.normalize('NFKC')]
    .map((ch) => {
      const r = HOMOGLYPHS[ch];
      if (r) swapped = true;
      return r ?? ch;
    })
    .join('');
  return { text: text.replace(/\s+/g, ' ').trim(), swapped };
}

export interface Cleaned {
  value: string | null;
  formatOk: boolean;
  changedChars: boolean; // cleanup swapped characters, not just spacing/case/labels
  notes: string[];
}

function regNo(raw: string): Cleaned {
  const { text, swapped } = base(raw);
  const value = normalizeRegNo(text);
  if (!value) return { value: null, formatOk: false, changedChars: swapped, notes: [] };
  const skeleton = text
    .toUpperCase()
    .replace(/NAFDAC|REG(ISTRATION)?\.?|NO\.?|NUMBER|[:#]/g, ' ')
    .replace(/[^A-Z0-9]/g, '');
  const changedChars = swapped || skeleton !== value.replace(/-/g, '');
  const notes = [];
  if (swapped) notes.push('replaced look-alike characters');
  if (skeleton !== value.replace(/-/g, '')) notes.push('changed letter O to digit 0');
  // A fragment ("04-77" from a torn box, "04" beside a thumb) is not a registration number. Passing it on
  // would make the rules call the pack "not registered" (RED) when the truth is "can't tell" (UNSURE).
  // Send null; the client still shows what was read via sourceText so the user can type the full number.
  if (!REG_NO.test(value)) {
    notes.push(`only part of a NAFDAC number is readable ("${value}"); type the full number from the pack or leave it empty`);
    return { value: null, formatOk: false, changedChars, notes };
  }
  return { value, formatOk: true, changedChars, notes };
}

const UNIT_MAP: Record<string, string> = { mg: 'mg', mcg: 'mcg', 'µg': 'mcg', 'μg': 'mcg', ug: 'mcg', g: 'g', ml: 'ml', iu: 'iu', '%': '%' };

function strength(raw: string): Cleaned {
  const { text, swapped } = base(raw);
  const parts = text.toLowerCase().split(/\s*(?:\/|\+|&|;|,(?!\d)|\band\b)\s*/).filter(Boolean);
  const parsed = parts.map((p) => {
    const m = p.match(/^(\d{1,3}(?:,\d{3})+|\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|μg|ug|g|ml|iu|%)?$/);
    if (!m) return null;
    // "100,000 IU" is a thousands comma; "2,5 mg" a decimal comma.
    const n = /^\d{1,3}(,\d{3})+$/.test(m[1]) ? m[1].replace(/,/g, '') : m[1].replace(',', '.');
    return { n, unit: m[2] ? (UNIT_MAP[m[2]] ?? m[2]) : null };
  });
  const lastUnit = [...parsed].reverse().find((p) => p?.unit)?.unit ?? null;
  if (!parsed.length || parsed.some((p) => !p) || !lastUnit) {
    return { value: text || null, formatOk: false, changedChars: swapped, notes: ['strength needs a number and unit'] };
  }
  // "80/480 mg" -> the unit-less part takes the last unit given
  return { value: parsed.map((p) => `${p!.n} ${p!.unit ?? lastUnit}`).join(' / '), formatOk: true, changedChars: swapped, notes: [] };
}

function batchNo(raw: string): Cleaned {
  const { text, swapped } = base(raw);
  // Same cleaner the rules engine uses for pack and alert batches, so both layers agree.
  const value = normalizeBatch(text);
  return { value, formatOk: !!value, changedChars: swapped, notes: [] };
}

function expiryDate(raw: string): Cleaned {
  const { text, swapped } = base(raw);
  const value = text.replace(/^(exp(iry|ires|iration)?(\.|\s)*(date)?|use by|use before|best before)\s*[:.]?\s*/i, '').trim();
  const formatOk = !!value && parsePackDate(value) !== null;
  return { value: value || null, formatOk, changedChars: swapped, notes: formatOk ? [] : ["couldn't read the expiry date"] };
}

function plain(raw: string): Cleaned {
  const { text, swapped } = base(raw);
  return { value: text || null, formatOk: true, changedChars: swapped, notes: swapped ? ['replaced look-alike characters'] : [] };
}

const CLEAN: Record<ExtractKey, (raw: string) => Cleaned> = {
  productName: plain,
  strength,
  nafdacRegNo: regNo,
  manufacturer: plain,
  batchNo,
  expiryDate,
  activeIngredient: plain,
  dosageForm: plain,
  marketedBy: plain,
};

export function clean(key: ExtractKey, raw: string | null | undefined): Cleaned {
  if (raw == null || raw.trim() === '') return { value: null, formatOk: true, changedChars: false, notes: [] };
  return CLEAN[key](raw);
}

// --- Does the cleaned value actually appear in the printed text the AI says it read? ---------------
// Printed lines carry more than the value ("Artemether 80 mg + Lumefantrine 480 mg Tablets",
// "MFD 01/2026 EXP 10/2028", "B.No LDS25300 MFD 09/2025"), so each field checks only its own part.
// Every check must still fail on a real disagreement: a changed digit, a misspelling, the MFD read as expiry.

const tokens = (text: string) =>
  base(text)
    .text.toUpperCase()
    .split(/[\s:;,]+/)
    .map((t) => t.replace(/^[.(#]+|[.)]+$/g, ''))
    .filter(Boolean);

/** Joined runs of 1–3 adjacent tokens, so "BP 5203" and "A4 6238" are found too. */
function windows(ts: string[], join: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < ts.length; i++) for (let n = 1; n <= 3 && i + n <= ts.length; n++) out.push(ts.slice(i, i + n).join(join));
  return out;
}

const BATCH_LABEL = new Set(['B.NO', 'BNO', 'B/N', 'BN', 'BATCH', 'LOT', 'NO', 'NUMBER', 'BATCH.NO', 'LOT.NO']);
const EXPIRY_LABEL = /\b(exp(iry)?(\s*date)?|use\s+(by|before)|best\s+before)\b/i;
const NUMERIC_DATE = /\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.]\d{2,4}/g;
const NAMED_DATE = /(?:\d{1,2}\s+)?[A-Za-z]{3,9}[\s\-/.,]*\d{2,4}/g;

const sameMonth = (a: Date, b: Date) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

function datesIn(text: string): { index: number; date: Date }[] {
  const found: { index: number; date: Date }[] = [];
  for (const re of [NUMERIC_DATE, NAMED_DATE]) {
    for (const m of text.matchAll(re)) {
      const date = parsePackDate(m[0]);
      if (date) found.push({ index: m.index ?? 0, date });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

function isRun(needle: number[], hay: number[]): boolean {
  if (!needle.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((n, j) => hay[i + j] === n)) return true;
  return false;
}

export function appearsIn(key: ExtractKey, value: string, printed: string): boolean {
  switch (key) {
    case 'strength':
      return isRun(strengthNumbers(value), strengthNumbers(base(printed).text));
    case 'activeIngredient': {
      const have = new Set(nameTokens(base(printed).text));
      const need = nameTokens(value);
      return need.length > 0 && need.every((t) => have.has(t));
    }
    case 'nafdacRegNo': {
      const text = base(printed).text;
      return normalizeRegNo(text) === value || windows(tokens(text), ' ').some((w) => normalizeRegNo(w) === value);
    }
    case 'batchNo':
      return windows(tokens(printed).filter((t) => !BATCH_LABEL.has(t)), '').includes(value);
    case 'expiryDate': {
      const want = parsePackDate(value);
      if (!want) return false;
      const text = base(printed).text;
      const dates = datesIn(text);
      const label = text.match(EXPIRY_LABEL);
      if (label) {
        const after = dates.find((d) => d.index >= (label.index ?? 0) + label[0].length);
        return !!after && sameMonth(after.date, want);
      }
      // No expiry label: only unambiguous if every date printed is the same month
      return dates.length > 0 && dates.every((d) => sameMonth(d.date, want));
    }
    default:
      // brand, companies, dosage form: whole words, in order; a misspelling fails
      return ` ${normalizeText(printed)} `.includes(` ${normalizeText(value)} `);
  }
}

/** confidence = min(AI's own estimate, code checks). */
export function toExtractedField(
  key: ExtractKey,
  raw: { value: string | null; readText: string | null; confidence: number; photosDisagree?: boolean },
): ExtractedField {
  const c = clean(key, raw.value);
  const notes = [...c.notes];
  let confidence = Math.min(1, Math.max(0, Number.isFinite(raw.confidence) ? raw.confidence : 0));

  if (c.value === null) {
    confidence = raw.readText ? Math.min(confidence, 0.5) : 0;
  } else {
    if (!c.formatOk) confidence = Math.min(confidence, 0.5);
    if (c.changedChars) confidence *= 0.8;
    if (raw.readText) {
      const printed = clean(key, raw.readText).value;
      if (printed !== null && printed !== c.value && !appearsIn(key, c.value, raw.readText)) {
        confidence = Math.min(confidence, 0.6);
        notes.push(`AI's value differs from the printed text "${raw.readText}"`);
      }
    }
  }
  if (raw.photosDisagree) {
    confidence = Math.min(confidence, 0.3);
    notes.push('photos disagree on this field');
  }
  const field: ExtractedField = { value: c.value, confidence: Math.round(confidence * 100) / 100, editedByUser: false };
  if (raw.readText) field.sourceText = raw.readText;
  if (notes.length) field.notes = notes;
  return field;
}

/** Whole AI reading -> the contract the client and /api/check use. Optional fields only when found. */
export function toMedicationInput(raw: RawExtraction): StandardizedMedicationInput {
  const fields: Record<string, ExtractedField> = {};
  for (const key of EXTRACT_KEYS) {
    const f = toExtractedField(key, raw.fields[key]);
    if (REQUIRED.includes(key) || f.value !== null) fields[key] = f;
  }
  return { source: 'photo', fields: fields as StandardizedMedicationInput['fields'], confirmedByUser: false };
}

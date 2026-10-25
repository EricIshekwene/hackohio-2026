// AI reading -> StandardizedMedicationInput fields, with display cleanup and confidence capped by code checks.
// Reuses the backend's normalisers where they exist so both layers clean values the same way.
import type { ExtractedField, StandardizedMedicationInput } from '../../../shared/types';
import { parsePackDate } from '../services/dates';
import { normalizeRegNo, normalizeText } from '../services/normalize';
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
  const formatOk = REG_NO.test(value);
  if (!formatOk) notes.push("doesn't look like a NAFDAC number");
  return { value, formatOk, changedChars, notes };
}

const UNIT_MAP: Record<string, string> = { mg: 'mg', mcg: 'mcg', 'µg': 'mcg', 'μg': 'mcg', ug: 'mcg', g: 'g', ml: 'ml', iu: 'iu', '%': '%' };

function strength(raw: string): Cleaned {
  const { text, swapped } = base(raw);
  const parts = text.toLowerCase().split(/\s*(?:\/|\+|&|;|,(?!\d)|\band\b)\s*/).filter(Boolean);
  const parsed = parts.map((p) => {
    const m = p.match(/^(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|μg|ug|g|ml|iu|%)?$/);
    return m ? { n: m[1].replace(',', '.'), unit: m[2] ? (UNIT_MAP[m[2]] ?? m[2]) : null } : null;
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
  const value = text
    .toUpperCase()
    .replace(/^(B\.?\s*NO|BATCH\s*(NO|NUMBER)?|LOT\s*(NO|NUMBER)?|B\/N|BN)\.?\s*[:#]?\s*/, '')
    .replace(/\s+/g, '');
  return { value: value || null, formatOk: !!value, changedChars: swapped, notes: [] };
}

function expiryDate(raw: string): Cleaned {
  const { text, swapped } = base(raw);
  const value = text.replace(/^(exp(iry)?(\.|\s)*(date)?|use by|use before|best before)\s*[:.]?\s*/i, '').trim();
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

const FREE_TEXT = new Set<ExtractKey>(['productName', 'manufacturer', 'activeIngredient', 'dosageForm', 'marketedBy']);

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
      // Printed text often wraps the value ("Manufactured by: X", "X Tablets"); free text only has to
      // appear as whole words inside it. Codes must match exactly after cleanup. A misspelling still fails.
      const printed = clean(key, raw.readText).value;
      const same = FREE_TEXT.has(key)
        ? ` ${normalizeText(raw.readText)} `.includes(` ${normalizeText(c.value)} `)
        : printed === c.value;
      if (printed !== null && !same) {
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

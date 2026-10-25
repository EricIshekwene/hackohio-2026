// Text normalisation used by every rule. Pure functions, no I/O.

// NAFDAC reg nos look like A4-6238, 04-1234, B4-0123, A11-0123.
// Returns the display form (with hyphen) or null if nothing usable is left.
// Before any O->0 repair: labels stripped, separators unified (Unicode dashes, minus, no-break spaces).
// Cyrillic and Greek capitals that look like Latin letters (typed on a phone keyboard, or pasted). Cyrillic
// Ze looks like a 3.
const LOOKALIKES: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', З: '3',
  Α: 'A', Β: 'B', Ε: 'E', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Χ: 'X',
};
// Zero-width spaces/joiners, LRM/RLM, bidi embeddings and isolates, BOM: invisible, never part of a number.
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

function cleanRegNo(raw: string): string {
  let s = raw.normalize('NFKC').replace(INVISIBLE, '').toUpperCase();
  s = s.replace(/[АВЕКМНОРСТХЗΑΒΕΚΜΝΟΡΤΧ]/g, (c) => LOOKALIKES[c]);
  // Labels only as whole words, so a misread inside the number ("A4-NO12") isn't silently cut out.
  s = s.replace(/\b(NAFDAC|REG(ISTRATION)?(NO)?|NO|NUMBER)\b\.?|[:#]/g, ' ');
  return s.replace(/[‐-―−﹣－_.\/\\\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function normalizeRegNo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = cleanRegNo(raw);
  // "N/A", "none", "NA": every NAFDAC number has digits, so text without any isn't a number.
  if (!/\d/.test(s)) return null;
  // O<->0: a letter O is only ever a misread zero, except where a letter is legal (first char).
  // A leading O followed by a digit is also a zero ("O4-1234" -> "04-1234").
  const chars = s.split('');
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === 'O' && (i > 0 || /\d/.test(chars[i + 1] ?? ''))) chars[i] = '0';
  }
  s = chars.join('');
  // Missing hyphen: "A46238" -> "A4-6238"
  if (!s.includes('-') && /^[A-Z0-9]{2,3}\d{4}$/.test(s)) s = `${s.slice(0, -4)}-${s.slice(-4)}`;
  return s;
}

// True when normalising changed a letter O into a zero. The lookup uses the repaired number, but the
// result must say so: the user confirms the number, we don't silently substitute it.
export function regNoWasCorrected(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const before = cleanRegNo(raw);
  const after = normalizeRegNo(raw);
  return !!after && before.replace(/-/g, '') !== after.replace(/-/g, '');
}

// Key for lookups: hyphen-insensitive.
export function regNoKey(raw: string | null | undefined): string | null {
  const n = normalizeRegNo(raw);
  return n ? n.replace(/-/g, '') : null;
}

export function normalizeBatch(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip a printed label only at the start ("B.No:", "B/N", "Batch No.", "Lot"), never inside the batch:
  // "B.No: BP5203" -> BP5203, but a batch that really is "NO5012" stays NO5012.
  const s = raw
    .toUpperCase()
    .trim()
    .replace(/^(B\.?\s*NO|B\/N|BN|BATCH\s*(NO|NUMBER)?|LOT\s*(NO|NUMBER)?)\b\.?\s*[:#]?\s*/, '')
    .replace(/[:#\s\-_.]/g, '');
  return s || null;
}

export function normalizeText(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const COMPANY_NOISE = new Set([
  'limited', 'ltd', 'plc', 'nigeria', 'nig', 'pharmaceutical', 'pharmaceuticals', 'pharma',
  'industries', 'industry', 'company', 'co', 'inc', 'llc', 'pvt', 'private', 'labs',
  'laboratories', 'laboratory', 'and', 'the', 'of', 'group', 'healthcare', 'international', 'intl',
]);

export function companyTokens(raw: string | null | undefined): string[] {
  return normalizeText(raw).split(' ').filter((t) => t.length > 1 && !COMPANY_NOISE.has(t));
}

const NAME_NOISE = new Set([
  'tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'caps', 'caplet', 'caplets', 'mg', 'ml', 'mcg',
  'syrup', 'suspension', 'injection', 'cream', 'ointment', 'gel', 'lotion', 'drops', 'powder', 'solution',
  'infusion', 'sachet', 'sachets', 'granules', 'oral', 'film', 'coated', 'dispersible', 'forte', 'plus',
  'extra', 'ultra', 'junior', 'adult', 'paediatric', 'pediatric', 'for', 'and', 'with',
  // Pharmacopoeia suffixes printed after ingredient names ("Paracetamol BP"); never in the registry's ingredient.
  'bp', 'usp', 'ep', 'ip', 'nf', 'ph', 'eur',
]);

export function nameTokens(raw: string | null | undefined): string[] {
  return normalizeText(raw).split(' ').filter((t) => t.length > 1 && !NAME_NOISE.has(t) && !/^\d+$/.test(t));
}

// "80/480 mg", "80;480", "80 mg; 480 mg", "80mg/480mg" -> [80, 480]. Grams become mg.
export function strengthNumbers(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const out: number[] = [];
  // "100,000 IU" is one number; "2,5 mg" is a decimal comma.
  const re = /(\d{1,3}(?:,\d{3})+(?!\d)|\d+(?:[.,]\d+)?)\s*(mcg|µg|μg|ug|mg|g|ml|iu|%)?/gi;
  for (const m of raw.matchAll(re)) {
    const num = /^\d{1,3}(,\d{3})+$/.test(m[1]) ? m[1].replace(/,/g, '') : m[1].replace(',', '.');
    let n = parseFloat(num);
    const unit = (m[2] ?? '').toLowerCase();
    if (unit === 'g') n *= 1000;
    if (unit === 'mcg' || unit === 'µg' || unit === 'μg' || unit === 'ug') n /= 1000;
    out.push(n);
  }
  return out;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

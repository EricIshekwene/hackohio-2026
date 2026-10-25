// Text normalisation used by every rule. Pure functions, no I/O.

// NAFDAC reg nos look like A4-6238, 04-1234, B4-0123, A11-0123.
// Returns the display form (with hyphen) or null if nothing usable is left.
export function normalizeRegNo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.toUpperCase();
  // Labels only as whole words, so a misread inside the number ("A4-NO12") isn't silently cut out.
  s = s.replace(/\b(NAFDAC|REG(ISTRATION)?(NO)?|NO|NUMBER)\b\.?|[:#]/g, ' ');
  s = s.replace(/[‐-―_.\/\\ ]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!s) return null;
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

const NAME_NOISE = new Set(['tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'caps', 'mg', 'ml', 'syrup', 'suspension', 'injection']);

export function nameTokens(raw: string | null | undefined): string[] {
  return normalizeText(raw).split(' ').filter((t) => t.length > 1 && !NAME_NOISE.has(t) && !/^\d+$/.test(t));
}

// "80/480 mg", "80;480", "80 mg; 480 mg", "80mg/480mg" -> [80, 480]. Grams become mg.
export function strengthNumbers(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(mcg|µg|mg|g|ml|iu|%)?/gi;
  for (const m of raw.matchAll(re)) {
    let n = parseFloat(m[1]);
    const unit = (m[2] ?? '').toLowerCase();
    if (unit === 'g') n *= 1000;
    if (unit === 'mcg' || unit === 'µg') n /= 1000;
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

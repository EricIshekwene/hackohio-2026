// Pack expiry dates come in many shapes. Month-only dates mean the end of that month.
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function endOfMonth(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 0)); // day 0 of next month
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

// Returns null if the format isn't recognised.
export function parsePackDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/^(exp(iry)?\.?|use before|best before)[:\s]*/, '');
  let m: RegExpMatchArray | null;
  // 2027-03-31 or 2027/03/31
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // 2027-03
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) return endOfMonth(+m[1], +m[2]);
  // 31/03/2027 (day first, as printed in Nigeria)
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return new Date(Date.UTC(fullYear(+m[3]), +m[2] - 1, +m[1]));
  // 03/2027 or 03/27
  if ((m = s.match(/^(\d{1,2})[-/.](\d{2,4})$/))) return endOfMonth(fullYear(+m[2]), +m[1]);
  // MAR 2027, Mar-27, 31 Mar 2027
  if ((m = s.match(/^(?:(\d{1,2})\s+)?([a-z]{3,9})[\s\-/.,]*(\d{2,4})$/))) {
    const mon = MONTHS[m[2].slice(0, 4)] ?? MONTHS[m[2].slice(0, 3)];
    if (!mon) return null;
    const y = fullYear(+m[3]);
    return m[1] ? new Date(Date.UTC(y, mon - 1, +m[1])) : endOfMonth(y, mon);
  }
  return null;
}

export function parseIsoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? parseIsoDate(d) : d;
  if (!date) return String(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

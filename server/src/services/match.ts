// Field comparisons for R3. Each returns true (match), false (mismatch) or null (can't compare).
import {
  companyTokens, nameTokens, normalizeText, similarity, strengthNumbers,
} from './normalize';

function tokenMatch(a: string, b: string): boolean {
  return a === b || (a.length >= 5 && b.length >= 5 && similarity(a, b) >= 0.8);
}

// Brand names: match if the brand's first word agrees (allowing one-letter typos),
// or the whole strings are very close. "Artheget" ~ "Artheget EZ"; "Malacure Forte" != "Artheget EZ".
export function productNameMatches(onPack: string | null, inRegistry: string | null): boolean | null {
  if (!onPack || !inRegistry) return null;
  const a = nameTokens(onPack);
  const b = nameTokens(inRegistry);
  if (!a.length || !b.length) return null;
  if (similarity(normalizeText(onPack), normalizeText(inRegistry)) >= 0.85) return true;
  return tokenMatch(a[0], b[0]) || a.some((t) => t.length >= 5 && b.includes(t));
}

// A fuzzy "match" that only passed on similarity: no brand word is spelled the same. On a medicine pack a
// one-letter brand misspelling ("Artheqet" for "Artheget") is a classic sign of a fake, so callers must not
// treat it as consistent. "Artheget" vs "Artheget EZ" is NOT a near miss (the brand word is identical).
export function productNameNearMiss(onPack: string | null, inRegistry: string | null): boolean {
  if (productNameMatches(onPack, inRegistry) !== true) return false;
  if (normalizeText(onPack) === normalizeText(inRegistry)) return false;
  const a = nameTokens(onPack);
  const b = nameTokens(inRegistry);
  return a[0] !== b[0] && !a.some((t) => t.length >= 5 && b.includes(t));
}

// Same for companies: matched only because a word was close ("Getz" vs "Gelz Pharma"), never identical.
export function manufacturerNearMiss(onPack: string | null, inRegistry: string | null): boolean {
  if (manufacturerMatches(onPack, inRegistry) !== true) return false;
  const a = companyTokens(onPack);
  const b = companyTokens(inRegistry);
  return !a.some((t) => b.includes(t));
}

// Manufacturer: share at least one meaningful word after dropping "Ltd", "Pharma", "Nigeria"...
export function manufacturerMatches(onPack: string | null, inRegistry: string | null): boolean | null {
  if (!onPack || !inRegistry) return null;
  const a = companyTokens(onPack);
  const b = companyTokens(inRegistry);
  if (!a.length || !b.length) return null;
  return a.some((t) => b.some((u) => tokenMatch(t, u)));
}

// Active ingredient: every ingredient named on the pack must appear in the record.
export function ingredientMatches(onPack: string | null, inRegistry: string | null): boolean | null {
  if (!onPack || !inRegistry) return null;
  const a = nameTokens(onPack);
  const b = nameTokens(inRegistry);
  if (!a.length || !b.length) return null;
  return a.every((t) => b.some((u) => tokenMatch(t, u)));
}

// Strength: exact match on the numbers, in order. Units other than g/mg/mcg are ignored.
export function strengthMatches(onPack: string | null, inRegistry: string | null): boolean | null {
  const a = strengthNumbers(onPack);
  const b = strengthNumbers(inRegistry);
  if (!a.length || !b.length) return null;
  return a.length === b.length && a.every((n, i) => Math.abs(n - b[i]) < 1e-9);
}

export function formMatches(onPack: string | null, inRegistry: string | null): boolean | null {
  if (!onPack || !inRegistry) return null;
  const a = normalizeText(onPack).replace(/s\b/g, '');
  const b = normalizeText(inRegistry).replace(/s\b/g, '');
  if (!a || !b) return null;
  return a.includes(b) || b.includes(a);
}

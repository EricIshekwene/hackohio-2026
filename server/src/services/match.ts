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

// The same word, allowing only a plural "s" ("Chemical" / "Chemicals"): not a spelling difference.
function sameWord(a: string, b: string): boolean {
  return a === b || a === `${b}s` || b === `${a}s`;
}

// True when some pack word is only *close* to a registry word: not itself a registry word, but within
// tokenMatch's 1-2 letters of one. Other words matching exactly don't excuse it ("Betadlne Germicide Gargle").
function hasFuzzyOnlyWord(a: string[], b: string[]): boolean {
  return a.some((t) => !b.some((u) => sameWord(t, u)) && b.some((u) => tokenMatch(t, u)));
}

// A fuzzy "match" where a word is misspelled. On a medicine pack a one-letter brand misspelling ("Artheqet"
// for "Artheget", "Betadlne" for "Betadine") is a classic sign of a fake, so callers must not treat it as
// consistent. Not near misses: case/punctuation only, "Artheget" vs "Artheget EZ", "Germicide Gargle" (a word left out).
export function productNameNearMiss(onPack: string | null, inRegistry: string | null): boolean {
  if (productNameMatches(onPack, inRegistry) !== true) return false;
  if (normalizeText(onPack) === normalizeText(inRegistry)) return false;
  return hasFuzzyOnlyWord(nameTokens(onPack), nameTokens(inRegistry));
}

// Same for companies: a word is close but not identical ("Novartls", "Embessy"), even if another word matches.
export function manufacturerNearMiss(onPack: string | null, inRegistry: string | null): boolean {
  if (manufacturerMatches(onPack, inRegistry) !== true) return false;
  return hasFuzzyOnlyWord(companyTokens(onPack), companyTokens(inRegistry));
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

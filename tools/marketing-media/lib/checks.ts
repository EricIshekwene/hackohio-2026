import type { Page } from 'playwright';

// Words that mean a fixture, a bug or a debug state leaked into the frame.
export const LEFTOVERS = [/\blorem\b/i, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull\b/, /\d{4}-\d{2}-\d{2}T\d{2}:/, /<\/?[a-z]+>/];

// Words the product must never say about a pack (truth rule: never "genuine" or "safe").
export const NEVER_SAY = [/\bgenuine\b(?! or safe)/i, /\bauthentic\b(?! ?ity)/i, /\bsafe to (use|take)\b/i];

export function findProblems(text: string): string[] {
  const out: string[] = [];
  for (const re of LEFTOVERS) if (re.test(text)) out.push(`leftover ${re}`);
  for (const re of NEVER_SAY) if (re.test(text)) out.push(`forbidden claim ${re}`);
  return out;
}

export async function assertClean(page: Page) {
  const text = await page.locator('body').innerText();
  const problems = findProblems(text);
  const busy = await page.locator('[aria-busy="true"]').count();
  if (problems.length) throw new Error(`Pre-capture check failed: ${problems.join(', ')}`);
  return { busy };
}

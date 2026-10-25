import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './config.ts';
import { LEGEND, CAVEAT, GREEN_SUMMARY } from '../../../shared/legend.ts';

// Brand values are read from the app's own source, never typed here (R4).
const CSS_PATH = path.join(REPO, 'client/src/index.css');

export function readThemeTokens(css = fs.readFileSync(CSS_PATH, 'utf8')): Record<string, string> {
  const theme = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of theme.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const t = readThemeTokens();
const need = (k: string) => {
  if (!t[k]) throw new Error(`Brand token --${k} not found in ${CSS_PATH}`);
  return t[k];
};

export const BRAND = {
  ink: need('color-ink'),
  ink2: need('color-ink-2'),
  ink3: need('color-ink-3'),
  line: need('color-line'),
  fill: need('color-fill'),
  surface: need('color-surface'),
  stage: need('color-stage'),
  brand: need('color-brand'),
  font: need('font-sans'),
};

export { LEGEND, CAVEAT, GREEN_SUMMARY, CSS_PATH };

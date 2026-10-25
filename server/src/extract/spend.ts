// Tracks real AI spend in data/spend.json so restarts don't reset it.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../services/data';

// USD per million tokens [input, output]. Unknown models are priced as Opus 5.5.
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};

const file = () => process.env.SPEND_FILE ?? path.join(DATA_DIR, 'spend.json');

interface SpendFile {
  totalUsd: number;
  calls: number;
}

let state: SpendFile | null = null;

function load(): SpendFile {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(file(), 'utf8')) as SpendFile;
  } catch {
    state = { totalUsd: 0, calls: 0 };
  }
  return state;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function costOf(model: string, usage: Usage): number {
  const [inRate, outRate] = PRICES[model] ?? PRICES['claude-opus-5-5'];
  const input =
    usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) * 1.25 + (usage.cache_read_input_tokens ?? 0) * 0.1;
  return (input * inRate + usage.output_tokens * outRate) / 1_000_000;
}

/** Records one AI call; returns its cost. */
export function recordSpend(model: string, usage: Usage, label: string): number {
  const cost = costOf(model, usage);
  const s = load();
  s.totalUsd += cost;
  s.calls += 1;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(s, null, 2));
  console.log(`[spend] ${label} ${model}: $${cost.toFixed(4)} (total $${s.totalUsd.toFixed(2)})`);
  return cost;
}

export const totalSpend = () => load().totalUsd;
// A typo in SPEND_LIMIT_USD must not switch the budget guard off (NaN >= x is always false).
export const spendLimit = () => {
  const n = Number(process.env.SPEND_LIMIT_USD ?? 30);
  return Number.isFinite(n) ? n : 30;
};
export const overLimit = () => totalSpend() >= spendLimit();

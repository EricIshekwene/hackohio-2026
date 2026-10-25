import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { frameStep, ripple, typingDelay } from '../lib/motion.ts';
import { BRAND, CSS_PATH, readThemeTokens } from '../lib/brand.ts';
import { mp4Args } from '../lib/encode.ts';
import { findProblems } from '../lib/checks.ts';
import { loadPacks, packInput, standInExtract } from '../lib/content.ts';
import { LEGEND } from '../../../shared/legend.ts';

test('frame steps add up to exactly one second at 30 fps', () => {
  let sum = 0;
  for (let i = 0; i < 30; i++) sum += frameStep(i, 30);
  assert.equal(sum, 1000);
  assert.deepEqual([frameStep(0, 30), frameStep(1, 30), frameStep(2, 30)], [33, 34, 33]);
});

test('typing and ripple timing are deterministic', () => {
  assert.equal(typingDelay('A', 3), typingDelay('A', 3));
  assert.ok(typingDelay(' ', 0) > typingDelay('a', 0) - 45);
  assert.equal(ripple(-1), null);
  assert.equal(ripple(1000), null);
  assert.ok(ripple(0)!.opacity > ripple(300)!.opacity);
});

test('brand colours are the app\'s own tokens, read from client/src/index.css', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  assert.match(css, new RegExp(`--color-brand:\\s*${BRAND.brand}`, 'i'));
  assert.match(css, new RegExp(`--color-ink:\\s*${BRAND.ink}`, 'i'));
  assert.equal(readThemeTokens('@theme {\n  --color-ink: #123456;\n}')['color-ink'], '#123456');
});

test('encode args keep the frame range and pixel format', () => {
  const a = mp4Args({ framesDir: '/f', start: 120, count: 300, width: 1080, crf: 20, out: '/o.mp4' });
  assert.ok(a.includes('-start_number') && a[a.indexOf('-start_number') + 1] === '120');
  assert.equal(a[a.indexOf('-frames:v') + 1], '300');
  assert.ok(a.includes('yuv420p') && a.includes('+faststart'));
});

test('pre-capture check flags leftovers and forbidden claims, not the app\'s own disclaimer', () => {
  assert.deepEqual(findProblems('MedCheck never says a medicine is genuine or safe. Not proof of authenticity.'), []);
  assert.ok(findProblems('This pack is genuine').length > 0);
  assert.ok(findProblems('Batch undefined').length > 0);
});

test('every pack builds a valid confirmed input and a stand-in read that changes no value', () => {
  for (const p of loadPacks()) {
    assert.ok(Object.keys(LEGEND).includes(p.expect), `${p.id}: unknown verdict`);
    const input = packInput(p);
    assert.equal(input.confirmedByUser, true);
    assert.equal(input.fields.nafdacRegNo.value, p.printed.nafdacRegNo);
    const read = standInExtract(p);
    assert.equal(read.confirmedByUser, false);
    for (const [k, v] of Object.entries(p.printed)) assert.equal(read.fields[k as keyof typeof read.fields]?.value, v);
  }
});

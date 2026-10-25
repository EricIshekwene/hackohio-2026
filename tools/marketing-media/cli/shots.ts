import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DESKTOP, OUT, PHONE } from '../lib/config.ts';
import { launch, newSession, Recorder, type Device } from '../lib/recorder.ts';
import { getPack, photoPath, type Pack } from '../lib/content.ts';
import { cameraFile } from '../lib/camera.ts';
import { ensureApp } from '../lib/app.ts';
import { landingReady, openLanding, reviewLowConfidence, showTab, typedCheck } from '../scenes/flows.ts';

// npm run media:shots [-- S01 S08]
// Every still is the real app at a real state; verdict stills come from the real /api/check.

export interface ShotRecord {
  id: string;
  slug: string;
  caption: string;
  device: 'phone' | 'desktop';
  pack?: string;
  verdict?: string;
  png: string;
  webp: string;
  width: number;
  height: number;
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (id: string) => !only.length || only.includes(id);
const PNG = path.join(OUT, 'screenshots/png');
const WEBP = path.join(OUT, 'screenshots/webp');
fs.mkdirSync(PNG, { recursive: true });
fs.mkdirSync(WEBP, { recursive: true });
const records: ShotRecord[] = [];

const phone: Device = { width: PHONE.width, height: PHONE.height, dpr: PHONE.dpr, mobile: true };
const desktop: Device = { width: DESKTOP.width, height: DESKTOP.height, dpr: DESKTOP.dpr, mobile: false };

// One browser session walks a flow; `shoot` saves a still at each state worth showing.
async function session(device: Device, pack: Pack | undefined, walk: (rec: Recorder, shoot: (id: string, slug: string, caption: string) => Promise<void>) => Promise<void>) {
  const camera = cameraFile(pack);
  const browser = await launch(camera);
  const opts = { device, pack, camera, stills: true, readMs: 2600 };
  const { page } = await newSession(browser, opts);
  const rec = new Recorder(page, fs.mkdtempSync(path.join(os.tmpdir(), 'mm-stills-')), opts);
  await rec.installExtractStandIn();
  const kind = device.mobile ? 'phone' : 'desktop';
  const shoot = async (id: string, slug: string, caption: string) => {
    if (!want(id)) return;
    const name = `${id}-${slug}-${kind}`;
    const png = path.join(PNG, `${name}.png`);
    const webp = path.join(WEBP, `${name}.webp`);
    await rec.still(png);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-vf', `scale=${device.width * 2}:-2:flags=lanczos`, '-quality', '86', webp]);
    const verdict = rec.results.at(-1)?.verdict;
    if (pack && verdict && verdict !== pack.expect) throw new Error(`${id}: expected ${pack.expect}, the real backend said ${verdict}`);
    records.push({ id, slug, caption, device: kind, pack: pack?.id, verdict, png: path.relative(OUT, png), webp: path.relative(OUT, webp), width: device.width * device.dpr, height: device.height * device.dpr });
    console.log(`${name}${verdict ? ` (${verdict})` : ''}`);
  };
  try {
    await walk(rec, shoot);
  } finally {
    await browser.close();
  }
  if (rec.errors.length) console.warn('page errors:', rec.errors);
}

await ensureApp();

// Landing, the legend, the typed form and a clean green result.
const green = getPack('artheget-green');
await session(phone, green, async (rec, shoot) => {
  await openLanding(rec);
  await shoot('S01', 'landing', 'Start: scan a pack or type the details');
  await typedCheck(rec, green, { typeOnly: [] });
  await rec.hold(800);
  await shoot('S08', 'green-compare', 'No problems found: every detail matches the NAFDAC record');
  await rec.tap(rec.page.getByRole('button', { name: 'What do the colours mean?' }), 'legend');
  await rec.hold(600);
  await shoot('S16', 'legend', 'The four verdicts, never "genuine" or "safe"');
  await rec.page.keyboard.press('Escape');
  await rec.hold(400);
  await showTab(rec, 'Why', 600);
  await shoot('S09', 'green-why', 'Why: registered, no active alert, details consistent');
  await showTab(rec, 'Checked', 600);
  await shoot('S10', 'green-checked', 'The sources checked, with their dates and limits');
});

// The typed form, filled, and the checking step (shot mid-check).
await session(phone, green, async (rec, shoot) => {
  await openLanding(rec);
  await rec.tap(rec.page.getByRole('button', { name: 'Type the details' }));
  await rec.waitFor(rec.page.getByLabel('Product name'), 'form');
  for (const [label, key] of [['Product name', 'productName'], ['NAFDAC reg. no.', 'nafdacRegNo'], ['Manufacturer', 'manufacturer'], ['Batch no.', 'batchNo'], ['Expiry date', 'expiryDate'], ['Strength', 'strength']] as const)
    await rec.page.getByLabel(label, { exact: true }).fill(green.printed[key] ?? '');
  await rec.tap(rec.page.getByText('These details match the pack'));
  await rec.hold(500);
  await shoot('S06', 'typed-form', 'Type what is on the pack and confirm it matches');
  await rec.tap(rec.page.getByRole('button', { name: 'Check with NAFDAC' }));
  await rec.hold(700);
  await shoot('S07', 'checking', 'Checking the NAFDAC Greenbook snapshot and alerts');
});

// Caught: a cloned registration number, then the NAFDAC report.
const cloned = getPack('cloned-red');
await session(phone, cloned, async (rec, shoot) => {
  await openLanding(rec);
  await typedCheck(rec, cloned, { typeOnly: [] });
  await rec.hold(800);
  await shoot('S11', 'caught-cloned-compare', 'Caught: a real NAFDAC number on the wrong product');
  await showTab(rec, 'Why', 600);
  await shoot('S12', 'caught-cloned-why', 'Why: the number belongs to Artheget EZ by Getz Pharma');
  await rec.tap(rec.page.getByRole('button', { name: 'Report to NAFDAC' }));
  await rec.waitFor(rec.page.getByText('Send email'), 'report');
  await rec.hold(800);
  await shoot('S15', 'report', 'A ready-to-send NAFDAC report the user reviews first');
});

// Caught: a batch on NAFDAC Public Alert 042/2026.
const alert = getPack('alert-042-red');
await session(phone, alert, async (rec, shoot) => {
  await openLanding(rec);
  await typedCheck(rec, alert, { typeOnly: [] });
  await rec.hold(800);
  await shoot('S13', 'caught-alert-compare', 'Caught: this batch is on NAFDAC Alert 042/2026');
  await showTab(rec, 'Why', 600);
  await shoot('S14', 'caught-alert-why', 'Why: NAFDAC seized this batch in Kano, with the alert linked');
});

// The photo path: a real Natrilix SR pack, front photo playing as the camera, back and end flap added from
// the library, two low-confidence rows reviewed, and the flagged result.
const natrilix = getPack('photo-natrilix');
await session(phone, natrilix, async (rec, shoot) => {
  const page = rec.page;
  await openLanding(rec);
  await rec.tap(page.getByRole('button', { name: 'Scan a pack' }));
  const allow = page.getByRole('button', { name: 'Allow camera' });
  if (await allow.isVisible().catch(() => false)) await rec.tap(allow);
  await rec.waitFor(page.getByText(/Photo 1 of up to/), 'camera');
  await rec.hold(1200);
  await shoot('S02', 'camera', 'The camera on a real Natrilix SR pack');
  await rec.tap(page.getByRole('button', { name: 'Take photo' }));
  await rec.waitFor(page.getByRole('button', { name: 'View photo 1' }), 'photo');
  await rec.hold(800);
  await shoot('S03', 'photo-taken', 'First photo taken; up to three, any side of the pack');
  for (const extra of natrilix.photos.slice(1)) {
    const n = natrilix.photos.indexOf(extra) + 1;
    const chooser = page.waitForEvent('filechooser');
    await rec.tap(page.getByRole('button', { name: 'Add from your photos' }));
    await (await chooser).setFiles(photoPath(extra));
    await rec.waitFor(page.getByRole('button', { name: `View photo ${n}` }), `photo ${n}`);
  }
  await rec.hold(800);
  await shoot('S18', 'three-photos', 'Three photos of the pack: front, back, end flap');
  await rec.tap(page.getByRole('button', { name: /Read pack/ }).last());
  await rec.waitFor(page.getByRole('heading', { name: 'Reading the label' }), 'reading');
  await rec.hold(1400);
  await shoot('S04', 'reading', 'The AI only reads the text');
  await rec.waitFor(page.getByText('These details match the pack'), 'confirm', 12000);
  await rec.hold(800);
  await shoot('S19', 'review-unsure', 'Two details the reader was unsure of, waiting for the user to check them');
  await reviewLowConfidence(rec);
  await rec.tap(page.getByText('These details match the pack'));
  await rec.hold(500);
  await shoot('S05', 'confirm', 'Every detail checked by the user before anything is sent');
  await rec.tap(page.getByRole('button', { name: 'Check with NAFDAC' }));
  await rec.waitFor(page.getByRole('tab', { name: /Compare/ }), 'verdict');
  await rec.hold(800);
  await shoot('S20', 'flagged-natrilix-compare', 'Flagged: expired pack, inactive registration, maker differs from the registered holder');
  await showTab(rec, 'Why', 600);
  await shoot('S21', 'flagged-natrilix-why', 'Why: three reasons, each with its NAFDAC source');
});

// Desktop: the same app in a laptop browser.
await session(desktop, cloned, async (rec, shoot) => {
  await rec.goto('/', landingReady(rec.page));
  await shoot('D01', 'landing', 'MedCheck in a laptop browser');
  await typedCheck(rec, cloned, { typeOnly: [] });
  await rec.hold(800);
  await shoot('D02', 'caught-cloned', 'The cloned-number catch on a laptop');
});

const manifest = path.join(OUT, 'screenshots/shots.json');
const prev: ShotRecord[] = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : [];
const merged = [...prev.filter((p) => !records.some((r) => r.id === p.id)), ...records].sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(manifest, JSON.stringify(merged, null, 2));
console.log(`${records.length} stills -> ${PNG}`);

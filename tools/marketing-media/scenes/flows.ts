import type { Page } from 'playwright';
import type { FieldKey } from '../../../shared/types.ts';
import { photoPath, type Pack } from '../lib/content.ts';
import type { Recorder } from '../lib/recorder.ts';

// Storyboard building blocks. Only real accessible names; a missing control fails the render.

const LABELS: Partial<Record<FieldKey, string>> = {
  productName: 'Product name',
  nafdacRegNo: 'NAFDAC reg. no.',
  manufacturer: 'Manufacturer',
  batchNo: 'Batch no.',
  expiryDate: 'Expiry date',
  strength: 'Strength',
};

export const landingReady = (page: Page) => page.getByRole('heading', { name: 'Check a medicine pack against NAFDAC records' });

export async function openLanding(rec: Recorder) {
  await rec.goto('/', landingReady(rec.page));
}

// Landing -> Type the details -> type every field -> tick -> Check -> verdict.
export async function typedCheck(rec: Recorder, pack: Pack, opts: { typeOnly?: FieldKey[] } = {}) {
  const page = rec.page;
  await rec.tap(page.getByRole('button', { name: 'Type the details' }), 'Type the details');
  await rec.waitFor(page.getByLabel('Product name'), 'typed form');
  await rec.hold(500);
  rec.mark('form');
  for (const [key, label] of Object.entries(LABELS) as [FieldKey, string][]) {
    const value = pack.printed[key];
    if (!value) continue;
    const input = page.getByLabel(label, { exact: true });
    if (opts.typeOnly && !opts.typeOnly.includes(key)) {
      await input.fill(value);
      continue;
    }
    await rec.tap(input, label);
    await rec.type(input, value);
    await rec.hold(150);
  }
  await page.locator(':focus').evaluate((el) => (el as HTMLElement).blur()).catch(() => {});
  await rec.hold(500);
  rec.mark('filled');
  await confirmAndCheck(rec);
}

export async function confirmAndCheck(rec: Recorder) {
  const page = rec.page;
  await rec.tap(page.getByText('These details match the pack'), 'attest');
  await rec.hold(450);
  await rec.tap(page.getByRole('button', { name: 'Check with NAFDAC' }), 'Check with NAFDAC');
  rec.mark('checking');
  await rec.waitFor(page.getByRole('tab', { name: /Compare/ }), 'verdict');
  rec.mark('verdict');
}

export async function showTab(rec: Recorder, name: 'Compare' | 'Why' | 'Checked', holdMs = 2200) {
  await rec.tap(rec.page.getByRole('tab', { name: new RegExp(`^${name}`) }), `${name} tab`);
  await rec.hold(holdMs);
}

// Landing -> Scan a pack -> camera (playing the pack's first photo) -> shutter -> any other photos added
// from the library (the real "+" slot) -> Read pack -> review low-confidence rows -> Confirm.
export async function photoCheck(rec: Recorder, pack: Pack) {
  const page = rec.page;
  await rec.tap(page.getByRole('button', { name: 'Scan a pack' }), 'Scan a pack');
  const allow = page.getByRole('button', { name: 'Allow camera' });
  if (await allow.isVisible().catch(() => false)) await rec.tap(allow, 'Allow camera');
  await rec.waitFor(page.getByText(/Photo 1 of up to/), 'live camera');
  await rec.hold(1200);
  rec.mark('camera');
  await rec.tap(page.getByRole('button', { name: 'Take photo' }), 'shutter');
  await rec.waitFor(page.getByRole('button', { name: 'View photo 1' }), 'first photo');
  await rec.hold(700);
  for (const extra of pack.photos.slice(1)) {
    const n = pack.photos.indexOf(extra) + 1;
    const chooser = page.waitForEvent('filechooser');
    await rec.tap(page.getByRole('button', { name: 'Add from your photos' }), 'add photo');
    await (await chooser).setFiles(photoPath(extra));
    await rec.waitFor(page.getByRole('button', { name: `View photo ${n}` }), `photo ${n}`);
    await rec.hold(600);
  }
  rec.mark('snapped');
  await rec.tap(page.getByRole('button', { name: /Read pack/ }).last(), 'Read pack');
  await rec.waitFor(page.getByRole('heading', { name: 'Reading the label' }), 'reading');
  rec.mark('reading');
  await rec.waitFor(page.getByText('These details match the pack'), 'confirm', 12000);
  await rec.hold(1800);
  rec.mark('confirm');
  await reviewLowConfidence(rec);
  await confirmAndCheck(rec);
}

// Rows the reader wasn't sure of must be looked at before the attestation unlocks.
export async function reviewLowConfidence(rec: Recorder) {
  const looks = rec.page.getByRole('button', { name: 'Looks right' });
  while ((await looks.count()) > 0) {
    await rec.tap(looks.first(), 'Looks right');
    await rec.hold(500);
  }
}

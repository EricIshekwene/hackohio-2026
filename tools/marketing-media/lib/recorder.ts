import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Locator, type Page, type Request } from 'playwright';
import type { VerificationResult } from '../../../shared/types.ts';
import { APP_URL, CLOCK_ISO, FPS } from './config.ts';
import { frameStep, ripple, typingDelay, easeInOut } from './motion.ts';
import { assertClean } from './checks.ts';
import { standInExtract, type Pack } from './content.ts';

export interface Device {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
}

export interface SessionOptions {
  device: Device;
  camera?: string; // a .y4m file Chromium plays as the camera
  pack?: Pack; // answers /api/extract with this pack's transcription (stand-in)
  readMs?: number; // virtual time the stand-in "reads" for
  stills?: boolean; // advance time without saving frames; take named stills with rec.still()
}

// In-page helpers: a tap ripple layer, and an animation driver that puts CSS animations and
// transitions on the page's (fake) clock so every frame is deterministic and motion is kept.
const INIT = `(() => {
  const starts = new WeakMap();
  window.__mmSync = () => {
    const now = performance.now();
    for (const a of document.getAnimations()) {
      if (!starts.has(a)) starts.set(a, now - (a.currentTime || 0));
      const t = now - starts.get(a);
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      const end = timing && Number.isFinite(timing.endTime) ? timing.endTime : Infinity;
      if (t >= end) { try { a.finish(); } catch {} continue; }
      a.pause();
      a.currentTime = t;
    }
  };
  // Drive animations from the page's own frames too, so ones that start between captures are tracked from their real start.
  const loop = () => { try { window.__mmSync(); } catch {} requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__mmTap = (x, y, r, o) => {
    let el = document.getElementById('__mm_tap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__mm_tap';
      el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border-radius:9999px;background:#0a0c0a;mix-blend-mode:normal';
      document.documentElement.appendChild(el);
    }
    if (o <= 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = (x - r) + 'px'; el.style.top = (y - r) + 'px';
    el.style.width = el.style.height = (2 * r) + 'px';
    el.style.opacity = String(o);
    el.style.boxShadow = '0 0 0 1.5px rgba(255,255,255,.9)';
  };
})();`;

export async function launch(camera?: string): Promise<Browser> {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  if (camera) args.push(`--use-file-for-fake-video-capture=${camera}`);
  return chromium.launch({ args });
}

export async function newSession(browser: Browser, opts: SessionOptions) {
  const { device } = opts;
  const ctx: BrowserContext = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: device.mobile,
    hasTouch: device.mobile,
    colorScheme: 'light',
    locale: 'en-NG',
    timezoneId: 'Africa/Lagos',
    permissions: ['camera'],
  });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  await page.clock.install({ time: new Date(CLOCK_ISO) });
  return { ctx, page };
}

export interface Marker {
  name: string;
  frame: number;
  timeMs: number;
}

export class Recorder {
  frame = 0;
  timeMs = 0;
  markers: Marker[] = [];
  results: VerificationResult[] = [];
  errors: string[] = [];
  private inflight = new Set<Request>();
  private tapAt: { x: number; y: number; at: number } | null = null;
  private extractWaiters: { due: number; resolve: () => void }[] = [];

  constructor(
    public page: Page,
    public framesDir: string,
    private opts: SessionOptions,
  ) {
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    page.on('pageerror', (e) => this.errors.push(e.message));
    const tracked = (r: Request) => !r.url().includes('/api/extract');
    page.on('request', (r) => tracked(r) && this.inflight.add(r));
    page.on('requestfinished', (r) => this.inflight.delete(r));
    page.on('requestfailed', (r) => this.inflight.delete(r));
    // Keep the verdict the real backend returned, as provenance for every asset.
    page.on('response', async (res) => {
      if (res.url().endsWith('/api/check') && res.ok()) this.results.push(await res.json());
    });
  }

  // Answer /api/extract with the pack's transcription after `readMs` of page time.
  async installExtractStandIn() {
    const pack = this.opts.pack;
    if (!pack) return;
    await this.page.route('**/api/extract', async (route) => {
      const due = this.timeMs + (this.opts.readMs ?? 2600);
      await new Promise<void>((resolve) => this.extractWaiters.push({ due, resolve }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(standInExtract(pack)) });
    });
  }

  private async networkQuiet(maxMs = 8000) {
    const t0 = Date.now();
    while (this.inflight.size && Date.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 15));
  }

  // Load a route with the clock paused and nothing captured, until `ready` is drawn (a hard cut).
  async goto(url: string, ready: Locator) {
    await this.page.goto(new URL(url, APP_URL).toString());
    await this.page.clock.pauseAt(new Date(CLOCK_ISO).getTime() + 500);
    for (let i = 0; i < 200; i++) {
      await this.page.clock.runFor(50);
      await this.networkQuiet();
      if (await ready.isVisible().catch(() => false)) break;
    }
    await this.page.evaluate(() => document.fonts.ready);
    await this.page.clock.runFor(800);
    await this.networkQuiet();
  }

  async captureFrame() {
    const step = frameStep(this.frame, FPS);
    await this.page.clock.runFor(step);
    this.timeMs += step;
    for (const w of this.extractWaiters.filter((w) => w.due <= this.timeMs)) w.resolve();
    this.extractWaiters = this.extractWaiters.filter((w) => w.due > this.timeMs);
    await this.networkQuiet();
    const rip = this.tapAt && !this.opts.stills ? ripple(this.timeMs - this.tapAt.at) : null;
    await this.page.evaluate(
      ([x, y, r, o]) => {
        (window as unknown as { __mmSync: () => void }).__mmSync();
        (window as unknown as { __mmTap: (...a: number[]) => void }).__mmTap(x, y, r, o);
      },
      rip && this.tapAt ? [this.tapAt.x, this.tapAt.y, rip.radius, rip.opacity] : [0, 0, 0, 0],
    );
    // A lazy screen's first paint can be an empty page for a few frames; never capture a route load.
    const blank = await this.page.evaluate(() => (document.body.innerText || '').trim().length < 4);
    if (blank) return;
    if (this.opts.stills) {
      this.frame += 1;
      return;
    }
    await this.page.screenshot({ path: path.join(this.framesDir, `f_${String(this.frame).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    this.frame += 1;
  }

  async hold(ms: number) {
    const end = this.timeMs + ms;
    while (this.timeMs < end) await this.captureFrame();
  }

  mark(name: string) {
    this.markers.push({ name, frame: this.frame, timeMs: this.timeMs });
  }

  // Phones have no cursor: show where the finger lands with a ripple, then tap for real.
  async tap(target: Locator, label = 'target') {
    await target.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      throw new Error(`tap: ${label} not visible`);
    });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`tap: ${label} has no box`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.hold(160);
    this.tapAt = { x, y, at: this.timeMs };
    await this.page.touchscreen.tap(x, y).catch(() => target.click());
    await this.hold(120);
  }

  async click(target: Locator, label = 'target') {
    return this.tap(target, label);
  }

  async type(target: Locator, text: string) {
    await target.focus();
    let i = 0;
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await this.hold(typingDelay(ch, i++));
    }
  }

  async clear(target: Locator) {
    await target.fill('');
  }

  // Capture frames until `target` is visible; fail loudly after `maxMs` of page time.
  async waitFor(target: Locator, label: string, maxMs = 8000) {
    const end = this.timeMs + maxMs;
    while (!(await target.isVisible().catch(() => false))) {
      if (this.timeMs > end) throw new Error(`waitFor: "${label}" never appeared`);
      await this.captureFrame();
    }
  }

  // Smoothly scroll a scroll container so `target` sits in view.
  async scrollTo(container: Locator, target: Locator, ms = 700) {
    const from = await container.evaluate((el) => el.scrollTop);
    const to = await target.evaluate((el, f) => {
      const c = el.closest('[class*="overflow-y-auto"]') as HTMLElement | null;
      if (!c) return f;
      const r = el.getBoundingClientRect();
      const cr = c.getBoundingClientRect();
      return Math.max(0, f + r.top - cr.top - 12);
    }, from);
    const end = this.timeMs + ms;
    const start = this.timeMs;
    while (this.timeMs < end) {
      const t = easeInOut((this.timeMs - start) / ms);
      await container.evaluate((el, y) => (el.scrollTop = y), from + (to - from) * t);
      await this.captureFrame();
    }
  }

  // A full-resolution PNG of the current state, with no tap ripple and nothing loading.
  async still(file: string) {
    await this.page.evaluate(() => {
      (window as unknown as { __mmSync: () => void }).__mmSync();
      (window as unknown as { __mmTap: (...a: number[]) => void }).__mmTap(0, 0, 0, 0);
    });
    const { busy } = await assertClean(this.page);
    await this.page.screenshot({ path: file, type: 'png' });
    return { busy };
  }

  async check() {
    await assertClean(this.page);
  }
}

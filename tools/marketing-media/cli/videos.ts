import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SCENES, type Scene } from '../manifest.ts';
import { FPS, OUT, PHONE } from '../lib/config.ts';
import { launch, newSession, Recorder } from '../lib/recorder.ts';
import { cameraFile } from '../lib/camera.ts';
import { contactSheet, encodeToBudget, mp4Args, poster, probe, webmArgs } from '../lib/encode.ts';
import { ensureApp } from '../lib/app.ts';

// npm run media:videos [-- V01 V03] [--reencode]
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const reencode = args.includes('--reencode');
const DPR = Number(process.env.MEDIA_VIDEO_DPR ?? 3);

async function record(scene: Scene, dir: string) {
  const camera = cameraFile(scene.pack(), dir);
  const browser = await launch(camera);
  const pack = scene.pack();
  const opts = { device: { width: PHONE.width, height: PHONE.height, dpr: DPR, mobile: true }, pack, camera };
  const { page } = await newSession(browser, opts);
  const rec = new Recorder(page, path.join(dir, 'frames'), opts);
  await rec.installExtractStandIn();
  const t0 = Date.now();
  try {
    await scene.run.call(scene, rec);
    await rec.check();
  } finally {
    await browser.close();
  }
  // Truth guard: the verdict on screen is what the real /api/check returned, and it tells the story we claim.
  const result = rec.results.at(-1);
  if (!result) throw new Error(`${scene.id}: no /api/check response was recorded`);
  if (result.verdict !== pack.expect) throw new Error(`${scene.id}: expected ${pack.expect}, the real backend said ${result.verdict}`);
  const report = { id: scene.id, frames: rec.frame, fps: FPS, markers: rec.markers, verdict: result.verdict, result, errors: rec.errors, seconds: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`${scene.id}: ${rec.frame} frames in ${report.seconds.toFixed(0)} s, verdict ${result.verdict}`);
  if (rec.errors.length) console.warn(`${scene.id}: page errors`, rec.errors);
  return report;
}

function encode(scene: Scene, dir: string, report: { frames: number; markers: { name: string; frame: number }[] }) {
  const framesDir = path.join(dir, 'frames');
  const at = (m: string) => {
    if (m === 'start') return 0;
    if (m === 'end') return report.frames;
    const hit = report.markers.find((x) => x.name === m);
    if (!hit) throw new Error(`${scene.id}: no marker "${m}"`);
    return hit.frame;
  };
  const frame = (n: number) => path.join(framesDir, `f_${String(Math.min(n, report.frames - 1)).padStart(5, '0')}.jpg`);
  const base = `${scene.id}-${scene.slug}`;
  const lines: string[] = [];

  // Walkthrough master: every frame, 1080 wide.
  const walk = path.join(dir, `${base}-walk.mp4`);
  execFileSync('ffmpeg', mp4Args({ framesDir, start: 0, count: report.frames, width: 1080, crf: 20, out: walk }));
  poster(frame(at(scene.clips[0].poster)), path.join(dir, `${base}-walk-poster.webp`), 1080);
  contactSheet(walk, path.join(dir, `${base}-walk-contact.jpg`));
  const p = probe(walk);
  lines.push(`walk ${p.width}x${p.height} ${p.duration.toFixed(1)}s ${(p.bytes / 1024).toFixed(0)} KB`);

  for (const c of scene.clips) {
    const start = at(c.from);
    const count = at(c.to) - start;
    const mp4 = path.join(dir, `${base}-${c.name}.mp4`);
    const webm = path.join(dir, `${base}-${c.name}.webm`);
    const m = encodeToBudget((crf) => mp4Args({ framesDir, start, count, width: 1080, crf, out: mp4, fadeMs: 250 }), mp4, c.budget, [20, 23, 26, 29]);
    const w = encodeToBudget((crf) => webmArgs(mp4, crf, webm), webm, c.budget * 0.8, [34, 38, 42]);
    poster(frame(at(c.poster)), path.join(dir, `${base}-${c.name}-poster.webp`), 1080);
    lines.push(`${c.name} ${(count / FPS).toFixed(1)}s mp4 ${(m.bytes / 1024).toFixed(0)} KB ${m.ok ? 'ok' : 'OVER'} · webm ${(w.bytes / 1024).toFixed(0)} KB ${w.ok ? 'ok' : 'OVER'}`);
  }
  console.log(`${scene.id}:\n  ${lines.join('\n  ')}`);
}

await ensureApp();
for (const scene of SCENES.filter((s) => !only.length || only.includes(s.id))) {
  try {
    scene.pack();
  } catch (e) {
    console.warn(`${scene.id}: skipped, ${(e as Error).message}`);
    continue;
  }
  const dir = path.join(OUT, 'videos', `${scene.id}-${scene.slug}`);
  fs.mkdirSync(dir, { recursive: true });
  const report = reencode ? JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')) : await record(scene, dir);
  encode(scene, dir, report);
}

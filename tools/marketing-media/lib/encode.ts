import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FPS } from './config.ts';

export interface Probe {
  width: number;
  height: number;
  duration: number;
  codec: string;
  bytes: number;
}

export function probe(file: string): Probe {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(out);
  return { width: j.streams[0].width, height: j.streams[0].height, codec: j.streams[0].codec_name, duration: Number(j.format.duration), bytes: fs.statSync(file).size };
}

// Frames f_00000.jpg … between two frame numbers -> one video. `width` is the output width (height follows, even).
export function mp4Args(o: { framesDir: string; start: number; count: number; width: number; crf: number; out: string; fadeMs?: number; bg?: string }): string[] {
  const vf = [`scale=${o.width}:-2:flags=lanczos`];
  if (o.fadeMs) {
    const d = o.fadeMs / 1000;
    const dur = o.count / FPS;
    vf.push(`fade=t=in:st=0:d=${d}:color=${o.bg ?? 'white'}`, `fade=t=out:st=${(dur - d).toFixed(3)}:d=${d}:color=${o.bg ?? 'white'}`);
  }
  return ['-y', '-v', 'error', '-framerate', String(FPS), '-start_number', String(o.start), '-i', path.join(o.framesDir, 'f_%05d.jpg'), '-frames:v', String(o.count), '-vf', vf.join(','), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(o.crf), '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', o.out];
}

export function webmArgs(mp4: string, crf: number, out: string): string[] {
  return ['-y', '-v', 'error', '-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an', out];
}

// Step the CRF up until the file fits; keep the last rung and report OVER if nothing fits.
export function encodeToBudget(build: (crf: number) => string[], out: string, budget: number, ladder: number[]): { crf: number; bytes: number; ok: boolean } {
  let last = { crf: ladder[0], bytes: Infinity, ok: false };
  for (const crf of ladder) {
    execFileSync('ffmpeg', build(crf));
    const bytes = fs.statSync(out).size;
    last = { crf, bytes, ok: bytes <= budget };
    if (last.ok) break;
  }
  return last;
}

export function poster(framePath: string, out: string, width: number) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', framePath, '-vf', `scale=${width}:-2:flags=lanczos`, '-quality', '82', out]);
}

export function contactSheet(video: string, out: string) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', 'fps=2,scale=200:-2,tile=8x4', '-frames:v', '1', out]);
}

import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT } from '../lib/config.ts';

// npm run media:publish -- <dir>: copy the finished library (no frames, no camera files) plus the docs to <dir>.
const dest = process.argv[2];
if (!dest) throw new Error('Usage: media:publish <destination folder>');
const skip = (p: string) => /(^|\/)frames(\/|$)/.test(p) || p.endsWith('.y4m') || p.endsWith('-contact.jpg');

let n = 0;
function copy(from: string, to: string) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    const rel = path.relative(OUT, src);
    if (skip(rel)) continue;
    const dst = path.join(to, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copy(src, dst);
    } else {
      fs.copyFileSync(src, dst);
      n++;
    }
  }
}
fs.mkdirSync(dest, { recursive: true });
copy(OUT, dest);
for (const doc of fs.readdirSync(path.join(ROOT, 'docs'))) fs.copyFileSync(path.join(ROOT, 'docs', doc), path.join(dest, doc));
console.log(`${n} files -> ${dest}`);

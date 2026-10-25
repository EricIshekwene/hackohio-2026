import fs from 'node:fs';
import path from 'node:path';
import { OUT } from '../lib/config.ts';
import { SCENES } from '../manifest.ts';
import { probe } from '../lib/encode.ts';
import { loadPacks } from '../lib/content.ts';

// npm run media:gallery -> gallery.html (open it from the media folder) + gallery/manifest.json.
// Relative paths only, so the same page works from the folder and when hosted.

interface Item {
  kind: 'video' | 'shot' | 'image';
  id: string;
  title: string;
  caption: string;
  file: string; // what the card shows
  poster?: string;
  extra: string[]; // other formats of the same asset
  verdict?: string;
  meta: string;
}

const kb = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const exists = (rel: string) => fs.existsSync(path.join(OUT, rel));
const size = (rel: string) => fs.statSync(path.join(OUT, rel)).size;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const items: Item[] = [];

for (const s of SCENES) {
  const dir = `videos/${s.id}-${s.slug}`;
  const reportPath = path.join(OUT, dir, 'report.json');
  if (!fs.existsSync(reportPath)) continue;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const base = `${dir}/${s.id}-${s.slug}`;
  const walk = `${base}-walk.mp4`;
  if (exists(walk)) {
    const p = probe(path.join(OUT, walk));
    items.push({ kind: 'video', id: `${s.id}`, title: s.title, caption: s.story, file: walk, poster: `${base}-walk-poster.webp`, extra: [], verdict: report.verdict, meta: `Walkthrough · ${p.width}×${p.height} · ${p.duration.toFixed(1)} s · ${kb(p.bytes)}` });
  }
  for (const c of s.clips) {
    const mp4 = `${base}-${c.name}.mp4`;
    if (!exists(mp4)) continue;
    const p = probe(path.join(OUT, mp4));
    const webm = `${base}-${c.name}.webm`;
    items.push({ kind: 'video', id: `${s.id}-${c.name}`, title: c.caption, caption: `Loop cut from ${s.id}. Silent, fades in and out at the seam.`, file: mp4, poster: `${base}-${c.name}-poster.webp`, extra: exists(webm) ? [webm] : [], verdict: report.verdict, meta: `Loop · ${p.width}×${p.height} · ${p.duration.toFixed(1)} s · ${kb(p.bytes)}` });
  }
}

const shotsJson = path.join(OUT, 'screenshots/shots.json');
if (fs.existsSync(shotsJson)) {
  for (const s of JSON.parse(fs.readFileSync(shotsJson, 'utf8'))) {
    if (!exists(s.webp)) continue;
    items.push({ kind: 'shot', id: s.id, title: s.caption, caption: s.pack ? `Pack: ${s.pack}` : '', file: s.webp, extra: [s.png], verdict: ['S07', 'S16'].includes(s.id) ? undefined : s.verdict, meta: `${s.device === 'phone' ? 'Phone' : 'Laptop'} · PNG ${s.width}×${s.height} · ${kb(size(s.png))}` });
  }
}

const imagesJson = path.join(OUT, 'images/images.json');
if (fs.existsSync(imagesJson)) {
  for (const i of JSON.parse(fs.readFileSync(imagesJson, 'utf8'))) {
    items.push({ kind: 'image', id: i.id, title: i.slug.replace(/-/g, ' '), caption: i.caption, file: i.web, extra: [i.png], meta: `${i.width}×${i.height}${i.transparent ? ' · transparent PNG' : ''} · ${kb(size(i.png))}` });
  }
}

const packs = loadPacks();
const used = new Set(SCENES.map((s) => s.pack().id));
const photos = packs.filter((p) => used.has(p.id)).flatMap((p) => p.photos.map((ph) => ({ pack: p.title, ...ph })));

const VERDICT: Record<string, string> = { green: 'No problems found', red: 'Caught: do not use', amber: 'Flagged: check before use', unsure: "Couldn't check" };

function card(it: Item) {
  const media =
    it.kind === 'video'
      ? `<video src="${it.file}" poster="${it.poster ?? ''}" muted loop playsinline preload="none" controls></video>`
      : `<a href="${it.extra[0] ?? it.file}" target="_blank" rel="noopener"><img src="${it.file}" alt="${esc(it.title)}" loading="lazy"></a>`;
  const chip = it.verdict ? `<span class="chip v-${it.verdict}">${VERDICT[it.verdict] ?? it.verdict}</span>` : '';
  const files = [it.file, ...it.extra].map((f) => `<code>${f}</code>`).join('');
  return `<article class="card ${it.kind}" data-kind="${it.kind}">
    <div class="media ${it.kind === 'image' ? 'checker' : ''}">${media}</div>
    <div class="body">
      <div class="row"><span class="id">${it.id}</span>${chip}</div>
      <h3>${esc(it.title)}</h3>
      ${it.caption ? `<p>${esc(it.caption)}</p>` : ''}
      <p class="meta">${it.meta}</p>
      <div class="files">${files}</div>
    </div>
  </article>`;
}

const counts = { video: items.filter((i) => i.kind === 'video').length, shot: items.filter((i) => i.kind === 'shot').length, image: items.filter((i) => i.kind === 'image').length };
const section = (kind: Item['kind'], title: string, note: string) =>
  `<section data-section="${kind}"><header class="sec"><h2>${title}</h2><p>${note}</p></header><div class="grid ${kind}">${items.filter((i) => i.kind === kind).map(card).join('\n')}</div></section>`;

const html = `<title>MedCheck Media Library</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>
/* Layout: a contact-sheet of the real app. Phone-shaped cards in a grid, MedCheck's own black-and-white UI with the green accent kept to the brand mark. */
:root {
  --bg: #ffffff; --fill: #f5f5f3; --ink: #0a0c0a; --ink-2: #52574f; --ink-3: #686d65; --line: #e7e8e5; --brand: #0d330e;
  --green-bg: #e8f5e9; --green-fg: #1b5e20; --red-bg: #fdecea; --red-fg: #8e1b1b; --amber-bg: #fef3c7; --amber-fg: #92400e; --check: #ececea;
  --sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0b0d0b; --fill: #151815; --ink: #f2f3f0; --ink-2: #b4b8b0; --ink-3: #8d9289; --line: #262a25; --brand: #7fb882;
  --green-bg: #12301a; --green-fg: #a5d6a7; --red-bg: #3a1514; --red-fg: #f4b4ae; --amber-bg: #3a2a0c; --amber-fg: #fcd68a; --check: #1d201c; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0b0d0b; --fill: #151815; --ink: #f2f3f0; --ink-2: #b4b8b0; --ink-3: #8d9289; --line: #262a25; --brand: #7fb882;
  --green-bg: #12301a; --green-fg: #a5d6a7; --red-bg: #3a1514; --red-fg: #f4b4ae; --amber-bg: #3a2a0c; --amber-fg: #fcd68a; --check: #1d201c; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--bg); color: var(--ink); font: 15px/22px var(--sans); -webkit-font-smoothing: antialiased; margin: 0;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px }
.wrap { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 40px }
.top { display: flex; flex-direction: column; gap: 12px; max-width: 760px }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px }
.brand i { width: 22px; height: 22px; border-radius: 6px; background: var(--brand); display: inline-block }
h1 { font-size: 32px; line-height: 38px; letter-spacing: -0.025em; margin: 0; font-weight: 600; text-wrap: balance }
.lede { color: var(--ink-2); margin: 0; text-wrap: pretty }
.facts { display: flex; flex-wrap: wrap; gap: 8px 20px; color: var(--ink-3); font-size: 13px; font-variant-numeric: tabular-nums }
.facts b { color: var(--ink); font-weight: 600 }
.filters { display: flex; flex-wrap: wrap; gap: 8px; position: sticky; top: env(safe-area-inset-top, 0px); background: var(--bg); padding-block: 10px; z-index: 5; border-bottom: 1px solid var(--line) }
.filters button { font: 500 13px/18px var(--sans); color: var(--ink-2); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; cursor: pointer }
.filters button[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink) }
.filters button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px }
section { display: flex; flex-direction: column; gap: 16px }
.sec h2 { font-size: 20px; line-height: 26px; letter-spacing: -0.015em; margin: 0; font-weight: 600 }
.sec p { margin: 4px 0 0; color: var(--ink-3); font-size: 13px }
.grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) }
.grid.image { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) }
.card { display: flex; flex-direction: column; gap: 10px; min-width: 0 }
.media { background: var(--fill); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; display: grid; place-items: center }
.media img, .media video { display: block; width: 100%; height: auto; max-width: 100% }
.checker { background-color: var(--fill); background-image: linear-gradient(45deg, var(--check) 25%, transparent 25%, transparent 75%, var(--check) 75%), linear-gradient(45deg, var(--check) 25%, transparent 25%, transparent 75%, var(--check) 75%); background-size: 16px 16px; background-position: 0 0, 8px 8px }
.body { display: flex; flex-direction: column; gap: 4px; min-width: 0 }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap }
.id { font: 500 12px/16px var(--mono); color: var(--ink-3); letter-spacing: 0.02em }
.chip { font-size: 12px; line-height: 16px; font-weight: 500; padding: 2px 8px; border-radius: 999px }
.v-green { background: var(--green-bg); color: var(--green-fg) }
.v-red { background: var(--red-bg); color: var(--red-fg) }
.v-amber { background: var(--amber-bg); color: var(--amber-fg) }
h3 { font-size: 15px; line-height: 20px; margin: 0; font-weight: 600; text-wrap: balance }
.body p { margin: 0; color: var(--ink-2); font-size: 13px; line-height: 18px }
.body p.meta { color: var(--ink-3); font-variant-numeric: tabular-nums }
.files { display: flex; flex-direction: column; gap: 2px; min-width: 0 }
.files code { font: 11px/15px var(--mono); color: var(--ink-3); overflow-wrap: anywhere }
.notes { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) }
.note { background: var(--fill); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 6px; min-width: 0 }
.note h3 { font-size: 14px }
.note p, .note li { color: var(--ink-2); font-size: 13px; line-height: 19px; margin: 0 }
.note ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important } }
</style>
<div class="wrap">
  <header class="top">
    <div class="brand"><i aria-hidden="true"></i>MedCheck</div>
    <h1>Media library for the slideshow and demo video</h1>
    <p class="lede">Every frame here is the real MedCheck app talking to the real backend and its NAFDAC Greenbook snapshot. Each verdict is what <code>/api/check</code> returned for that pack; nothing was edited. Hover or tap a video to play it.</p>
    <div class="facts"><span><b>${counts.video}</b> videos</span><span><b>${counts.shot}</b> screenshots</span><span><b>${counts.image}</b> composites</span><span>Recorded with the clock pinned to <b>25 Oct 2026</b></span><span>Registry snapshot <b>25 Oct 2026</b> · Last alert <b>19 Aug 2026</b></span></div>
  </header>
  <nav class="filters" aria-label="Filter assets">
    <button type="button" data-f="all" aria-pressed="true">All</button>
    <button type="button" data-f="video" aria-pressed="false">Videos</button>
    <button type="button" data-f="shot" aria-pressed="false">Screenshots</button>
    <button type="button" data-f="image" aria-pressed="false">Composites</button>
  </nav>
  ${section('video', 'Videos', 'Phone recordings at 1080 wide, 30 fps, silent. Walkthroughs are the whole flow; loops are short cuts for slides.')}
  ${section('shot', 'Screenshots', 'Phone at 390×844 (PNG at 3×) and laptop at 1440×900 (PNG at 2×). Click one for the full-size PNG.')}
  ${section('image', 'Composites', 'Built from the screenshots above. No text baked in: the empty side is for your slide title.')}
  <section data-section="notes"><header class="sec"><h2>Before you use these</h2></header>
    <div class="notes">
      <div class="note"><h3>Keep the caveat visible</h3><p>Every result says "Not proof of authenticity". Don't crop it out, and don't describe a green result as "genuine" or "safe".</p></div>
      <div class="note"><h3>Photo reading in these clips</h3><p>The build machine has no AI key, so the "Reading the label" step answers with a person's transcription of the pack in the exact shape the AI returns. The check and the verdict after it are fully real.</p></div>
      <div class="note"><h3>The catches</h3><ul><li><b>Cloned number</b>: a demo pack (Malacure Forte) carrying Artheget EZ's real NAFDAC number A4-6238.</li><li><b>Alert 042/2026</b>: every detail comes from NAFDAC's real public alert of 19 Aug 2026.</li><li><b>Natrilix SR</b>: a real pack from Eric's three photos. The amber result (expired 08/2025, registration Inactive, maker differs) is exactly what the backend returned.</li></ul></div>
      ${photos.length ? `<div class="note"><h3>Pack photos and licences</h3><ul>${photos.map((p) => `<li>${esc(p.title)}: ${esc(p.author)}${p.sourceUrl ? ` (<a href="${p.sourceUrl}" target="_blank" rel="noopener">source</a>)` : ''}</li>`).join('')}</ul></div>` : `<div class="note"><h3>Real pack photos</h3><p>Not added yet: the photo-path video and screenshots appear here once real, licensed pack photos are in <code>content/photos/</code>.</p></div>`}
    </div>
  </section>
</div>
<script>
const btns = document.querySelectorAll('.filters button');
btns.forEach((b) => b.addEventListener('click', () => {
  btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  document.querySelectorAll('section[data-section]').forEach((s) => {
    const k = s.dataset.section;
    s.hidden = !(b.dataset.f === 'all' || k === b.dataset.f || k === 'notes');
  });
}));
const canHover = matchMedia('(hover: hover)').matches;
document.querySelectorAll('video').forEach((v) => {
  if (canHover) { v.addEventListener('mouseenter', () => v.play().catch(() => {})); v.addEventListener('mouseleave', () => v.pause()); }
});
</script>
`;

fs.mkdirSync(path.join(OUT, 'gallery'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'gallery/manifest.json'), JSON.stringify(items, null, 2));
// The hosted page gets its document skeleton from the host; the local copy carries its own.
fs.writeFileSync(path.join(OUT, 'gallery-hosted.html'), html);
fs.writeFileSync(path.join(OUT, 'gallery.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`);
console.log(`gallery: ${items.length} assets -> ${path.join(OUT, 'gallery.html')}`);

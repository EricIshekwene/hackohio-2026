import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { OUT } from '../lib/config.ts';
import { BRAND } from '../lib/brand.ts';

// npm run media:images — composites built from the real screenshots (run media:shots first).
// Templates are HTML rendered by Playwright, so they re-render in seconds. No copy is baked in (R10):
// the left side of the cover and share cards is left empty for the slide title.

const SHOTS = path.join(OUT, 'screenshots/png');
const IMG = path.join(OUT, 'images');
fs.mkdirSync(IMG, { recursive: true });

const shot = (id: string) => {
  const f = fs.readdirSync(SHOTS).find((n) => n.startsWith(`${id}-`) && n.endsWith('-phone.png'));
  if (!f) throw new Error(`Screenshot ${id} missing: run media:shots first`);
  return 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64');
};

// A plain CSS phone: the real screenshot inside a thin black bezel. Width in px; 390x844 aspect.
function phone(src: string, w: number, style = '') {
  const h = Math.round((w * 844) / 390);
  const bez = Math.round(w * 0.035);
  const r = Math.round(w * 0.14);
  return `<div style="position:absolute;width:${w + 2 * bez}px;height:${h + 2 * bez}px;border-radius:${r + bez}px;background:#0b0c0b;padding:${bez}px;box-shadow:0 40px 80px -20px rgba(10,12,10,.35),0 0 0 1px rgba(255,255,255,.06) inset;${style}">
    <img src="${src}" style="display:block;width:${w}px;height:${h}px;border-radius:${r}px;object-fit:cover"/>
  </div>`;
}

const page = (w: number, h: number, bg: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg}}*{box-sizing:border-box}</style></head><body><div style="position:relative;width:${w}px;height:${h}px;overflow:hidden">${body}</div></body></html>`;

interface ImageSpec {
  id: string;
  slug: string;
  caption: string;
  w: number;
  h: number;
  transparent?: boolean;
  html: () => string;
}

const hasPhoto = fs.existsSync(SHOTS) && fs.readdirSync(SHOTS).some((n) => n.startsWith('S17-'));
const greenHero = () => shot(hasPhoto ? 'S17' : 'S08');

const SPECS: ImageSpec[] = [
  {
    id: 'I01',
    slug: 'cover-light',
    caption: 'Slide cover 16:9: green result in front, the two catches behind. Left half empty for the title.',
    w: 1920,
    h: 1080,
    html: () =>
      page(1920, 1080, BRAND.fill, `
        ${phone(shot('S11'), 340, `left:1010px;top:250px;transform:rotate(-6deg);opacity:.98`)}
        ${phone(shot('S13'), 340, `left:1480px;top:260px;transform:rotate(6deg);opacity:.98`)}
        ${phone(greenHero(), 380, `left:1225px;top:150px;z-index:2`)}`),
  },
  {
    id: 'I02',
    slug: 'cover-dark',
    caption: 'Slide cover 16:9 on the app’s ink colour, for dark slides.',
    w: 1920,
    h: 1080,
    html: () =>
      page(1920, 1080, BRAND.ink, `
        ${phone(shot('S11'), 340, `left:1010px;top:250px;transform:rotate(-6deg)`)}
        ${phone(shot('S13'), 340, `left:1480px;top:260px;transform:rotate(6deg)`)}
        ${phone(greenHero(), 380, `left:1225px;top:150px;z-index:2`)}`),
  },
  {
    id: 'I03',
    slug: 'three-phones',
    caption: 'Transparent composite: landing, confirm/typed form, green result. Drop on any slide.',
    w: 2400,
    h: 1500,
    transparent: true,
    html: () =>
      page(2400, 1500, 'transparent', `
        ${phone(shot('S01'), 520, `left:250px;top:180px`)}
        ${phone(shot(hasPhoto ? 'S05' : 'S06'), 520, `left:930px;top:120px`)}
        ${phone(greenHero(), 520, `left:1610px;top:180px`)}`),
  },
  {
    id: 'I04',
    slug: 'catches-phones',
    caption: 'Transparent composite: the two catches (cloned number, NAFDAC alert) side by side.',
    w: 2400,
    h: 1500,
    transparent: true,
    html: () =>
      page(2400, 1500, 'transparent', `
        ${phone(shot('S11'), 540, `left:560px;top:120px`)}
        ${phone(shot('S13'), 540, `left:1260px;top:120px`)}`),
  },
  {
    id: 'I05',
    slug: 'og-card',
    caption: 'Share card 1200×630, copy area on the left.',
    w: 1200,
    h: 630,
    html: () => page(1200, 630, BRAND.fill, `${phone(greenHero(), 300, `left:760px;top:70px`)}`),
  },
  ...(['S01', 'S08', 'S11', 'S13', 'S15', ...(hasPhoto ? ['S02', 'S05', 'S17'] : ['S06'])] as const).map(
    (id): ImageSpec => ({
      id: `I1${id.slice(1)}`,
      slug: `phone-frame-${id.toLowerCase()}`,
      caption: `Single phone frame of ${id}, transparent background.`,
      w: 1200,
      h: 2400,
      transparent: true,
      html: () => page(1200, 2400, 'transparent', phone(shot(id), 960, `left:84px;top:110px`)),
    }),
  ),
];

const browser = await chromium.launch();
const out: { id: string; slug: string; caption: string; png: string; web: string; width: number; height: number; transparent: boolean }[] = [];
for (const s of SPECS) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(s.html(), { waitUntil: 'load' });
  const png = path.join(IMG, `${s.id}-${s.slug}.png`);
  await p.screenshot({ path: png, omitBackground: !!s.transparent });
  await ctx.close();
  const web = path.join(IMG, `${s.id}-${s.slug}.webp`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-quality', '86', web]);
  out.push({ id: s.id, slug: s.slug, caption: s.caption, png: path.relative(OUT, png), web: path.relative(OUT, web), width: s.w, height: s.h, transparent: !!s.transparent });
  console.log(`${s.id}-${s.slug}`);
}
await browser.close();
fs.writeFileSync(path.join(IMG, 'images.json'), JSON.stringify(out, null, 2));

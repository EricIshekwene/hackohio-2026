// Pulls the NAFDAC recalls & alerts RSS into data/raw/alerts-candidates.json for a HUMAN to check.
// Nothing here goes live: copy each checked row into data/alerts.json by hand with "humanChecked": true.
// (Optional: have Claude turn each item's HTML table into the alerts.json shape first; a person still checks every row.)
//   npm run fetch:alerts            # first page
//   npm run fetch:alerts -- 3       # first 3 pages
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../src/services/data';

const FEED = 'https://nafdac.gov.ng/category/recalls-and-alerts/feed/';

function tag(item: string, name: string): string {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return (m?.[1] ?? '').replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
}

function tableText(html: string): string[][] {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((tr) =>
    [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ').trim()),
  );
}

async function main() {
  const pages = Number(process.argv[2] ?? 1);
  const items: unknown[] = [];
  for (let p = 1; p <= pages; p++) {
    const res = await fetch(p === 1 ? FEED : `${FEED}?paged=${p}`, { headers: { 'User-Agent': 'MedCheck-HackOHIO-2026' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} on page ${p}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const it = m[1];
      const title = tag(it, 'title');
      items.push({
        alertNo: title.match(/(\d{3}\/\d{4})/)?.[1] ?? null,
        title,
        date: new Date(tag(it, 'pubDate')).toISOString().slice(0, 10),
        url: tag(it, 'link'),
        table: tableText(tag(it, 'content:encoded')),
      });
    }
    if (p < pages) await new Promise((r) => setTimeout(r, 1500));
  }
  mkdirSync(path.join(DATA_DIR, 'raw'), { recursive: true });
  writeFileSync(path.join(DATA_DIR, 'raw', 'alerts-candidates.json'), JSON.stringify(items, null, 2));
  console.log(`wrote ${items.length} candidate alerts to data/raw/alerts-candidates.json. A person must check each before it goes into data/alerts.json.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

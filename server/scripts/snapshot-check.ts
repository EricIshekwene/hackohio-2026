// Sanity checks before a Greenbook snapshot may replace data/registry.json. Pure, so it can be tested
// without touching Greenbook. A partial scrape (timeout, error page, changed API) must never ship.
export interface SnapshotStats {
  recordsTotal: unknown; // what Greenbook says it has
  rowsFetched: number;
  products: number; // rows that mapped to a record with a reg no.
  previousTotal: number | null; // products in the registry.json being replaced, if any
}

export function snapshotProblems(s: SnapshotStats): string[] {
  const out: string[] = [];
  const total = typeof s.recordsTotal === 'number' && Number.isFinite(s.recordsTotal) ? s.recordsTotal : null;
  if (total === null || total <= 0) out.push(`recordsTotal is ${JSON.stringify(s.recordsTotal)}, not a positive number`);
  else if (s.rowsFetched < total * 0.98) out.push(`fetched ${s.rowsFetched} of ${total} rows`);
  if (s.products < s.rowsFetched * 0.95) out.push(`only ${s.products} of ${s.rowsFetched} rows have a reg no. (field mapping changed?)`);
  if (s.previousTotal && s.products < s.previousTotal * 0.9) out.push(`${s.products} products, down from ${s.previousTotal} in the current snapshot`);
  return out;
}

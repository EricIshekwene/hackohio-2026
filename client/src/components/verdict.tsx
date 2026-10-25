import type { CSSProperties, ReactNode } from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import type { AlertMatch, ComparisonRow, Finding, LegendEntry, Verdict, VerificationResult } from '@shared/types';
import { LEGEND, LEGEND_LIST } from '@shared/legend';
import { formatDate } from '@/lib/format';

// Never colour alone: every tier also has a glyph and its label.
const GLYPH: Record<Verdict, string> = { red: '✕', amber: '!', unsure: '?', green: '✓' };

const vars = (l: LegendEntry) =>
  ({ '--v': l.color, '--v-bg': l.background, '--v-tx': l.text }) as CSSProperties;

export function VerdictIcon({ legend, size = 28 }: { legend: LegendEntry; size?: number }) {
  // White text on the amber solid fails contrast, so amber's glyph uses its dark text colour.
  const fg = legend.verdict === 'amber' ? legend.text : '#FFFFFF';
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center rounded-full font-extrabold"
      style={{ width: size, height: size, background: legend.color, color: fg, fontSize: size * 0.5 }}
    >
      {GLYPH[legend.verdict]}
    </span>
  );
}

export function VerdictCard({ result }: { result: VerificationResult }) {
  const l = result.legend;
  return (
    <section
      className="grid gap-2.5 rounded-verdict border-2 p-5"
      style={{ ...vars(l), background: 'var(--v-bg)', borderColor: 'var(--v)', color: 'var(--v-tx)' }}
      aria-labelledby="verdict-headline"
    >
      <div className="flex items-center gap-2.5">
        <VerdictIcon legend={l} size={32} />
        <span className="text-[13px] font-bold uppercase tracking-[0.08em]">{l.label}</span>
      </div>
      <h1 id="verdict-headline" tabIndex={-1} className="text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em] outline-none">
        {result.headline}
      </h1>
      <p className="text-[16px] font-medium">{result.summary}</p>
      <p className="text-[13px] font-semibold opacity-90">{result.caveat}</p>
    </section>
  );
}

function RowMark({ row }: { row: ComparisonRow }) {
  if (row.match === true)
    return <span className="font-extrabold" style={{ color: LEGEND.green.color }} aria-label="Matches">✓</span>;
  if (row.match === false)
    return <span className="font-extrabold" aria-label="Does not match">✕</span>;
  return <span className="font-extrabold text-muted" aria-label="Couldn't compare">–</span>;
}

// The hero of the video: what's on the pack next to what NAFDAC registered.
export function ComparisonTable({ rows, compact = false }: { rows: ComparisonRow[]; compact?: boolean }) {
  const red = LEGEND.red;
  const pad = compact ? 'px-2.5 py-2' : 'px-3 py-3';
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <table className={`w-full table-fixed border-collapse text-left ${compact ? 'text-[13px]' : 'text-[14.5px]'}`}>
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[35%]" />
          <col className="w-[35%]" />
        </colgroup>
        <thead>
          <tr className="bg-mist text-[11px] uppercase tracking-[0.06em] text-muted">
            <th scope="col" className={`${pad} font-bold`}>Field</th>
            <th scope="col" className={`${pad} font-bold`}>On the pack</th>
            <th scope="col" className={`${pad} font-bold`}>NAFDAC record</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const bad = row.match === false;
            const na = row.match === null;
            const registry =
              row.inRegistry ?? (bad ? 'Not in NAFDAC registry' : na ? "Couldn't compare" : '—');
            return (
              <tr
                key={row.field}
                className="border-t border-line align-top"
                style={bad ? { background: red.background, color: red.text } : undefined}
              >
                <th scope="row" className={`${pad} font-semibold ${bad ? '' : 'text-muted'}`}>
                  <span className="flex items-start gap-1.5">
                    <RowMark row={row} />
                    <span className="min-w-0 hyphens-auto [overflow-wrap:anywhere]">{row.label}</span>
                  </span>
                </th>
                <td className={`${pad} [overflow-wrap:anywhere] ${bad ? 'font-bold' : 'font-medium'} ${row.onPack ? '' : 'italic text-muted'}`}>
                  {row.onPack ?? 'Not on pack'}
                </td>
                <td className={`${pad} [overflow-wrap:anywhere] ${bad ? 'font-bold' : 'font-medium'} ${row.inRegistry ? '' : 'italic'} ${na ? 'text-muted' : ''}`}>
                  {registry}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SourceLine({ source }: { source: Finding['source'] }) {
  const name = source.url ? (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-moss underline underline-offset-2">
      {source.name}
    </a>
  ) : (
    <span className="font-semibold">{source.name}</span>
  );
  return (
    <p className="text-[13px] text-muted">
      Source: {name}
      {source.date && <> · {formatDate(source.date)}</>}
    </p>
  );
}

export function ReasonCard({ finding }: { finding: Finding }) {
  const l = LEGEND[finding.verdict];
  return (
    <article className="grid gap-3 rounded-card border border-line border-l-[5px] bg-white p-4" style={{ borderLeftColor: l.color }}>
      <div className="flex items-start gap-2.5">
        <VerdictIcon legend={l} size={24} />
        <div className="grid gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: l.text }}>
            {l.label} · {finding.rule}
          </span>
          <h3 className="text-[18px] font-extrabold leading-tight tracking-[-0.02em]">{finding.title}</h3>
        </div>
      </div>
      <p className="text-[15px]">{finding.message}</p>
      {finding.evidence.length > 0 && <ComparisonTable rows={finding.evidence} compact />}
      <SourceLine source={finding.source} />
      <p className="rounded-lg px-3 py-2 text-[14px] font-semibold" style={{ background: l.background, color: l.text }}>
        {finding.nextStep}
      </p>
    </article>
  );
}

export function AlertCard({ alert }: { alert: AlertMatch }) {
  const l = LEGEND.red;
  const on = alert.matchedOn
    .map((k) => ({ batchNo: 'batch number', nafdacRegNo: 'reg. number', productName: 'product name' })[k])
    .join(' and ');
  return (
    <article className="grid gap-1.5 rounded-card border p-4" style={{ background: l.background, borderColor: l.color, color: l.text }}>
      <div className="flex items-center gap-2">
        <span className="rounded-md px-2 py-0.5 font-mono text-[13px] font-bold text-white" style={{ background: l.color }}>
          Alert {alert.alertNo}
        </span>
        <span className="tabular text-[13px] font-semibold">{formatDate(alert.date)}</span>
      </div>
      <p className="text-[15px] font-semibold leading-snug">{alert.title}</p>
      {on && <p className="text-[13px]">Matched on {on}.</p>}
      <a href={alert.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold underline underline-offset-2">
        Read the NAFDAC alert ↗
      </a>
    </article>
  );
}

export function MiniLegend({ current }: { current: Verdict }) {
  return (
    <div className="grid gap-2">
      <ul className="flex flex-wrap gap-1.5" aria-label="What the colours mean">
        {LEGEND_LIST.map((l) => (
          <li
            key={l.verdict}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${l.verdict === current ? 'font-bold' : 'text-muted'}`}
            style={l.verdict === current ? { borderColor: l.color, background: l.background, color: l.text } : { borderColor: 'var(--color-line)' }}
            title={l.meaning}
          >
            <VerdictIcon legend={l} size={14} />
            {l.label}
          </li>
        ))}
      </ul>
      <Collapsible.Root>
        <Collapsible.Trigger className="text-[13px] font-semibold text-moss underline underline-offset-2">
          What do the colours mean?
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <dl className="mt-2 grid gap-2">
            {LEGEND_LIST.map((l) => (
              <div key={l.verdict} className="flex gap-2 text-[13px]">
                <VerdictIcon legend={l} size={18} />
                <div>
                  <dt className="font-bold">{l.label}</dt>
                  <dd className="text-muted">{l.meaning}</dd>
                </div>
              </div>
            ))}
          </dl>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}

export function Disclosure({ title, count, defaultOpen = false, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="rounded-card border border-line bg-white">
      <Collapsible.Trigger className="group flex min-h-12 w-full items-center justify-between px-4 text-left text-[15px] font-bold">
        <span>
          {title}
          {count !== undefined && <span className="ml-1.5 font-semibold text-muted">({count})</span>}
        </span>
        <span aria-hidden="true" className="text-muted transition-transform group-data-[panel-open]:rotate-180">⌄</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-4 pb-4">{children}</Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function DataFooter({ result }: { result: VerificationResult }) {
  return (
    <footer className="grid gap-1 border-t border-line pt-3 text-[12.5px] text-muted">
      <p className="tabular">
        Registry snapshot: {formatDate(result.dataAsOf.registrySnapshot)} · Last NAFDAC alert: {formatDate(result.dataAsOf.lastAlert)}
      </p>
      <p className="font-semibold">{result.caveat}</p>
    </footer>
  );
}

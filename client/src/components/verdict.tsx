import type { CSSProperties } from 'react';
import { Check, ExternalLink, Info, Minus, X } from 'lucide-react';
import type { AlertMatch, ComparisonRow, Finding, LegendEntry, Verdict } from '@shared/types';
import { LEGEND_LIST } from '@shared/legend';
import { formatDate } from '@/lib/format';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Never colour alone: every tier also has a glyph and its label.
const GLYPH: Record<Verdict, string> = { red: '✕', amber: '!', unsure: '?', green: '✓' };

export const legendVars = (l: LegendEntry) => ({ '--v': l.color, '--v-bg': l.background, '--v-tx': l.text }) as CSSProperties;

export function VerdictIcon({ legend, size = 24 }: { legend: LegendEntry; size?: number }) {
  // White on the amber solid fails contrast, so amber's glyph uses its dark text colour.
  const fg = legend.verdict === 'amber' ? legend.text : '#FFFFFF';
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold leading-none"
      style={{ width: size, height: size, background: legend.color, color: fg, fontSize: size * 0.52 }}
    >
      {GLYPH[legend.verdict]}
    </span>
  );
}

// The four tiers and what "Not proof of authenticity" means, behind one info button.
export function LegendPopover({ caveat, className }: { caveat: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger aria-label="What do the colours mean?" className={cn('grid size-11 shrink-0 place-items-center rounded-full text-current opacity-70 hover:opacity-100', className)}>
        <Info className="size-[18px]" strokeWidth={1.75} />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle className="text-body font-semibold">What the colours mean</PopoverTitle>
        <ul className="mt-3 flex flex-col gap-3">
          {LEGEND_LIST.map((l) => (
            <li key={l.verdict} className="flex gap-2.5">
              <VerdictIcon legend={l} size={20} />
              <span className="flex flex-col">
                <span className="text-foot font-medium">{l.label}</span>
                <span className="text-foot text-ink-2">{l.meaning}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-foot text-ink-2">
          <span className="font-medium text-ink">{caveat}.</span> We checked NAFDAC's records. We can't test what's inside the pack.
        </p>
      </PopoverContent>
    </Popover>
  );
}

// The hero: what's on the pack next to what NAFDAC registered. Shown once, never repeated.
// differ/alerts come from the whole result (a mismatch can sit in a finding's evidence, not just these rows).
export function ComparisonTable({ rows, legendRed, sourceLabel = 'NAFDAC record', differ: differIn, alerts = 0 }: { rows: ComparisonRow[]; legendRed: LegendEntry; sourceLabel?: string; differ?: number; alerts?: number }) {
  const differ = differIn ?? rows.filter((r) => r.match === false).length;
  return (
    <div className="shrink-0 overflow-hidden rounded-lg border border-line" style={legendVars(legendRed)}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Your pack compared with the {sourceLabel}. {differ === 0 ? 'No details differ' : `${differ} ${differ === 1 ? 'detail differs' : 'details differ'}`}.
          {alerts > 0 && ` The pack matches ${alerts === 1 ? 'a NAFDAC public alert' : `${alerts} NAFDAC public alerts`}.`}
        </caption>
        <thead>
          <tr className="text-cap text-ink-3">
            <th scope="col" className="py-2 pr-2 pl-3 font-medium">Field</th>
            <th scope="col" className="px-2 py-2 font-medium">On the pack</th>
            <th scope="col" className="px-2 py-2 pr-3 font-medium">{sourceLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const off = r.match === false;
            return (
              <tr key={r.field} className={cn('border-t border-line align-top text-[14px] leading-5', off && 'bg-(--v-bg) text-(--v-tx)')}>
                <th scope="row" className={cn('py-2.5 pr-2 pl-3 font-normal whitespace-nowrap', off ? 'text-(--v-tx)' : 'text-ink-2')}>
                  <span className="flex items-center gap-1.5">
                    {off ? (
                      <X className="size-3.5 shrink-0" strokeWidth={2.5} aria-label="Differs" />
                    ) : r.match ? (
                      <Check className="size-3.5 shrink-0 text-ink-3" strokeWidth={2.25} aria-label="Matches" />
                    ) : (
                      <Minus className="size-3.5 shrink-0 text-ink-3" strokeWidth={2.25} aria-label="Couldn't compare" />
                    )}
                    {shortLabel(r)}
                  </span>
                </th>
                <td className={cn('px-2 py-2.5 break-words', off && 'font-medium', short(r.onPack) && 'whitespace-nowrap')}>{r.onPack ?? <Missing />}</td>
                <td className={cn('py-2.5 pr-3 pl-2 break-words', off && 'font-medium', short(r.inRegistry) && 'whitespace-nowrap')}>
                  {r.inRegistry ?? (r.match === null ? <Missing text="Couldn't compare" /> : <Missing text="No matching record in current local dataset" />)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Short row labels so the three columns stay on one or two lines at 390px.
const SHORT: Record<string, string> = { nafdacRegNo: 'Reg. no.', productName: 'Product', manufacturer: 'Maker', marketedBy: 'Imported by', activeIngredient: 'Ingredient', dosageForm: 'Form', batchNo: 'Batch', expiryDate: 'Expiry' };
function shortLabel(row: ComparisonRow) {
  return SHORT[row.field] ?? row.label;
}

// Short values (codes, strengths) read better unbroken.
const short = (v: string | null) => !!v && v.length <= 14;

function Missing({ text = 'Not on pack' }: { text?: string }) {
  return <span className="text-ink-3 italic">{text}</span>;
}

export function AlertRow({ alert }: { alert: AlertMatch }) {
  return (
    <a href={alert.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-fill">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-medium">NAFDAC Public Alert {alert.alertNo}</span>
        <span className="text-foot text-ink-2">
          Published {formatDate(alert.date)} · matched on {alert.matchedOn.map(matchLabel).join(' and ')}
        </span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
    </a>
  );
}

const matchLabel = (k: AlertMatch['matchedOn'][number]) => ({ batchNo: 'batch no.', nafdacRegNo: 'reg. no.', productName: 'product name' })[k];

export function SourceLink({ source }: { source: Finding['source'] }) {
  const label = (
    <>
      {source.name}
      {source.date && !source.name.includes(formatDate(source.date)) && <span className="text-ink-3"> · {formatDate(source.date)}</span>}
    </>
  );
  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 self-start text-foot text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
      {label}
      <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.75} />
    </a>
  ) : (
    <span className="text-foot">{label}</span>
  );
}

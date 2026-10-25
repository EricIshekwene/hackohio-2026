import { useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import type { Finding, VerificationResult } from '@shared/types';
import { LEGEND } from '@shared/legend';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataFooter, Shell, type StepInfo } from '@/components/app-shell';
import { AlertRow, ComparisonTable, LegendPopover, legendVars, SourceLink, VerdictIcon } from '@/components/verdict';

// Answer first: the verdict, what to do now, and a line that still makes sense as a screenshot.
function VerdictHeader({ result, productName, compact }: { result: VerificationResult; productName: string | null; compact: boolean }) {
  const l = result.legend;
  const sameAsLabel = result.headline.trim().toLowerCase() === l.label.trim().toLowerCase();
  const nextStep = result.reasons[0]?.nextStep ?? l.nextStep;
  // On the Why and Checked tabs the header folds to one line, like a large title collapsing.
  if (compact)
    return (
      <section aria-labelledby="verdict-headline" className="flex items-center gap-2.5 rounded-lg bg-(--v-bg) px-4 py-3 text-(--v-tx)" style={legendVars(l)}>
        <VerdictIcon legend={l} size={22} />
        <span className="flex min-w-0 flex-1 flex-col">
          <h1 id="verdict-headline" className="truncate text-body font-semibold text-ink">
            {result.headline}
          </h1>
          <span className="truncate text-cap">{l.label} · {result.caveat}</span>
        </span>
        <LegendPopover caveat={result.caveat} className="-mr-1.5" />
      </section>
    );
  return (
    <section aria-labelledby="verdict-headline" className="flex flex-col gap-2 rounded-lg bg-(--v-bg) p-4 text-(--v-tx)" style={legendVars(l)}>
      <div className="flex items-start justify-between gap-2">
        {sameAsLabel ? (
          <h1 id="verdict-headline" tabIndex={-1} className="flex items-center gap-2.5 text-[22px] leading-[28px] font-semibold tracking-[-0.02em] text-ink outline-none">
            <VerdictIcon legend={l} size={26} />
            {result.headline}
          </h1>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-foot font-semibold">
              <VerdictIcon legend={l} size={20} />
              {l.label}
            </span>
            <h1 id="verdict-headline" tabIndex={-1} className="text-[22px] leading-[28px] font-semibold tracking-[-0.02em] text-ink outline-none">
              {result.headline}
            </h1>
          </div>
        )}
        <LegendPopover caveat={result.caveat} className="-mt-1 -mr-1.5" />
      </div>
      <p className="text-body">{result.summary}</p>
      <p className="text-body font-medium text-ink">{nextStep}</p>
      <p className="text-cap opacity-80">
        {productName ? `${productName} · ` : ''}
        {formatDate(result.checkedAt.slice(0, 10))} · {result.caveat}
      </p>
    </section>
  );
}

function ReasonRow({ finding, summary }: { finding: Finding; summary: string }) {
  const l = LEGEND[finding.verdict];
  // A message that only repeats the summary adds nothing.
  const message = finding.message.trim() === summary.trim() ? null : finding.message;
  return (
    <Sheet>
      <SheetTrigger className="flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left last:border-b-0 hover:bg-fill">
        <VerdictIcon legend={l} size={20} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-medium">{finding.title}</span>
          {message && <span className="line-clamp-2 text-foot text-ink-2">{message}</span>}
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-3" />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <span className="flex items-center gap-2 text-foot font-semibold" style={{ color: l.text }}>
            <VerdictIcon legend={l} size={18} />
            {l.label}
          </span>
          <SheetTitle>{finding.title}</SheetTitle>
          {message && <SheetDescription className="text-body">{message}</SheetDescription>}
        </SheetHeader>
        <SheetBody>
          {finding.evidence.length > 0 && (
            <dl className="flex flex-col overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--color-line)]">
              {finding.evidence.map((e) => (
                <div key={e.field} className="grid grid-cols-[1fr_1fr] gap-x-3 gap-y-0.5 border-b border-line px-3.5 py-2.5 last:border-b-0" style={e.match === false ? { background: LEGEND.red.background, color: LEGEND.red.text } : undefined}>
                  <dt className="col-span-2 text-cap opacity-70">{e.label}</dt>
                  <dd className="text-foot">
                    <span className="block text-cap opacity-60">On the pack</span>
                    {e.onPack ?? '—'}
                  </dd>
                  <dd className="text-foot">
                    <span className="block text-cap opacity-60">NAFDAC record</span>
                    {e.inRegistry ?? '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-cap text-ink-3">Source</span>
            <SourceLink source={finding.source} />
          </div>
          <div className="flex flex-col gap-1 rounded-md bg-fill p-3.5">
            <span className="text-cap text-ink-3">What to do</span>
            <p className="text-body font-medium">{finding.nextStep}</p>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function Lines({ items, mark }: { items: string[]; mark: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5 text-foot text-ink-2">
          <span aria-hidden="true" className="w-3 shrink-0 text-center text-ink-3">
            {mark}
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function VerdictScreen({
  step,
  result,
  productName,
  onReport,
  onAnother,
  onEdit,
}: {
  step: StepInfo;
  result: VerificationResult;
  productName: string | null;
  onReport: () => void;
  onAnother: () => void;
  onEdit: () => void;
}) {
  const v = result.verdict;
  const differ = result.comparison.filter((r) => r.match === false).length;
  const [tab, setTab] = useState('compare');

  const actions =
    v === 'green' ? (
      <>
        <Button block onClick={onAnother}>
          Check another pack
        </Button>
        <Button variant="link" className="self-center text-foot" onClick={onReport}>
          Something looks off? Report it
        </Button>
      </>
    ) : v === 'unsure' ? (
      <>
        <Button block onClick={onEdit}>
          Add the NAFDAC number
        </Button>
        <Button block variant="ghost" className="h-10" onClick={onReport}>
          Report to NAFDAC
        </Button>
      </>
    ) : (
      <>
        <Button block onClick={onReport}>
          Report to NAFDAC
        </Button>
        <Button block variant="ghost" className="h-10" onClick={onAnother}>
          Check another pack
        </Button>
      </>
    );

  return (
    <Shell
      step={step}
      onBack={onEdit}
      backLabel="Edit details"
      trailing={
        v === 'unsure' && (
          <Button variant="ghost" size="sm" onClick={onAnother} className="text-body">
            New check
          </Button>
        )
      }
      className="gap-3 pt-4"
      footer={
        <>
          {actions}
          <DataFooter dataAsOf={result.dataAsOf} caveat={result.caveat} className="mt-1" />
        </>
      }
    >
      <VerdictHeader result={result} productName={productName} compact={tab !== 'compare'} />

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="compare">
            Compare{differ > 0 && <span className="tabular text-ink-3">{differ} off</span>}
          </TabsTrigger>
          <TabsTrigger value="why">
            Why<span className="tabular text-ink-3">{result.reasons.length}</span>
          </TabsTrigger>
          <TabsTrigger value="checked">Checked</TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="flex flex-col gap-3">
          <ComparisonTable rows={result.comparison} legendRed={LEGEND.red} />
          {result.alertMatches.map((a) => (
            <AlertRow key={a.alertNo} alert={a} />
          ))}
          {result.notes.map((n) => (
            <p key={n} className="flex items-start gap-2 text-foot text-ink-2">
              <Info className="mt-px size-4 shrink-0" strokeWidth={1.75} />
              {n}
            </p>
          ))}
        </TabsContent>

        <TabsContent value="why">
          <div className="overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_var(--color-line)]">
            {result.reasons.map((f) => (
              <ReasonRow key={f.rule + f.title} finding={f} summary={result.summary} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="checked" className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-foot font-medium">What we checked</h2>
            <Lines items={result.checked} mark="✓" />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-foot font-medium">What we couldn't check</h2>
            {result.notChecked.length ? <Lines items={result.notChecked} mark="–" /> : <p className="text-foot text-ink-3">Nothing was left out.</p>}
          </section>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

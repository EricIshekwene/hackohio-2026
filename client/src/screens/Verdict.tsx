import { useEffect } from 'react';
import type { VerificationResult } from '@shared/types';
import { AlertCard, ComparisonTable, DataFooter, Disclosure, MiniLegend, ReasonCard, VerdictCard } from '@/components/verdict';
import { Button, SectionLabel } from '@/components/ui';
import { Shell } from '@/components/Shell';

// Displays /api/check's answer as sent. Nothing here decides or rewords a verdict.
export function VerdictScreen({
  result,
  onReport,
  onAnother,
  onEdit,
}: {
  result: VerificationResult;
  onReport: () => void;
  onAnother: () => void;
  onEdit: () => void;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('verdict-headline')?.focus();
  }, [result]);

  const mismatches = result.comparison.filter((r) => r.match === false).length;

  return (
    <Shell
      step={3}
      footer={
        <>
          {result.verdict !== 'green' && <Button onClick={onReport}>Report to NAFDAC</Button>}
          <Button variant={result.verdict === 'green' ? 'primary' : 'secondary'} onClick={onAnother}>
            Check another pack
          </Button>
        </>
      }
    >
      <VerdictCard result={result} />
      <MiniLegend current={result.verdict} />

      {result.comparison.length > 0 && (
        <section className="grid gap-2" aria-labelledby="cmp-h">
          <div className="flex items-baseline justify-between">
            <h2 id="cmp-h" className="text-[20px] font-extrabold tracking-[-0.025em]">
              Your pack vs NAFDAC
            </h2>
            {mismatches > 0 && (
              <span className="text-[13px] font-bold" style={{ color: result.legend.text }}>
                {mismatches} {mismatches === 1 ? 'difference' : 'differences'}
              </span>
            )}
          </div>
          <ComparisonTable rows={result.comparison} />
        </section>
      )}

      {result.alertMatches.length > 0 && (
        <section className="grid gap-2">
          <SectionLabel>NAFDAC alerts that match</SectionLabel>
          {result.alertMatches.map((a) => (
            <AlertCard key={a.alertNo} alert={a} />
          ))}
        </section>
      )}

      {result.reasons.length > 0 && (
        <section className="grid gap-3">
          <SectionLabel>Why</SectionLabel>
          {result.reasons.map((f, i) => (
            <ReasonCard key={`${f.rule}-${i}`} finding={f} />
          ))}
        </section>
      )}

      {result.notes.length > 0 && (
        <ul className="grid gap-2">
          {result.notes.map((n) => (
            <li key={n} className="flex gap-2 rounded-[10px] bg-mist px-3 py-2.5 text-[14px]">
              <span aria-hidden="true" className="font-bold text-moss">ⓘ</span>
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2">
        <Disclosure title="What we checked" count={result.checked.length}>
          <ul className="grid gap-1.5 text-[14px]">
            {result.checked.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden="true" className="text-fern">•</span>
                {c}
              </li>
            ))}
          </ul>
        </Disclosure>
        <Disclosure title="What we couldn't check" count={result.notChecked.length} defaultOpen={result.notChecked.length > 0}>
          {result.notChecked.length ? (
            <ul className="grid gap-1.5 text-[14px]">
              {result.notChecked.map((c) => (
                <li key={c} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted">–</span>
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Nothing was left out for this pack.</p>
          )}
        </Disclosure>
      </div>

      <button type="button" onClick={onEdit} className="min-h-11 text-[14px] font-semibold text-moss underline underline-offset-4">
        Got a detail wrong? Edit and check again
      </button>

      <DataFooter result={result} />
    </Shell>
  );
}

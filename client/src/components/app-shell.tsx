import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand';
import { formatDate as fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

export const PHOTO_STEPS = ['Snap', 'Read', 'Confirm', 'Result'] as const;
export const TYPED_STEPS = ['Type', 'Check', 'Result'] as const;

export interface StepInfo {
  steps: readonly string[];
  current: number; // index of the step on screen
}

export function Stepper({ steps, current, onStage = false }: StepInfo & { onStage?: boolean }) {
  return (
    <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current + 1} aria-valuetext={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
      {steps.map((s, i) => (
        <span
          key={s}
          className={cn('h-[3px] flex-1 rounded-full transition-colors duration-300', i <= current ? (onStage ? 'bg-white' : 'bg-brand') : onStage ? 'bg-white/20' : 'bg-line')}
        />
      ))}
    </div>
  );
}

function StepLabel({ steps, current, onStage }: StepInfo & { onStage: boolean }) {
  return (
    <span className={cn('text-foot tabular', onStage ? 'text-white/60' : 'text-ink-3')}>
      <span className={cn('font-medium', onStage ? 'text-white' : 'text-ink')}>{steps[current]}</span> · {current + 1} of {steps.length}
    </span>
  );
}

// One 430px column that fills the viewport: bar, stepper, content, then the actions pinned to the bottom.
export function Shell({
  step,
  onBack,
  backLabel = 'Back',
  trailing,
  title,
  description,
  children,
  footer,
  stage = false,
  fit = false,
  className,
}: {
  step?: StepInfo;
  onBack?: () => void;
  backLabel?: string;
  trailing?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  stage?: boolean;
  fit?: boolean; // on phones tall enough, lock to the viewport and let one region scroll; short phones scroll the page
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex w-full', 'min-h-dvh', fit && '[@media(min-height:740px)]:h-dvh', ' max-w-[430px] flex-col', stage ? 'bg-stage text-white' : 'bg-surface')}>
      <header className="flex flex-col gap-2 px-5 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="-mx-2 flex h-11 items-center justify-between">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack} className={cn('gap-0.5 px-2 text-body', stage && 'text-white hover:bg-white/10')}>
              <ChevronLeft className="size-5" strokeWidth={2} />
              {backLabel}
            </Button>
          ) : (
            <Logo className="px-2" onStage={stage} />
          )}
          <div className="flex items-center px-2">{trailing || (step && <StepLabel {...step} onStage={stage} />)}</div>
        </div>
        {step && <Stepper {...step} onStage={stage} />}
      </header>
      <main className={cn('enter flex flex-1 flex-col gap-4 px-5 pt-5 pb-4', fit && 'min-h-0', className)}>
        {(title || description) && (
          <div className="flex flex-col gap-1">
            {title && <h1 className="text-title font-semibold">{title}</h1>}
            {description && <p className={cn('text-foot', stage ? 'text-white/65' : 'text-ink-2')}>{description}</p>}
          </div>
        )}
        {children}
      </main>
      {footer && <footer className="flex flex-col gap-2 px-5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</footer>}
    </div>
  );
}

// Numbered sequence of work for Read and Checking: done, running, waiting.
export function ProgressList({ items, active, failed = false }: { items: string[]; active: number; failed?: boolean }) {
  return (
    <ol className="flex flex-col gap-3" aria-live="polite">
      {items.map((label, i) => {
        const state = i < active ? 'done' : i === active && !failed ? 'running' : 'waiting';
        return (
          <li key={label} className={cn('flex items-center gap-3 text-body transition-colors', state === 'waiting' ? 'text-ink-3' : 'text-ink')}>
            <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
              {state === 'done' && (
                <svg viewBox="0 0 20 20" className="size-5">
                  <circle cx="10" cy="10" r="10" fill="#0A0C0A" />
                  <path d="m6 10.2 2.6 2.6L14 7.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {state === 'running' && <span className="size-4 animate-spin rounded-full border-[1.75px] border-line border-t-ink" />}
              {state === 'waiting' && <span className="size-1.5 rounded-full bg-ink-3/60" />}
            </span>
            {label}
            <span className="sr-only">{state === 'done' ? ', done' : state === 'running' ? ', in progress' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Data dates and the caveat. Never calls the data live.
export function DataFooter({ dataAsOf, caveat, className }: { dataAsOf?: { registrySnapshot: string; lastAlert: string } | null; caveat: string; className?: string }) {
  return (
    <p className={cn('text-center text-[11px] leading-4 text-ink-3', className)}>
      {dataAsOf && (
        <span className="tabular">
          Registry snapshot: {fmt(dataAsOf.registrySnapshot)} · Last NAFDAC alert: {fmt(dataAsOf.lastAlert)}
          <br />
        </span>
      )}
      {caveat}
    </p>
  );
}
